declare module "@nova/azure-functions" {
    
    // IMPORTS AND RE-EXPORTS
    // --------------------------------------------------------------------------------------------
    import { Executable, Context, Action } from '@nova/core';
    export { Operation, Action, Logger, TraceSource, TraceCommand } from '@nova/core';

    // AZURE FUNCTION INTERFACES
    // --------------------------------------------------------------------------------------------
    type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

    export interface AzureFunctionContext {
        readonly invocationId       : string;
        readonly executionContext   : any;
        readonly bindings           : { [key: string]: any; };
        readonly bindingData?       : any;
        readonly bindingDefinitions : any;
        readonly log                : any;
        done(error?: Error, response?: AzureHttpResponse): void;
    }

    export interface AzureHttpRequest {
        
        readonly method: HttpMethod;
        readonly url: string;
        readonly originalUrl: string;
        readonly headers: { [header: string]: string; };
        readonly query?: { [param: string]: string; };
        readonly params?: { [param: string]: string; };
        readonly body?: object | Buffer | string;
        readonly rawBody?: string;
    }

    export interface AzureHttpResponse {
        readonly status         : number;
        readonly headers?       : { [header: string] : string; }
        readonly body?          : object | Buffer;
        readonly isRaw?         : boolean;    
    }

    // GLOBALS
    // --------------------------------------------------------------------------------------------
    export const symbols: {
        readonly responseStatus  : Symbol;
        readonly responseHeaders : Symbol;
    };

    export const parsers: {
        multipart       : HttpInputParser;
    };

    // HTTP CONTROLLER
    // --------------------------------------------------------------------------------------------
    export interface HttpControllerConfig {
        adapter?            : HttpOperationAdapter;
        routerOptions?      : HttpRouterConfig;
        rethrowThreshold?   : number;
        defaults?           : HttpEndpointDefaults;
    }

    export interface HttpRouterConfig {
        ignoreTrailingSlash?    : boolean;
        maxParamLength?         : boolean;
        allowUnsafeRegex?       : boolean;
    }

    export interface HttpOperationAdapter {
        (context: AzureFunctionContext, request: HttpRequestHead, actions: Action[], options?: any): Executable & Context;
    }

    export interface HttpRequestHead {
        route       : string;
        method      : string;
        headers     : StringBag;
        ip          : string;
        url         : string;
    }

    export interface HttpEndpointDefaults {
        scope?      : string;
        cors?       : CorsOptions;
        inputs?     : object;
        auth?       : Authenticator;
        view?       : ViewBuilder;
    }

    export interface HttpRouteConfig {
        get?    : HttpEndpointConfig;
        post?   : HttpEndpointConfig;
        put?    : HttpEndpointConfig;
        patch?  : HttpEndpointConfig;
        delete? : HttpEndpointConfig;
        cors?   : CorsOptions;
    }

    export interface HttpEndpointConfig {
        scope?      : string;
        options?    : any;
        defaults?   : any;
        inputs?     : HttpInputParser;
        schema?     : HttpInputValidator;
        auth?       : Authenticator;
        mutator?    : HttpInputMutator;
        action?     : Action;
        actions?    : Action[];
        view?       : ViewBuilder;
    }

    export interface HttpInputParser {
        (this: Context, request: AzureHttpRequest, params?: any, defaults?: any): Promise<object>;
    }

    export interface HttpInputValidator {
        (inputs: object): object;
    }

    export interface HttpInputMutator {
        (this: Context, inputs: any, auth?: any): Promise<HttpInputMutatorResult>;
    }

    export interface HttpInputMutatorResult {
        action? : object;
        view?   : object;
    }

    export class HttpController {

        constructor(options?: HttpControllerConfig);

        set(functionName: string, path: string, config: HttpRouteConfig): void;

        handler(context: AzureFunctionContext, request: AzureHttpRequest): Promise<AzureHttpResponse>;
    }

    // QUEUE CONTROLLER
    // --------------------------------------------------------------------------------------------
    export interface QueueControllerConfig {
        adapter?    : QueueOperationAdapter;
    }

    export interface QueueOperationAdapter {
        (context: AzureFunctionContext, actions: Action[], options?: any): Executable & Context;
    }

    export interface QueueTaskConfig {
        options?    : any;
        defaults?   : any;
        inputs?     : QueueInputProcessor;
        action?     : Action;
        actions?    : Action[];
    }

    export interface QueueInputProcessor {
        (message: object, defaults: object, meta: QueueMessageMetadata): object;
    }

    export interface QueueMessageMetadata {
        messageId       : string;
        insertionTime   : number;
        expirationTime  : number;
        nextVisibleTime : number;
        dequeueCount    : number;
        popReceipt      : string;
    }

    export class QueueController {

        constructor(options?: QueueControllerConfig);

        set(functionName: string, taskConfig: QueueTaskConfig) : void;

        handler(context: AzureFunctionContext, message: any): Promise<void>;
    }

    // TIMER CONTROLLER
    // --------------------------------------------------------------------------------------------
    export interface TimerControllerConfig {
        adapter?    : TimerOperationAdapter;
    }

    export interface TimerOperationAdapter {
        (context: AzureFunctionContext, actions: Action[], options?: any): Executable & Context;
    }

    export interface TimerHandlerConfig {
        options?    : any;
        defaults?   : any;
        action?     : Action;
        actions?    : Action[];
    }

    export class TimerController {

        constructor(options?: TimerControllerConfig);

        set(timerConfig: TimerHandlerConfig);

        handler(context: AzureFunctionContext, timer: any): Promise<void>;
    }

    // MULTIPART
    // --------------------------------------------------------------------------------------------
    export interface MultipartDefaults {
        bodyHighWaterMark?  : number;
        fileHighWaterMark?  : number;
        defaultCharset?     : string;
        preservePath?       : string;
        limits?             : MultipartLimits;
    }

    export interface MultipartConfig {
        limits?         : MultipartLimits;
        filter?         : MultipartFilter | MultipartFilter[];
    }

    export interface MultipartLimits {
        fieldNameSize?  : number;
        fieldSize       : number;
        fields?         : number;
        fileSize?       : number;
        files?          : number;
        parts?          : number;
        headerPairs?    : number;
    }

    export interface MultipartFilter {
        field           : string;
        maxCount?       : number;
    }

    // VIEWS
    // --------------------------------------------------------------------------------------------
    export interface ViewBuilder {
        (result: any, options?: any, context?: ViewContext): any;
    }

    export interface ViewContext {
        viewer?     : any;      // TODO: change to auth?
        timestamp   : number;
    }

    // AUTHENTICATOR
    // --------------------------------------------------------------------------------------------
    export interface Authenticator {
        (this: Context, scope: string, credentials: Credentials): Promise<any>;
    }

    export interface Credentials {
        readonly type       : string;
        readonly data       : string;
    }

    // COMMON INTERFACES
    // --------------------------------------------------------------------------------------------
    export interface StringBag {
        [key: string]: string;
    }

    export interface CorsOptions {
        origin      : string;
        headers     : string[];
        credentials : string;
        maxAge      : string;
    }
}

declare module '@nova/core' {

    export interface TraceSource {
        readonly name   : string;
        readonly type   : string;
    }

    export interface TraceCommand {
        readonly name   : string;
        readonly text?  : string;
    }

    export interface Logger {

        readonly operationId    : string;
        authenticatedUserId?    : string;

        debug(message: string)  : void;
        info(message: string)   : void;
        warn(message: string)   : void;

        error(error: Error)     : void;

        trace(source: TraceSource, command: string, duration: number, success: boolean): void;
        trace(source: TraceSource, command: TraceCommand, duration: number, success: boolean): void;

        close(resultCode: number, success: boolean, properties?: { [key: string]: string; } ): void;
    }
}