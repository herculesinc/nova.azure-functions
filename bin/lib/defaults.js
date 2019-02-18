"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTS
// =================================================================================================
const core_1 = require("@nova/core");
// MODULE VARIABLES
// =================================================================================================
exports.defaults = {
    httpController: {
        adapter: defaultHttpOperationAdapter,
        routerOptions: undefined,
        rethrowThreshold: 500 /* InternalServerError */,
        defaults: {
            cors: {
                origin: '*',
                headers: ['authorization', 'content-type', 'accept', 'x-requested-with', 'cache-control'],
                credentials: 'true',
                maxAge: '1000000000'
            },
            view: defaultView
        }
    },
    queueController: {
        adapter: defaultQueueOperationAdapter
    },
    timerController: {
        adapter: defaultTimerOperationAdapter
    },
    multipartParser: {},
    notFoundResponse: {
        status: 404 /* NotFound */,
        body: null
    },
    invalidContentResponse: {
        status: 415 /* UnsupportedContent */,
        body: null
    },
    invalidAuthHeaderResponse: {
        status: 401 /* Unauthorized */,
        body: null
    }
};
exports.symbols = {
    responseStatus: Symbol('Response status symbol'),
    responseHeaders: Symbol('Response headers symbol')
};
// DEFAULT FUNCTIONS
// =================================================================================================
function defaultHttpOperationAdapter(context, request, actions) {
    const functionName = context.executionContext.functionName;
    const operationName = request.method + ' /' + functionName + request.route;
    const config = {
        id: context.invocationId,
        name: operationName,
        origin: request.ip || 'unknown',
        actions: actions
    };
    const logger = buildDefaultLogger(context, operationName);
    return new core_1.Operation(config, undefined, logger);
}
function defaultQueueOperationAdapter(context, actions) {
    const operationName = context.executionContext.functionName;
    const config = {
        id: context.invocationId,
        name: operationName,
        origin: 'undefined',
        actions: actions
    };
    const logger = buildDefaultLogger(context, operationName);
    return new core_1.Operation(config, undefined, logger);
}
function defaultTimerOperationAdapter(context, actions) {
    const operationName = context.executionContext.functionName;
    const config = {
        id: context.invocationId,
        name: operationName,
        origin: 'timer',
        actions: actions
    };
    const logger = buildDefaultLogger(context, operationName);
    return new core_1.Operation(config, undefined, logger);
}
function defaultView(result) {
    return result;
}
// HELPER FUNCTIONS
// =================================================================================================
function buildDefaultLogger(context, operationName) {
    const startTime = Date.now();
    const azLogger = context.log;
    return {
        operationId: context.invocationId,
        authenticatedUserId: undefined,
        debug: (message) => azLogger.verbose(message),
        info: (message) => azLogger.info(message),
        warn: (message) => azLogger.warn(message),
        error: (error) => azLogger.error(error && error.message),
        trace: (source, command, duration, success) => {
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
        close: (resultCode, success, properties) => {
            if (success) {
                azLogger.info(`Executed ${operationName} operation in ${Date.now() - startTime}ms`);
            }
            else {
                azLogger.info(`Failed to execute ${operationName} operation in ${Date.now() - startTime}ms`);
            }
        }
    };
}
//# sourceMappingURL=defaults.js.map