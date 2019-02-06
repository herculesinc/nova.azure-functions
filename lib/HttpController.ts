// IMPORTS
// =================================================================================================
import { AzureFunctionContext, AzureHttpRequest, AzureHttpResponse } from 'azure-functions';
import { 
    Action, OperationContext, Executor, Authenticator, ViewBuilder, HttpRequestAdapter, HttpBodyParser, HttpInputProcessor,
    HttpControllerConfig, HttpRouteConfig, HttpEndpointConfig, HttpEndpointDefaults, CorsOptions, StringBag
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
interface OperationConfig<T extends OperationContext, V> {
    method          : string;
    path            : string;
    scope           : string,
    headers         : StringBag;
    options         : V;
    defaults        : object;
    parser          : HttpBodyParser<T>;
    processor       : HttpInputProcessor;
    authenticator   : Authenticator<T>;
    actions         : Action[];
    view            : ViewBuilder;
}

const enum HttpStatusCode {
    OK = 200, NoContent = 204, InternalServerError = 500
}

// CLASS DEFINITION
// =================================================================================================
export class HttpController<T extends OperationContext, V> {

    private readonly routers    : Map<string,Router.Router>;
    private readonly adapter    : HttpRequestAdapter<V>;
    private readonly executor   : Executor<T,V>;
    private readonly defaults   : HttpEndpointDefaults<T>;

    private readonly routerOptions      : Router.RouterConfig;
    private readonly rethrowThreshold   : number;

    constructor(options?: HttpControllerConfig<T,V>) {
        options = processOptions(options);

        this.routers = new Map();
        this.routerOptions = options.routerOptions;
        this.rethrowThreshold = options.rethrowThreshold;

        this.adapter = options.adapter;
        this.executor = options.executor;
        this.defaults = options.defaults;
    }

    set(functionName: string, route: string, config: HttpRouteConfig<T,V>) {

        let router = this.routers.get(functionName);
        if (!router) {
            router = Router(this.routerOptions);
            this.routers.set(functionName, router);
        }

        route = cleanPath(route); // TODO: test for route conflicts?
        const corsHeaders = buildCorsHeaders(config, this.defaults.cors);

        router.on('OPTIONS', route, noop, corsHeaders);

        if (config.get) {
            const operationConfig = buildOpConfig('GET', route, config.get, this.defaults, corsHeaders);
            router.on('GET', route, noop, operationConfig);
        }

        if (config.post) {
            const operationConfig = buildOpConfig('POST', route, config.post, this.defaults, corsHeaders);
            router.on('POST', route, noop, operationConfig);
        }

        if (config.put) {
            const operationConfig = buildOpConfig('PUT', route, config.put, this.defaults, corsHeaders);
            router.on('PUT', route, noop, operationConfig);
        }

        if (config.patch) {
            const operationConfig = buildOpConfig('PATCH', route, config.patch, this.defaults, corsHeaders);
            router.on('PATCH', route, noop, operationConfig);
        }

        if (config.delete) {
            const operationConfig = buildOpConfig('DELETE', route, config.delete, this.defaults, corsHeaders);
            router.on('DELETE', route, noop, operationConfig);
        }
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
        
        let executed = false;
        let opContext: T = undefined;
        const opConfig = route.store as OperationConfig<T,V>;
        try {
            // 1 ----- create operation context
            const reqHead = {
                route   : opConfig.path,
                method  : request.method,
                headers : request.headers,
                ip      : util.getIpAddress(request.headers),
                url     : request.originalUrl
            };
            const opContextConfig = this.adapter(reqHead, context, opConfig.options);
            opContext = await this.executor.createContext(opContextConfig);

            // 2 ----- parse request body
            let body = undefined;
            if (opConfig.parser) {
                body = await opConfig.parser(request, opContext);
                if (typeof body !== 'object') throw new Error('Invalid value received from body parser');
            }
            else if (request.body) {
                const contentType = request.headers['content-type'] || request.headers['Content-Type'];
                if (typeIs.is(contentType, JSON_CONTENT)) {
                    body = request.body;
                }
                else {
                    // content type not supported - return error
                    return defaults.invalidContentResponse;
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
                actionInputs = { ...opConfig.defaults, ...request.query, ...route.params, ...body };
            }

            // 4 ----- authenticate the request
            let requestor = undefined;
            if (opConfig.authenticator) {
                const credentials = util.parseAuthHeader(request.headers);
                if (credentials === null) {
                    // auth header could not be parsed
                    return defaults.invalidAuthHeaderResponse;
                }
                requestor = await opConfig.authenticator(opConfig.scope, credentials, opContext); 
            }

            // 5 ----- execute actions
            const result = await this.executor.execute(opConfig.actions, actionInputs, opContext);
            executed = true;

            // 6 ------ close the context
            await this.executor.closeContext(opContext);

            // 7 ----- build the response
            let response: AzureHttpResponse;
            if (!result || !opConfig.view) {
                response = {
                    status  : HttpStatusCode.NoContent,
                    headers : opConfig.headers,
                    body    : null
                };
            }
            else {

                const view = opConfig.view(result, viewOptions, {
                    viewer      : requestor,
                    timestamp   : opContext.timestamp
                });

                if (!view) {
                    response =  {
                        status  : HttpStatusCode.NoContent,
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
            opContext.log.close(response.status, true);
            return response;
        }
        catch(error) {

            // determine error status
            const status = error.status || HttpStatusCode.InternalServerError;

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
                    }
                }

                // mark the request as closed
                opContext.log.close(status, false);
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
function processOptions(options: HttpControllerConfig<any,any>): HttpControllerConfig<any,any> {
    if (!options) return defaults.httpController;

    let newOptions: HttpControllerConfig<any, any> = {
        adapter         : options.adapter || defaults.httpController.adapter,
        executor        : options.executor || defaults.httpController.executor,
        routerOptions   : options.routerOptions,
        rethrowThreshold: options.rethrowThreshold || defaults.httpController.rethrowThreshold,
        defaults        : undefined,
    };

    if (options.defaults) {
        newOptions.defaults = { ...defaults.httpController.defaults, ...options.defaults, ...{
            cors    : { ...defaults.httpController.defaults.cors, ...options.defaults.cors },
            inputs  : { ...defaults.httpController.defaults.inputs, ...options.defaults.inputs }
        } };
    }
    else {
        newOptions.defaults = defaults.httpController.defaults;
    }

    return newOptions;
}

function cleanPath(path: string) {
    if (!path) throw new TypeError(`Route path '${path}' is not valid`);
    if (typeof path !== 'string') throw new TypeError(`Route path must be a string`);
    if (path.charAt(0) !== '/') throw new TypeError(`Route path must start with '/'`);
    if (path !== '/') {
        while (path.charAt(path.length - 1) === '/') {
            path = path.slice(0, -1);   // removes last character
        }
    }
    return path;
}

function buildCorsHeaders(config: HttpRouteConfig<any,any>, defaultCors: CorsOptions) {

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

function buildOpConfig(method: string, path: string, config: HttpEndpointConfig<any,any>, defaults: HttpEndpointDefaults<any>, cors: StringBag): OperationConfig<any, any> {

    // determine view
    const view = config.view === undefined ? defaults.view : config.view;

    // build headers
    let headers = cors;
    if (view) {
        headers = { ...headers, 'Content-Type': 'application/json' };
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
        method          : method,
        path            : path,
        scope           : config.scope === undefined ? defaults.scope : config.scope,
        headers         : headers,
        options         : config.options,
        defaults        : { ...defaults.inputs, ...config.defaults },
        parser          : config.body,
        processor       : config.inputs,
        authenticator   : config.auth === undefined ? defaults.auth : config.auth,
        actions         : actions,
        view            : view
    };
}

function noop() { };