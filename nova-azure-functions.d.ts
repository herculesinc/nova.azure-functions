/// <reference path="./typings/azure-functions.d.ts" />

declare module "@nova/azure-functions" {

    // IMPORTS AND RE-EXPORTS
    // --------------------------------------------------------------------------------------------
    import { Executable, Context, Action } from '@nova/core';
    export { Operation, Action, Logger, TraceSource, TraceCommand } from '@nova/core';

    import { AzureFunctionContext, AzureHttpRequest, AzureHttpResponse, HttpMethod } from 'azure-functions';
    export { AzureFunctionContext, AzureHttpRequest, AzureHttpResponse, HttpMethod } from 'azure-functions';

    // GLOBALS
    // --------------------------------------------------------------------------------------------
    export const symbols: {
        readonly responseStatus  : Symbol;
        readonly responseHeaders : Symbol;
    };

    export const parsers: {
        multipart       : (config?: Partial<MultipartConfig>) => HttpInputParser;
    };

    // HTTP CONTROLLER
    // --------------------------------------------------------------------------------------------
    export interface HttpControllerConfig {
        adapter             : HttpOperationAdapter;
        routerOptions       : HttpRouterConfig;
        rethrowThreshold    : number;
        defaults            : HttpEndpointDefaults;
    }

    export interface HttpRouterConfig {
        ignoreTrailingSlash?    : boolean;
        maxParamLength?         : number;
        allowUnsafeRegex?       : boolean;
    }

    export interface HttpOperationAdapter {
        (context: AzureFunctionContext, request: HttpRequestHead, actions: Action[], options?: HttpRequestOptions): Executable & Context;
    }

    export interface HttpRequestHead {
        route       : string;
        method      : HttpMethod;
        headers     : StringBag;
        ip          : string;
        url         : string;
    }

    export interface HttpRequestOptions {
        readonly?   : boolean;
    }

    export interface HttpEndpointDefaults {
        cors?       : CorsOptions;
        scope?      : string;
        auth?       : Authenticator;
        mutator?    : HttpInputMutator;
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
        (this: Context, request: AzureHttpRequest, params?: any, defaults?: any): Promise<any>;
    }

    export interface HttpInputValidator {
        (this: Context, inputs: any): any;
    }

    export interface HttpInputMutator {
        (this: Context, inputs: any, auth?: any): HttpInputMutatorResult;
    }

    export interface HttpInputMutatorResult {
        action? : any;
        view?   : any;
    }

    export interface HttpSegment {
        set(path: string, config: HttpRouteConfig): void;
    }

    export class HttpController {

        constructor(options?: Partial<HttpControllerConfig>);

        set(path: string, config: HttpRouteConfig)              : void;
        segment(root: string, defaults?: HttpEndpointDefaults)  : HttpSegment

        handler(context: AzureFunctionContext, request: AzureHttpRequest): Promise<AzureHttpResponse>;
    }

    // QUEUE CONTROLLER
    // --------------------------------------------------------------------------------------------
    export interface QueueControllerConfig {
        adapter?    : QueueOperationAdapter;
    }

    export interface QueueOperationAdapter {
        (context: AzureFunctionContext, actions: Action[], options?: QueueTaskOptions, correlationId?: string): Executable & Context;
    }

    export interface QueueTaskOptions {}

    export interface QueueTaskConfig {
        options?    : any;
        defaults?   : any;
        inputs?     : QueueInputProcessor;
        action?     : Action;
        actions?    : Action[];
    }

    export interface QueueInputProcessor {
        (this: Context, message: any, defaults: any, meta: QueueMessageMetadata): Promise<any>;
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

        set(timerConfig: TimerHandlerConfig): void;

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
        limits          : Partial<MultipartLimits>;
        filter          : MultipartFilter | MultipartFilter[];
    }

    export interface MultipartLimits {
        fieldNameSize   : number;
        fieldSize       : number;
        fields          : number;
        fileSize        : number;
        files           : number;
        parts           : number;
        headerPairs     : number;
    }

    export interface MultipartFilter {
        field           : string;
        maxCount?       : number;
    }

    // VIEWS
    // --------------------------------------------------------------------------------------------
    export interface ViewBuilder {
        (this: ViewContext, result: any, options?: any): any;
    }

    export interface ViewContext {
        auth?       : any;
        timestamp   : number;
    }

    // AUTHENTICATOR
    // --------------------------------------------------------------------------------------------
    export interface Authenticator<T=any> {
        (this: Context, scope: string, credentials: Credentials): Promise<T>;
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

    export interface Logger {

        readonly operationId?   : string;
        authenticatedUserId?    : string;

        close(resultCode: number, success: boolean, properties?: { [key: string]: string; } ): void;
    }
}
