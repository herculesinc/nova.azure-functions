// IMPORTS
// =================================================================================================
import { AzureHttpResponse, AzureFunctionContext } from 'azure-functions';
import {
    HttpControllerConfig, HttpRequestHead, Action, MultipartDefaults, OperationContext,
    OperationContextConfig, QueueControllerConfig, TimerControllerConfig, Logger, TraceSource, TraceCommand
} from '@nova/azure-functions';

// INTERFACES
// =================================================================================================
interface Defaults {
    httpController              : HttpControllerConfig<OperationContext,void>;
    queueController             : QueueControllerConfig<OperationContext,void>;
    timerController             : TimerControllerConfig<OperationContext,void>;
    multipartParser             : MultipartDefaults;
    notFoundResponse            : AzureHttpResponse;
    invalidContentResponse      : AzureHttpResponse;
    invalidAuthHeaderResponse   : AzureHttpResponse;
}

// MODULE VARIABLES
// =================================================================================================
export const defaults: Defaults = {
    httpController: {
        adapter             : defaultHttpContextAdapter,
        executor: {
            createContext   : defaultContextBuilder,
            closeContext    : defaultContextCloser,
            execute         : defaultActionExecutor
        },
        defaults: {
            cors: {
                origin      : '*',
                headers     : ['authorization', 'content-type', 'accept', 'x-requested-with', 'cache-control'],
                credentials : 'true',
                maxAge      : '1000000000'
            },
            view            : defaultView
        }
    },
    queueController: {
        adapter             : defaultTaskContextAdapter,
        executor: {
            createContext   : defaultContextBuilder,
            closeContext    : defaultContextCloser,
            execute         : defaultActionExecutor
        },
    },
    timerController: {
        adapter             : defaultChronContextAdapter,
        executor: {
            createContext   : defaultContextBuilder,
            closeContext    : defaultContextCloser,
            execute         : defaultActionExecutor
        },
    },
    multipartParser         : { },  // using busboy defaults
    notFoundResponse: {
        status              : 404,
        body                : null 
    },
    invalidContentResponse: {
        status              : 415,
        body                : null 
    },
    invalidAuthHeaderResponse: {
        status              : 420,
        body                : null
    }
}

export const symbols = {
    responseStatus      : Symbol('Response status symbol'),
    responseHeaders     : Symbol('Response headers symbol')
};

// DEFAULT FUNCTIONS
// =================================================================================================
function defaultHttpContextAdapter(request: HttpRequestHead, context: AzureFunctionContext, options: any): OperationContextConfig<any> {
    const functionName = context.executionContext.functionName;
    const operationName = request.method + '/' + functionName + '/' + request.route;
    return {
        id          : context.invocationId,
        name        : operationName,
        origin      : request.ip || 'unknown',
        logger      : buildDefaultLogger(context, operationName)
    };
}

function defaultTaskContextAdapter(context: AzureFunctionContext, options: any): OperationContextConfig<any> {
    const operationName = context.executionContext.functionName;
    return {
        id          : context.invocationId,
        name        : operationName,
        origin      : 'undefined',
        logger      : buildDefaultLogger(context, operationName)
    };
}

function defaultChronContextAdapter(context: AzureFunctionContext, options: any): OperationContextConfig<any> {
    const operationName = context.executionContext.functionName;
    return {
        id          : context.invocationId,
        name        : operationName,
        origin      : 'timer',
        logger      : buildDefaultLogger(context, operationName)
    };
}

function defaultContextBuilder(options: OperationContextConfig<any>) {
    return Promise.resolve({
        id          : options.id,
        name        : options.name,
        origin      : options.origin,
        timestamp   : Date.now(),
        log         : options.logger
    });
}

function defaultContextCloser(context: OperationContext, error?: Error) {
    return Promise.resolve();
}

async function defaultActionExecutor(actions: Action[], inputs: any, context: any) {
    let result = inputs;
    for (let action of actions) {
        result = await action(result, context);
    }
    return result;
}

function defaultView(result: any): any {
    return result;
}

// HELPER FUNCTIONS
// =================================================================================================
function buildDefaultLogger(context: AzureFunctionContext, operationName: string): Logger {

    const startTime = Date.now();
    const azLogger = context.log;
    return {
        operationId         : context.invocationId,
        authenticatedUserId : undefined,

        debug   : message => azLogger.verbose(message),
        info    : message => azLogger.info(message),
        warn    : message => azLogger.warn(message),
        error   : error => azLogger.error(error && error.message),
        trace   : (source: TraceSource, command: TraceCommand, duration: number, success: boolean) => {
            if (success) {
                azLogger.info(`Executed ${source.name} ${command.name} command in ${duration}ms`);
            }
            else {
                azLogger.info(`Failed to execute ${source.name} ${command.name} command in ${duration}ms`);
            }
        },
        close   : (resultCode: number, success: boolean, properties?: { [key: string]: string; }) => {
            if (success) {
                azLogger.info(`Executed ${operationName} operation in ${Date.now() - startTime}ms`);
            }
            else {
                azLogger.info(`Failed to execute ${operationName} operation in ${Date.now() - startTime}ms`);
            }
        }
    };
}