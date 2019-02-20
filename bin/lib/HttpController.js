"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Router = require("find-my-way");
const typeIs = require("type-is");
const defaults_1 = require("./defaults");
const HttpSegment_1 = require("./HttpSegment");
const util = require("./util");
// MODULE VARIABLES
// =================================================================================================
const JSON_CONTENT = ['application/json'];
// CLASS DEFINITION
// =================================================================================================
class HttpController {
    ;
    // CONSTRUCTOR
    // ---------------------------------------------------------------------------------------------
    constructor(options) {
        options = processOptions(options);
        this.router = Router(options.routerOptions);
        this.rethrowThreshold = options.rethrowThreshold;
        this.adapter = options.adapter;
        this.defaults = options.defaults;
        this.segments = new Map();
    }
    // ROUTE REGISTRATION
    // ---------------------------------------------------------------------------------------------
    set(route, config) {
        // make sure the route is valid
        route = util.cleanPath(route);
        for (let method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
            if (this.router.find(method, route)) {
                throw new TypeError(`Invalid definition for '${route}' endpoint: conflicting endpoint handler found`);
            }
        }
        // build CORS headers
        const corsHeaders = buildCorsHeaders(config, this.defaults.cors);
        // build endpoint handlers
        for (let item in config) {
            switch (item) {
                case 'get':
                case 'post':
                case 'put':
                case 'patch':
                case 'delete': {
                    const method = item.toUpperCase();
                    const opConfig = buildOpConfig(method, route, config[item], this.defaults, corsHeaders);
                    this.router.on(method, route, noop, opConfig);
                    break;
                }
                case 'cors': {
                    // skip since CORS headers have already been built
                    break;
                }
                default: {
                    const method = item.toUpperCase();
                    throw new TypeError(`Invalid definition for '${method} ${route}' endpoint: '${method}' method is not supported`);
                }
            }
        }
        this.router.on('OPTIONS', route, noop, corsHeaders);
    }
    segment(root, defaults) {
        root = util.cleanPath(root);
        let segment = this.segments.get(root);
        if (segment) {
            throw new TypeError(`Cannot register segment: segment for '${root}' has already been registered`);
        }
        else {
            segment = new HttpSegment_1.HttpSegment(this, root, defaults);
            this.segments.set(root, segment);
        }
        return segment;
    }
    // ROUTE HANDLING
    // ---------------------------------------------------------------------------------------------
    async handler(context, request) {
        // 0 ----- make sure the request needs to be handled
        const route = this.router.find(request.method, '/' + (request.params.route || ''));
        if (!route) {
            // route not found - return error
            return defaults_1.defaults.notFoundResponse;
        }
        else if (request.method === 'OPTIONS') {
            // requesting options - return CORS headers
            return {
                status: 200 /* OK */,
                headers: route.store,
                body: null
            };
        }
        let operation = undefined;
        const opConfig = route.store;
        try {
            // 1 ----- create operation context
            const requestHead = {
                route: opConfig.path,
                method: request.method,
                headers: request.headers,
                ip: util.getIpAddress(request.headers),
                url: request.originalUrl
            };
            operation = this.adapter(context, requestHead, opConfig.actions, opConfig.options);
            // 2 ----- transform request into inputs object
            let inputs = undefined;
            if (opConfig.parser) {
                inputs = await opConfig.parser.call(operation, request, opConfig.defaults, route.params);
                if (typeof inputs !== 'object')
                    throw new Error('Invalid value received from input parser');
            }
            else {
                let body = undefined;
                if (request.body) {
                    const contentType = request.headers['content-type'] || request.headers['Content-Type'];
                    if (typeIs.is(contentType, JSON_CONTENT)) {
                        body = request.body;
                    }
                    else {
                        // content type not supported - return error
                        return defaults_1.defaults.invalidContentResponse;
                    }
                }
                inputs = Object.assign({}, opConfig.defaults, request.query, route.params, body);
            }
            // 3 ----- validate inputs object
            if (opConfig.validator) {
                inputs = opConfig.validator.call(operation, inputs);
            }
            // 4 ----- authenticate the request
            let auth = undefined;
            if (opConfig.authenticator) {
                const credentials = util.parseAuthHeader(request.headers);
                if (credentials === null) {
                    // auth header could not be parsed
                    return defaults_1.defaults.invalidAuthHeaderResponse;
                }
                auth = await opConfig.authenticator.call(operation, opConfig.scope, credentials);
            }
            // 5 ----- split inputs into action inputs and view options
            let actionInputs = undefined, viewOptions = undefined;
            if (opConfig.mutator) {
                const result = opConfig.mutator.call(operation, inputs, auth);
                actionInputs = result.action;
                viewOptions = result.view;
            }
            else {
                actionInputs = inputs;
            }
            // 6 ----- execute actions
            const result = await operation.execute(actionInputs);
            // 7 ----- build the response
            let response;
            if (!opConfig.view) {
                response = {
                    status: 204 /* NoContent */,
                    headers: opConfig.headers,
                    body: null
                };
            }
            else {
                const viewContext = { auth, timestamp: operation.timestamp };
                const view = opConfig.view.call(viewContext, result, viewOptions);
                if (!view) {
                    // for GET requests return NotFound; otherwise NoContent
                    response = {
                        status: request.method === 'GET' ? 404 /* NotFound */ : 204 /* NoContent */,
                        headers: opConfig.headers,
                        body: null
                    };
                }
                else {
                    const status = view[defaults_1.symbols.responseStatus] || 200 /* OK */;
                    response = {
                        status: status,
                        headers: Object.assign({}, opConfig.headers, view[defaults_1.symbols.responseHeaders]),
                        body: status === 204 /* NoContent */ ? null : view
                    };
                }
            }
            // 8 ----- log the request and return the result
            operation.log.close(response.status, true);
            return response;
        }
        catch (error) {
            // determine error status
            const status = error.status || 500 /* InternalServerError */;
            // if the operation has been created - use it to log errors
            if (operation) {
                operation.log.error(error);
                operation.log.close(status, false);
            }
            // if the error is over the threshold, throw it
            if (status > this.rethrowThreshold) {
                throw error;
            }
            else {
                // otherwise, return an error response
                const headers = Object.assign({}, opConfig.headers, error.headers, { 'Content-Type': 'application/json' });
                const body = error.toJSON
                    ? error.toJSON()
                    : { name: error.name, message: error.message };
                return { status, headers, body };
            }
        }
    }
}
exports.HttpController = HttpController;
// HELPER FUNCTIONS
// =================================================================================================
function processOptions(options) {
    if (!options) {
        return {
            adapter: defaults_1.defaults.httpController.adapter,
            routerOptions: defaults_1.defaults.httpController.routerOptions,
            rethrowThreshold: defaults_1.defaults.httpController.rethrowThreshold,
            defaults: Object.assign({}, defaults_1.defaults.httpController.defaults, { cors: Object.assign({}, defaults_1.defaults.httpController.defaults.cors) }),
        };
    }
    ;
    // build controller config
    const newOptions = {
        adapter: options.adapter || defaults_1.defaults.httpController.adapter,
        routerOptions: options.routerOptions,
        rethrowThreshold: options.rethrowThreshold || defaults_1.defaults.httpController.rethrowThreshold,
        defaults: undefined,
    };
    // set default endpoint options
    if (options.defaults) {
        newOptions.defaults = Object.assign({}, defaults_1.defaults.httpController.defaults, options.defaults, { cors: Object.assign({}, defaults_1.defaults.httpController.defaults.cors, options.defaults.cors) });
    }
    else {
        newOptions.defaults = Object.assign({}, defaults_1.defaults.httpController.defaults);
    }
    return newOptions;
}
function buildCorsHeaders(config, defaultCors) {
    // merge default and rout CORS
    const cors = Object.assign({}, defaultCors, config.cors);
    // determine allowed methods
    const methods = ['OPTIONS'];
    if (config.get)
        methods.push('GET');
    if (config.post)
        methods.push('POST');
    if (config.put)
        methods.push('PUT');
    if (config.patch)
        methods.push('PATCH');
    if (config.delete)
        methods.push('DELETE');
    // build and return CORS headers
    return {
        'Access-Control-Allow-Methods': methods.join(','),
        'Access-Control-Allow-Origin': cors.origin,
        'Access-Control-Allow-Headers': cors.headers.join(','),
        'Access-Control-Allow-Credentials': cors.credentials,
        'Access-Control-Max-Age': cors.maxAge
    };
}
function buildOpConfig(method, path, config, defaults, cors) {
    // determine view
    const view = config.view === undefined ? defaults.view : config.view;
    if (view && !util.isRegularFunction(view)) {
        throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: view builder must be a regular function`);
    }
    // build headers
    let headers = cors;
    if (view) {
        headers = Object.assign({}, headers, { 'Content-Type': 'application/json' });
    }
    // validate input parser
    const parser = config.inputs;
    if (parser && !util.isRegularFunction(parser)) {
        throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: input parser must be a regular function`);
    }
    // validate input validator
    const validator = config.schema;
    if (validator && !util.isRegularFunction(validator)) {
        throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: input validator must be a regular function`);
    }
    // TODO: implement schema validation using AJV
    // validate authenticator
    const authenticator = config.auth === undefined ? defaults.auth : config.auth;
    if (authenticator && !util.isRegularFunction(authenticator)) {
        throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: authenticator must be a regular function`);
    }
    // validate input mutator
    const mutator = config.mutator === undefined ? defaults.mutator : config.mutator;
    if (mutator && !util.isRegularFunction(mutator)) {
        throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: input mutator must be a regular function`);
    }
    // validate and build actions
    const actions = [];
    if (config.action) {
        if (!util.isRegularFunction(config.action)) {
            throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: action must be a regular function`);
        }
        else if (config.actions) {
            throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: 'action' and 'actions' cannot be provided at the same time`);
        }
        else {
            actions.push(config.action);
        }
    }
    else if (config.actions) {
        for (let action of config.actions) {
            if (!util.isRegularFunction(action)) {
                throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: all actions must be regular functions`);
            }
            else {
                actions.push(action);
            }
        }
    }
    else {
        throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: no actions were provided`);
    }
    return {
        method: method,
        path: path,
        scope: config.scope === undefined ? defaults.scope : config.scope,
        headers: headers,
        options: config.options,
        defaults: Object.assign({}, config.defaults),
        parser: parser,
        validator: validator,
        authenticator: authenticator,
        mutator: mutator,
        actions: actions,
        view: view
    };
}
function noop() { }
;
//# sourceMappingURL=HttpController.js.map