declare module "@nova/azure-functions" {
    
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
        multipart       : HttpInputParser<OperationContext>;
    };

    // EXECUTOR
    // --------------------------------------------------------------------------------------------
    export interface Executor <T extends OperationContext, V> {
        
        createContext(options: OperationContextConfig<V>): Promise<T>;
        closeContext(context: T, error?: Error): Promise<void>;

        execute(actions: Action[], inputs: any, context?: T): Promise<any>;
    }
    
    export interface Action {
        (inputs: any, context?: OperationContext): Promise<any>
    }

    export interface OperationContext {
        readonly id         : string;
        readonly name       : string;
        readonly origin     : string;
        readonly timestamp  : number;
        readonly log        : Logger;
    }

    export interface OperationContextConfig<V> {
        readonly id         : string;
        readonly name       : string;
        readonly origin     : string;
        readonly logger     : Logger;
        readonly options?   : V;
    }

    // HTTP CONTROLLER
    // --------------------------------------------------------------------------------------------
    export interface HttpControllerConfig<T extends OperationContext, V> {
        adapter?            : HttpRequestAdapter<V>;
        executor?           : Executor<T, V>;
        routerOptions?      : HttpRouterConfig;
        rethrowThreshold?   : number;
        defaults?           : HttpEndpointDefaults<T>;
    }

    export interface HttpRouterConfig {
        ignoreTrailingSlash?    : boolean;
        maxParamLength?         : boolean;
        allowUnsafeRegex?       : boolean;
    }

    export interface HttpRequestAdapter<V> {
        (request: HttpRequestHead, context: AzureFunctionContext, options?: V): OperationContextConfig<V>;
    }

    export interface HttpRequestHead {
        route       : string;
        method      : string;
        headers     : StringBag;
        ip          : string;
        url         : string;
    }

    export interface HttpEndpointDefaults<T extends OperationContext> {
        scope?      : string;
        cors?       : CorsOptions;
        inputs?     : object;
        auth?       : Authenticator<T>;
        view?       : ViewBuilder;
    }

    export interface HttpRouteConfig<T extends OperationContext, V> {
        get?    : HttpEndpointConfig<T,V>;
        post?   : HttpEndpointConfig<T,V>;
        put?    : HttpEndpointConfig<T,V>;
        patch?  : HttpEndpointConfig<T,V>;
        delete? : HttpEndpointConfig<T,V>;
        cors?   : CorsOptions;
    }

    export interface HttpEndpointConfig<T extends OperationContext, V> {
        scope?      : string;
        options?    : V;
        defaults?   : object;
        inputs?     : HttpInputParser<T>;
        schema?     : HttpInputValidator;
        auth?       : Authenticator<T>;
        mutator?    : HttpInputMutator<T>;
        action?     : Action;
        actions?    : Action[];
        view?       : ViewBuilder;
    }

    export interface HttpInputParser<T extends OperationContext> {
        (request: AzureHttpRequest, params?: object, defaults?: object, context?: T): Promise<object>;
    }

    export interface HttpInputValidator {
        (inputs: object): object;
    }

    export interface HttpInputMutator<T extends OperationContext> {
        (inputs: object, auth?: any, context?: T): Promise<HttpInputMutatorResult>;
    }

    export interface HttpInputMutatorResult {
        action? : object;
        view?   : object;
    }

    export class HttpController<T extends OperationContext, V> {

        constructor(options?: HttpControllerConfig<T,V>);

        set(functionName: string, path: string, config: HttpRouteConfig<T,V>): void;

        handler(context: AzureFunctionContext, request: AzureHttpRequest): Promise<AzureHttpResponse>;
    }

    // QUEUE CONTROLLER
    // --------------------------------------------------------------------------------------------
    export interface QueueControllerConfig<T extends OperationContext, V> {
        adapter?    : QueueAdapter<V>;
        executor?   : Executor<T, V>;
    }

    export interface QueueAdapter<V> {
        (context: AzureFunctionContext, options?: V): OperationContextConfig<V>;
    }

    export interface QueueTaskConfig<T extends OperationContext, V> {
        options?    : V;
        defaults?   : object;
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

    export class QueueController<T extends OperationContext, V> {

        constructor(options?: QueueControllerConfig<T,V>);

        set(functionName: string, taskConfig: QueueTaskConfig<T,V>) : void;

        handler(context: AzureFunctionContext, message: object): Promise<void>;
    }

    // TIMER CONTROLLER
    // --------------------------------------------------------------------------------------------
    export interface TimerControllerConfig<T extends OperationContext, V> {
        adapter?    : TimerAdapter<V>;
        executor?   : Executor<T, V>;
    }

    export interface TimerAdapter<V> {
        (context: AzureFunctionContext, options?: V): OperationContextConfig<V>;
    }

    export interface TimerHandlerConfig<T extends OperationContext, V> {
        options?    : V;
        defaults?   : object;
        action?     : Action;
        actions?    : Action[];
    }

    export class TimerController<T extends OperationContext, V> {

        constructor(options?: TimerControllerConfig<T,V>);

        set(timerConfig: TimerHandlerConfig<T,V>);

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
    export interface Authenticator<T extends OperationContext> {
        (scope: string, credentials: Credentials, context?: T): Promise<any>;
    }

    export interface Credentials {
        readonly type       : string;
        readonly data       : string;
    }

    // LOGGER
    // --------------------------------------------------------------------------------------------
    export interface TraceSource {
        readonly name   : string;
        readonly type   : string;
    }

    export interface TraceCommand {
        readonly name   : string;
        readonly text   : string;
    }

    export interface Logger {

        readonly operationId    : string;
        authenticatedUserId?    : string;

        debug(message: string)  : void;
        info(message: string)   : void;
        warn(message: string)   : void;

        error(error: Error)     : void;

        trace(source: TraceSource, command: TraceCommand, duration: number, success: boolean): void;

        close(resultCode: number, success: boolean, properties?: StringBag): void;
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