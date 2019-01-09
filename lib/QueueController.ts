
// IMPORTS
// =================================================================================================
import { AzureFunctionContext, AzureQueueBidingData } from 'azure-functions';
import {
    Action, Executor, OperationContext,
    QueueControllerConfig, QueueTaskConfig, QueueInputProcessor, QueueAdapter, QueueMessageMetadata
} from '@nova/azure-functions';
import { defaults } from './defaults';

// INTERFACES
// =================================================================================================
interface OperationConfig<V> {
    functionName    : string;
    options         : V;
    defaults        : object;
    processor       : QueueInputProcessor;
    actions         : Action[];
}

// CLASS DEFINITION
// =================================================================================================
export class QueueController<T extends OperationContext, V> {

    private readonly taskMap    : Map<string, OperationConfig<V>>;
    private readonly adapter    : QueueAdapter<V>;
    private readonly executor   : Executor<T,V>;

    constructor(options?: QueueControllerConfig<T,V>) {
        options = processOptions(options);

        this.taskMap = new Map();
        this.adapter = options.adapter;
        this.executor = options.executor;
    }

    set(functionName: string, taskConfig: QueueTaskConfig<T,V>) {
        if (this.taskMap.has(functionName)) {
            throw new TypeError(`Queue task handler for '${functionName}' has already been registered`);
        }
        const opConfig = buildOpConfig(functionName, taskConfig);
        this.taskMap.set(functionName, opConfig);
    }

    async handler(context: AzureFunctionContext, message: object): Promise<void> {
        
        // 0 ----- make sure the task can be handled
        const functionName = context.executionContext.functionName;
        const opConfig = this.taskMap.get(functionName);
        if (!opConfig) {
            throw new Error(`Task handler for '${functionName}' could not be found`);
        }

        let executed = false;
        let opContext: T = undefined;
        try {
            // 1 ----- create operation context
            const opContextConfig = this.adapter(context, opConfig.options);
            opContext = await this.executor.createContext(opContextConfig);

            // 2 ----- build action inputs
            let actionInputs = undefined;
            if (opConfig.processor) {
                const meta = buildMessageMetadata(context.bindingData as any);
                actionInputs = opConfig.processor(message, opConfig.defaults, meta);
            }
            else {
                actionInputs = message;
            }

            // 3 ----- execute actions
            const result = await this.executor.execute(opConfig.actions, actionInputs, opContext);
            executed = true;

            // 4 ------ close the context
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

// HELPER FUNCTIONS
// =================================================================================================
function processOptions(options: QueueControllerConfig<any,any>): QueueControllerConfig<any,any> {
    if (!options) return defaults.queueController;

    let newOptions: QueueControllerConfig<any, any> = {
        adapter         : options.adapter || defaults.queueController.adapter,
        executor        : options.executor || defaults.queueController.executor
    };

    return newOptions;
}

function buildOpConfig(functionName: string, taskConfig: QueueTaskConfig<any,any>): OperationConfig<any> {

 
    // validate and build actions
    const actions = [];
    if (taskConfig.action) {
        if (typeof taskConfig.action !== 'function') { 
            throw new TypeError(`Invalid definition for '${functionName}' task handler: action must be a function`);
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
            if (typeof action !== 'function') { 
                throw new TypeError(`Invalid definition for '${functionName}' task handler: all actions must be function`);
            }
            else {
                actions.push(action);
            }
        }
    }

    return {
        functionName    : functionName,
        options         : taskConfig.options,
        defaults        : taskConfig.defaults,
        processor       : taskConfig.inputs,
        actions         : actions
    };
}

function buildMessageMetadata(bindingData: AzureQueueBidingData): QueueMessageMetadata {
    return {
        messageId       : bindingData.id,
        insertionTime   : new Date(bindingData.insertionTime).valueOf(),
        expirationTime  : new Date(bindingData.expirationTime).valueOf(),
        nextVisibleTime : new Date(bindingData.nextVisibleTime).valueOf(),
        dequeueCount    : bindingData.dequeueCount,
        popReceipt      : bindingData.popReceipt
    };
}