"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Router = require("find-my-way");
const typeIs = require("type-is");
const defaults_1 = require("./defaults");
const util = require("./util");
// MODULE VARIABLES
// =================================================================================================
const JSON_CONTENT = ['application/json'];
// CLASS DEFINITION
// =================================================================================================
class HttpController {
    constructor(options) {
        options = processOptions(options);
        this.routers = new Map();
        this.routerOptions = options.routerOptions;
        this.adapter = options.adapter;
        this.executor = options.executor;
        this.defaults = options.defaults;
    }
    set(functionName, route, config) {
        let router = this.routers.get(functionName);
        if (!router) {
            router = Router(this.routerOptions);
            this.routers.set(functionName, router);
        }
        route = cleanPath(route); // TODO: test for route conflicts?
        const corsHeaders = buildCorsHeaders(this.defaults.cors, config.cors);
        const methods = ['OPTIONS'];
        router.on('OPTIONS', route, noop, corsHeaders);
        if (config.get) {
            const operationConfig = buildOpConfig('GET', route, config.get, this.defaults);
            router.on('GET', route, noop, operationConfig);
            methods.push('GET');
        }
        if (config.post) {
            const operationConfig = buildOpConfig('POST', route, config.post, this.defaults);
            router.on('POST', route, noop, operationConfig);
            methods.push('POST');
        }
        if (config.put) {
            const operationConfig = buildOpConfig('PUT', route, config.put, this.defaults);
            router.on('PUT', route, noop, operationConfig);
            methods.push('PUT');
        }
        if (config.patch) {
            const operationConfig = buildOpConfig('PATCH', route, config.patch, this.defaults);
            router.on('PATCH', route, noop, operationConfig);
            methods.push('PATCH');
        }
        if (config.delete) {
            const operationConfig = buildOpConfig('DELETE', route, config.delete, this.defaults);
            router.on('DELETE', route, noop, operationConfig);
            methods.push('DELETE');
        }
        // set a list of allowed methods for CORS headers
        corsHeaders["Access-Control-Allow-Methods"] = methods.join(',');
    }
    async handler(context, request) {
        // check if the route is registered
        const functionName = context.executionContext.functionName;
        const router = this.routers.get(functionName);
        if (!router) {
            throw new Error(`Router for '${functionName}' could not be found`);
        }
        const route = router.find(request.method, '/' + (request.params.route || ''));
        // 0 ----- make sure the request needs to be handled
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
        let executed = false;
        let opContext = undefined;
        const opConfig = route.store;
        try {
            // 1 ----- create operation context
            const reqHead = {
                route: opConfig.path,
                method: request.method,
                headers: request.headers,
                ip: util.getIpAddress(request.headers),
                url: request.originalUrl
            };
            const opContextConfig = this.adapter(reqHead, context, opConfig.options);
            opContext = await this.executor.createContext(opContextConfig);
            // 2 ----- parse request body
            let body = undefined;
            if (opConfig.parser) {
                body = await opConfig.parser(request, opContext);
                if (typeof body !== 'object')
                    throw new Error('Invalid value received from body parser');
            }
            else if (request.body) {
                const contentType = request.headers['content-type'] || request.headers['Content-Type'];
                if (typeIs.is(contentType, JSON_CONTENT)) {
                    body = request.body;
                }
                else {
                    // content type not supported - return error
                    return defaults_1.defaults.invalidContentResponse;
                }
            }
            // 3 ----- build action inputs and view options
            let actionInputs = undefined, viewOptions = undefined;
            if (opConfig.processor) {
                const result = opConfig.processor(body, request.query, route.params, opConfig.defaults);
                actionInputs = result.action;
                viewOptions = result.view;
            }
            else {
                actionInputs = Object.assign({}, opConfig.defaults, request.query, route.params, body);
            }
            // 4 ----- authenticate the request
            let requestor = undefined;
            if (opConfig.authenticator) {
                const credentials = util.parseAuthHeader(request.headers);
                if (credentials === null) {
                    // auth header could not be parsed
                    return defaults_1.defaults.invalidAuthHeaderResponse;
                }
                requestor = await opConfig.authenticator(opConfig.scope, credentials, opContext);
            }
            // 5 ----- execute actions
            const result = await this.executor.execute(opConfig.actions, actionInputs, opContext);
            executed = true;
            // 6 ------ close the context
            await this.executor.closeContext(opContext);
            // 7 ----- build the response
            let response;
            if (!result || !opConfig.view) {
                response = {
                    status: 204 /* NoContent */,
                    headers: opConfig.headers,
                    body: null
                };
            }
            else {
                const view = opConfig.view(result, viewOptions, {
                    viewer: requestor,
                    timestamp: opContext.timestamp
                });
                if (!view) {
                    response = {
                        status: 204 /* NoContent */,
                        headers: opConfig.headers,
                        body: null
                    };
                }
                else {
                    response = {
                        status: view[defaults_1.symbols.responseStatus] || 200 /* OK */,
                        headers: Object.assign({}, opConfig.headers, view[defaults_1.symbols.responseHeaders]),
                        body: view
                    };
                }
            }
            // 8 ----- log the request and return the result
            opContext.log.close(response.status, true);
            return response;
        }
        catch (error) {
            // if not a server error - build an error response
            let response;
            if (error.status < 500 /* InternalServerError */) {
                const body = error.toJSON ? error.toJSON() : null;
                const headers = Object.assign({}, opConfig, error.headers, { 'Content-Type': (body ? 'application/json' : null) });
                response = { status: error.status, headers, body };
            }
            // if the context has been created - use it to log errors
            if (opContext) {
                opContext.log.error(error);
                // if the context hasn't been closed yet - try close it
                if (!executed) {
                    try {
                        await this.executor.closeContext(opContext, error);
                    }
                    catch (closingError) {
                        opContext.log.error(closingError);
                        response = undefined;
                    }
                }
                // if there is a response to return, don't throw an error
                if (response) {
                    opContext.log.close(response.status, false);
                    return response;
                }
                else {
                    opContext.log.close(500 /* InternalServerError */, false);
                    throw error;
                }
            }
            else {
                // context wasn't even created
                if (response)
                    return response;
                else
                    throw error;
            }
        }
    }
}
exports.HttpController = HttpController;
// HELPER FUNCTIONS
// =================================================================================================
function processOptions(options) {
    if (!options)
        return defaults_1.defaults.httpController;
    let newOptions = {
        adapter: options.adapter || defaults_1.defaults.httpController.adapter,
        executor: options.executor || defaults_1.defaults.httpController.executor,
        routerOptions: options.routerOptions,
        defaults: undefined,
    };
    if (options.defaults) {
        newOptions.defaults = Object.assign({}, defaults_1.defaults.httpController.defaults, options.defaults, {
            cors: Object.assign({}, defaults_1.defaults.httpController.defaults.cors, options.defaults.cors),
            inputs: Object.assign({}, defaults_1.defaults.httpController.defaults.inputs, options.defaults.inputs)
        });
    }
    else {
        newOptions.defaults = defaults_1.defaults.httpController.defaults;
    }
    return newOptions;
}
function cleanPath(path) {
    if (!path)
        throw new TypeError(`Route path '${path}' is not valid`);
    if (typeof path !== 'string')
        throw new TypeError(`Route path must be a string`);
    if (path.charAt(0) !== '/')
        throw new TypeError(`Route path must start with '/'`);
    if (path !== '/') {
        while (path.charAt(path.length - 1) === '/') {
            path = path.slice(0, -1); // removes last character
        }
    }
    return path;
}
function buildCorsHeaders(defaultCors, routeCors) {
    const cors = Object.assign({}, defaultCors, routeCors);
    return {
        'Access-Control-Allow-Methods': undefined,
        'Access-Control-Allow-Origin': cors.origin,
        'Access-Control-Allow-Headers': cors.headers.join(','),
        'Access-Control-Allow-Credentials': cors.credentials,
        'Access-Control-Max-Age': cors.maxAge
    };
}
function buildOpConfig(method, path, config, defaults) {
    // determine view
    const view = config.view === undefined ? defaults.view : config.view;
    // build headers
    let headers = undefined;
    if (view) {
        headers = { 'Content-Type': 'application/json' };
    }
    // validate and build actions
    const actions = [];
    if (config.action) {
        if (typeof config.action !== 'function') {
            throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: action must be a function`);
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
            if (typeof action !== 'function') {
                throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: all actions must be function`);
            }
            else {
                actions.push(action);
            }
        }
    }
    return {
        method: method,
        path: path,
        scope: config.scope === undefined ? defaults.scope : config.scope,
        headers: headers,
        options: config.options,
        defaults: Object.assign({}, defaults.inputs, config.defaults),
        parser: config.body,
        processor: config.inputs,
        authenticator: config.auth === undefined ? defaults.auth : config.auth,
        actions: actions,
        view: view
    };
}
function noop() { }
;
//# sourceMappingURL=HttpController.js.map