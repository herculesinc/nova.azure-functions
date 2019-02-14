"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const defaults_1 = require("./defaults");
const util = require("./util");
// CLASS DEFINITION
// =================================================================================================
class QueueController {
    constructor(options) {
        options = processOptions(options);
        this.taskMap = new Map();
        this.adapter = options.adapter;
    }
    set(functionName, taskConfig) {
        if (this.taskMap.has(functionName)) {
            throw new TypeError(`Queue task handler for '${functionName}' has already been registered`);
        }
        const opConfig = buildOpConfig(functionName, taskConfig);
        this.taskMap.set(functionName, opConfig);
    }
    async handler(context, message) {
        // 0 ----- make sure the task can be handled
        const functionName = context.executionContext.functionName;
        const opConfig = this.taskMap.get(functionName);
        if (!opConfig) {
            throw new Error(`Task handler for '${functionName}' could not be found`);
        }
        let operation = undefined;
        try {
            // 1 ----- create operation context
            const operation = this.adapter(context, opConfig.actions, opConfig.options);
            // 2 ----- build action inputs
            let actionInputs = undefined;
            if (opConfig.processor) {
                const meta = buildMessageMetadata(context.bindingData);
                actionInputs = opConfig.processor.call(operation, message, opConfig.defaults, meta);
            }
            else {
                actionInputs = message;
            }
            // 3 ----- execute actions
            const result = await operation.execute(actionInputs);
            // 4 ----- log the operation and return the result
            operation.log.close(201, true); // TODO: set status to something else?
            return result;
        }
        catch (error) {
            // if the operation has been created - use it to log errors
            if (operation) {
                operation.log.error(error);
                operation.log.close(500, false); // TODO: set status to something else?
            }
            throw error;
        }
    }
}
exports.QueueController = QueueController;
// HELPER FUNCTIONS
// =================================================================================================
function processOptions(options) {
    if (!options)
        return defaults_1.defaults.queueController;
    const newOptions = {
        adapter: options.adapter || defaults_1.defaults.queueController.adapter
    };
    return newOptions;
}
function buildOpConfig(functionName, taskConfig) {
    // validate and build actions
    const actions = [];
    if (taskConfig.action) {
        if (!util.isRegularFunction(taskConfig.action)) {
            throw new TypeError(`Invalid definition for '${functionName}' task handler: action must be a regular function`);
        }
        else if (taskConfig.actions) {
            throw new TypeError(`Invalid definition for '${functionName}' task handler: 'action' and 'actions' cannot be provided at the same time`);
        }
        else {
            actions.push(taskConfig.action);
        }
    }
    else if (taskConfig.actions) {
        for (let action of taskConfig.actions) {
            if (!util.isRegularFunction(action)) {
                throw new TypeError(`Invalid definition for '${functionName}' task handler: all actions must be regular functions`);
            }
            else {
                actions.push(action);
            }
        }
    }
    const processor = taskConfig.inputs;
    if (processor && !util.isRegularFunction(processor)) {
        throw new TypeError(`Invalid definition for '${functionName}' task handler: input processor must be a regular function`);
    }
    return {
        functionName: functionName,
        options: taskConfig.options,
        defaults: taskConfig.defaults,
        processor: processor,
        actions: actions
    };
}
function buildMessageMetadata(bindingData) {
    return {
        messageId: bindingData.id,
        insertionTime: new Date(bindingData.insertionTime).valueOf(),
        expirationTime: new Date(bindingData.expirationTime).valueOf(),
        nextVisibleTime: new Date(bindingData.nextVisibleTime).valueOf(),
        dequeueCount: bindingData.dequeueCount,
        popReceipt: bindingData.popReceipt
    };
}
//# sourceMappingURL=QueueController.js.map