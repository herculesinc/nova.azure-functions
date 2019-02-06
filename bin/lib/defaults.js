"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// MODULE VARIABLES
// =================================================================================================
exports.defaults = {
    httpController: {
        adapter: defaultHttpContextAdapter,
        executor: {
            createContext: defaultContextBuilder,
            closeContext: defaultContextCloser,
            execute: defaultActionExecutor
        },
        rethrowThreshold: 500,
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
        adapter: defaultTaskContextAdapter,
        executor: {
            createContext: defaultContextBuilder,
            closeContext: defaultContextCloser,
            execute: defaultActionExecutor
        },
    },
    timerController: {
        adapter: defaultChronContextAdapter,
        executor: {
            createContext: defaultContextBuilder,
            closeContext: defaultContextCloser,
            execute: defaultActionExecutor
        },
    },
    multipartParser: {},
    notFoundResponse: {
        status: 404,
        body: null
    },
    invalidContentResponse: {
        status: 415,
        body: null
    },
    invalidAuthHeaderResponse: {
        status: 420,
        body: null
    }
};
exports.symbols = {
    responseStatus: Symbol('Response status symbol'),
    responseHeaders: Symbol('Response headers symbol')
};
// DEFAULT FUNCTIONS
// =================================================================================================
function defaultHttpContextAdapter(request, context, options) {
    const functionName = context.executionContext.functionName;
    const operationName = request.method + ' /' + functionName + request.route;
    return {
        id: context.invocationId,
        name: operationName,
        origin: request.ip || 'unknown',
        logger: buildDefaultLogger(context, operationName)
    };
}
function defaultTaskContextAdapter(context, options) {
    const operationName = context.executionContext.functionName;
    return {
        id: context.invocationId,
        name: operationName,
        origin: 'undefined',
        logger: buildDefaultLogger(context, operationName)
    };
}
function defaultChronContextAdapter(context, options) {
    const operationName = context.executionContext.functionName;
    return {
        id: context.invocationId,
        name: operationName,
        origin: 'timer',
        logger: buildDefaultLogger(context, operationName)
    };
}
function defaultContextBuilder(options) {
    return Promise.resolve({
        id: options.id,
        name: options.name,
        origin: options.origin,
        timestamp: Date.now(),
        log: options.logger
    });
}
function defaultContextCloser(context, error) {
    return Promise.resolve();
}
async function defaultActionExecutor(actions, inputs, context) {
    let result = inputs;
    for (let action of actions) {
        result = await action(result, context);
    }
    return result;
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
        debug: message => azLogger.verbose(message),
        info: message => azLogger.info(message),
        warn: message => azLogger.warn(message),
        error: error => azLogger.error(error && error.message),
        trace: (source, command, duration, success) => {
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