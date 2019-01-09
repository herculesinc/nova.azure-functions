"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const defaults_1 = require("./defaults");
// CLASS DEFINITION
// =================================================================================================
class TimerController {
    constructor(options) {
        options = processOptions(options);
        this.handlers = new Map();
        this.adapter = options.adapter;
        this.executor = options.executor;
    }
    set(functionName, taskConfig) {
        if (this.handlers.has(functionName)) {
            throw new TypeError(`Timer handler for '${functionName}' has already been registered`);
        }
        const opConfig = buildOpConfig(functionName, taskConfig);
        this.handlers.set(functionName, opConfig);
    }
    async handler(context, message) {
        // 0 ----- make sure the task can be handled
        const functionName = context.executionContext.functionName;
        const opConfig = this.handlers.get(functionName);
        if (!opConfig) {
            throw new Error(`Task handler for '${functionName}' could not be found`);
        }
        let executed = false;
        let opContext = undefined;
        try {
            // 1 ----- create operation context
            const opContextConfig = this.adapter(context, opConfig.options);
            opContext = await this.executor.createContext(opContextConfig);
            // 2 ----- execute actions
            const result = await this.executor.execute(opConfig.actions, undefined, opContext);
            executed = true;
            // 3 ------ close the context
            await this.executor.closeContext(opContext);
            // return the result
            return result;
        }
        catch (error) {
            // if the context hasn't been closed yet - close it
            if (opContext && !executed) {
                await this.executor.closeContext(opContext, error);
            }
            throw error;
        }
    }
}
exports.TimerController = TimerController;
// HELPER FUNCTIONS
// =================================================================================================
function processOptions(options) {
    if (!options)
        return defaults_1.defaults.timerController;
    let newOptions = {
        adapter: options.adapter || defaults_1.defaults.timerController.adapter,
        executor: options.executor || defaults_1.defaults.timerController.executor
    };
    return newOptions;
}
function buildOpConfig(functionName, taskConfig) {
    // validate and build actions
    const actions = [];
    if (taskConfig.action) {
        if (typeof taskConfig.action !== 'function') {
            throw new TypeError(`Invalid definition for '${functionName}' timer handler: action must be a function`);
        }
        else if (taskConfig.actions) {
            throw new TypeError(`Invalid definition for '${functionName}' timer handler: 'action' and 'actions' cannot be provided at the same time`);
        }
        else {
            actions.push(taskConfig.action);
        }
    }
    else if (taskConfig.actions) {
        for (let action of taskConfig.actions) {
            if (typeof action !== 'function') {
                throw new TypeError(`Invalid definition for '${functionName}' timer handler: all actions must be function`);
            }
            else {
                actions.push(action);
            }
        }
    }
    return {
        functionName: functionName,
        options: taskConfig.options,
        defaults: taskConfig.defaults,
        actions: actions
    };
}
//# sourceMappingURL=TimerController.js.map