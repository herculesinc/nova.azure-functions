// IMPORTS
// =================================================================================================
import { AzureFunctionContext, AzureHttpRequest, AzureHttpResponse } from 'azure-functions';
import { Executable, Context, HttpStatusCode } from '@nova/core';
import {
    Action, HttpControllerConfig, HttpOperationAdapter, HttpRouteConfig, HttpEndpointConfig, HttpEndpointDefaults,
    Authenticator, HttpInputParser, HttpInputValidator, HttpInputMutator, ViewBuilder, StringBag, CorsOptions, ViewContext
} from '@nova/azure-functions';
import * as Router from 'find-my-way';
import * as typeIs from 'type-is';
import { defaults, symbols } from './defaults';
import * as util from './util';

// MODULE VARIABLES
// =================================================================================================
const JSON_CONTENT = ['application/json'];

// INTERFACES
// =================================================================================================
interface OperationConfig {
    method          : string;
    path            : string;
    scope           : string;
    headers         : StringBag;
    options         : any;
    defaults        : any;
    parser          : HttpInputParser;
    validator       : HttpInputValidator;
    authenticator   : Authenticator;
    mutator         : HttpInputMutator;
    actions         : Action[];
    view            : ViewBuilder;
}

// CLASS DEFINITION
// =================================================================================================
export class HttpController {

    private readonly routers    : Map<string,Router.Router>;
    private readonly adapter    : HttpOperationAdapter;
    private readonly defaults   : HttpEndpointDefaults;

    private readonly routerOptions      : Router.RouterConfig;
    private readonly rethrowThreshold   : number;

    constructor(options?: Partial<HttpControllerConfig>) {
        options = processOptions(options);

        this.routers = new Map();
        this.routerOptions = options.routerOptions;
        this.rethrowThreshold = options.rethrowThreshold;

        this.adapter = options.adapter;
        this.defaults = options.defaults;
    }

    set(functionName: string, route: string, config: HttpRouteConfig) {

        let router = this.routers.get(functionName);
        if (!router) {
            router = Router(this.routerOptions);
            this.routers.set(functionName, router);
        }

        // make sure the route is valid
        route = cleanPath(route);
        for (let method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
            if (router.find(method as Router.HttpMethod, route)) {
                throw new TypeError(`Invalid definition for '${route}' endpoint: conflicting endpoint handler found`);
            }
        }

        // build CORS headers
        const corsHeaders = buildCorsHeaders(config, this.defaults.cors);

        // build
        for (let item in config) {
            switch (item) {
                case 'get': case 'post': case 'put': case 'patch': case 'delete': {
                    const method = item.toUpperCase() as Router.HttpMethod;
                    const opConfig = buildOpConfig(method, route, config[item], this.defaults, corsHeaders);
                    router.on(method, route, noop, opConfig);
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

        router.on('OPTIONS', route, noop, corsHeaders);
    }

    async handler(context: AzureFunctionContext, request: AzureHttpRequest): Promise<AzureHttpResponse> {

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
            return defaults.notFoundResponse;
        }
        else if (request.method === 'OPTIONS') {
            // requesting options - return CORS headers
            return {
                status  : HttpStatusCode.OK,
                headers : route.store as any,
                body    : null
            };
        }

        let operation: Executable & Context = undefined;
        const opConfig = route.store as OperationConfig;
        try {
            // 1 ----- create operation context
            const requestHead = {
                route   : opConfig.path,
                method  : request.method,
                headers : request.headers,
                ip      : util.getIpAddress(request.headers),
                url     : request.originalUrl
            };
            operation = this.adapter(context, requestHead, opConfig.actions, opConfig.options);

            // 2 ----- transform request into inputs object
            let inputs = undefined;
            if (opConfig.parser) {
                inputs = await opConfig.parser.call(operation, request, opConfig.defaults, route.params);
                if (typeof inputs !== 'object') throw new Error('Invalid value received from input parser');
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
                        return defaults.invalidContentResponse;
                    }
                }
                inputs = { ...opConfig.defaults, ...request.query, ...route.params, ...body };
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
                    return defaults.invalidAuthHeaderResponse;
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
            let response: AzureHttpResponse;
            if (!opConfig.view) {
                response = {
                    status  : HttpStatusCode.NoContent,
                    headers : opConfig.headers,
                    body    : null
                };
            }
            else {
                const viewContext: ViewContext = { auth, timestamp: operation.timestamp };
                const view = opConfig.view.call(viewContext, result, viewOptions);

                if (!view) {
                    response =  {
                        status  : HttpStatusCode.NotFound,
                        headers : opConfig.headers,
                        body    : null
                    };
                }
                else {
                    response =  {
                        status  : view[symbols.responseStatus] || HttpStatusCode.OK,
                        headers : { ...opConfig.headers, ...view[symbols.responseHeaders] },
                        body    : view
                    };
                }
            }

            // 8 ----- log the request and return the result
            operation.log.close(response.status, true);
            return response;
        }
        catch(error) {

            // determine error status
            const status = error.status || HttpStatusCode.InternalServerError;

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
                const headers = { ...opConfig.headers, ...error.headers, 'Content-Type': 'application/json' };
                const body = error.toJSON
                    ? error.toJSON()
                    : { name: error.name, message: error.message };

                return { status, headers, body };
            }
        }
    }
}

// HELPER FUNCTIONS
// =================================================================================================
function processOptions(options?: Partial<HttpControllerConfig>): HttpControllerConfig {
    if (!options) {
        return {
            adapter         : defaults.httpController.adapter,
            routerOptions   : defaults.httpController.routerOptions,
            rethrowThreshold: defaults.httpController.rethrowThreshold,
            defaults: {
                ...defaults.httpController.defaults,
                cors: { ...defaults.httpController.defaults.cors }
            },
        };
    };

    // build controller config
    const newOptions: HttpControllerConfig = {
        adapter         : options.adapter || defaults.httpController.adapter,
        routerOptions   : options.routerOptions,
        rethrowThreshold: options.rethrowThreshold || defaults.httpController.rethrowThreshold,
        defaults        : undefined,
    };

    // set default endpoint options
    if (options.defaults) {
        newOptions.defaults = {
            ...defaults.httpController.defaults,
            ...options.defaults,
            cors: { ...defaults.httpController.defaults.cors, ...options.defaults.cors }
        };
    }
    else {
        newOptions.defaults = { ...defaults.httpController.defaults };
    }

    return newOptions;
}

function cleanPath(path: string) {
    if (!path) throw new TypeError(`Route path '${path}' is not valid`);
    if (typeof path !== 'string') throw new TypeError(`Route path ${path} is not valid: a path must be a string`);
    if (path.charAt(0) !== '/') throw new TypeError(`Route path ${path} is not valid: a path must start with '/'`);
    if (path !== '/') {
        while (path.charAt(path.length - 1) === '/') {
            path = path.slice(0, -1);   // removes last character
        }
    }
    return path;
}

function buildCorsHeaders(config: HttpRouteConfig, defaultCors: CorsOptions) {

    // merge default and rout CORS
    const cors = { ...defaultCors, ...config.cors };

    // determine allowed methods
    const methods = ['OPTIONS'];
    if (config.get)     methods.push('GET');
    if (config.post)    methods.push('POST');
    if (config.put)     methods.push('PUT');
    if (config.patch)   methods.push('PATCH');
    if (config.delete)  methods.push('DELETE');

    // build and return CORS headers
    return {
        'Access-Control-Allow-Methods'      : methods.join(','),
        'Access-Control-Allow-Origin'       : cors.origin,
        'Access-Control-Allow-Headers'      : cors.headers.join(','),
        'Access-Control-Allow-Credentials'  : cors.credentials,
        'Access-Control-Max-Age'            : cors.maxAge
    };
}

function buildOpConfig(method: string, path: string, config: HttpEndpointConfig, defaults: HttpEndpointDefaults, cors: StringBag): OperationConfig {

    // determine view
    const view = config.view === undefined ? defaults.view : config.view;
    if (view && !util.isRegularFunction(view)) {
        throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: view builder must be a regular function`);
    }

    // build headers
    let headers = cors;
    if (view) {
        headers = { ...headers, 'Content-Type': 'application/json' };
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
        method          : method,
        path            : path,
        scope           : config.scope === undefined ? defaults.scope : config.scope,
        headers         : headers,
        options         : config.options,
        defaults        : { ...config.defaults },
        parser          : parser,
        validator       : validator,
        authenticator   : authenticator,
        mutator         : mutator,
        actions         : actions,
        view            : view
    };
}

function noop() { };
