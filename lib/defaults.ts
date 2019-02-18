// IMPORTS
// =================================================================================================
import { Operation, HttpStatusCode } from '@nova/core';
import { AzureHttpResponse, AzureFunctionContext } from 'azure-functions';
import {
    HttpControllerConfig, HttpRequestHead, MultipartDefaults, Action,
    QueueControllerConfig, TimerControllerConfig, Logger, TraceSource, TraceCommand
} from '@nova/azure-functions';

// INTERFACES
// =================================================================================================
interface Defaults {
    httpController              : HttpControllerConfig;
    queueController             : QueueControllerConfig;
    timerController             : TimerControllerConfig;
    multipartParser             : MultipartDefaults;
    notFoundResponse            : AzureHttpResponse;
    invalidContentResponse      : AzureHttpResponse;
    invalidAuthHeaderResponse   : AzureHttpResponse;
}

// MODULE VARIABLES
// =================================================================================================
export const defaults: Defaults = {
    httpController: {
        adapter             : defaultHttpOperationAdapter,
        routerOptions       : undefined,    // using find-my-way defaults
        rethrowThreshold    : HttpStatusCode.InternalServerError,
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
        adapter             : defaultQueueOperationAdapter
    },
    timerController: {
        adapter             : defaultTimerOperationAdapter
    },
    multipartParser         : { },  // using busboy defaults
    notFoundResponse: {
        status              : HttpStatusCode.NotFound,
        body                : null 
    },
    invalidContentResponse: {
        status              : HttpStatusCode.UnsupportedContent,
        body                : null 
    },
    invalidAuthHeaderResponse: {
        status              : HttpStatusCode.Unauthorized,
        body                : null
    }
}

export const symbols = {
    responseStatus      : Symbol('Response status symbol'),
    responseHeaders     : Symbol('Response headers symbol')
};

// DEFAULT FUNCTIONS
// =================================================================================================
function defaultHttpOperationAdapter(context: AzureFunctionContext, request: HttpRequestHead, actions: Action[]): Operation {
    const functionName = context.executionContext.functionName;
    const operationName = request.method + ' /' + functionName + request.route;

    const config = {
        id          : context.invocationId,
        name        : operationName,
        origin      : request.ip || 'unknown',
        actions     : actions
    };
    const logger = buildDefaultLogger(context, operationName);

    return new Operation(config, undefined, logger);
}

function defaultQueueOperationAdapter(context: AzureFunctionContext, actions: Action[]): Operation {
    const operationName = context.executionContext.functionName;

    const config = {
        id          : context.invocationId,
        name        : operationName,
        origin      : 'undefined',
        actions     : actions
    };
    const logger = buildDefaultLogger(context, operationName);

    return new Operation(config, undefined, logger);
}

function defaultTimerOperationAdapter(context: AzureFunctionContext, actions: Action[]): Operation {
    const operationName = context.executionContext.functionName;

    const config = {
        id          : context.invocationId,
        name        : operationName,
        origin      : 'timer',
        actions     : actions
    };
    const logger = buildDefaultLogger(context, operationName);

    return new Operation(config, undefined, logger);
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

        debug   : (message: string) => azLogger.verbose(message),
        info    : (message: string) => azLogger.info(message),
        warn    : (message: string) => azLogger.warn(message),
        error   : (error: Error) => azLogger.error(error && error.message),
        trace   : (source: TraceSource, command: string | TraceCommand, duration: number, success: boolean) => {
            if (typeof command === 'string') {
                command = { name: command };
            }

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