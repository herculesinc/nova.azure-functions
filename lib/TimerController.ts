
// IMPORTS
// =================================================================================================
import { AzureFunctionContext } from 'azure-functions';
import { Executable, Context } from '@nova/core';
import { Action, TimerControllerConfig, TimerHandlerConfig, TimerOperationAdapter } from '@nova/azure-functions';
import { defaults } from './defaults';
import * as util from './util';

// INTERFACES
// =================================================================================================
interface OperationConfig<V> {
    functionName    : string;
    options         : V;
    defaults        : object;
    actions         : Action[];
}

// CLASS DEFINITION
// =================================================================================================
export class TimerController<O> {

    private readonly handlers   : Map<string, OperationConfig<O>>;
    private readonly adapter    : TimerOperationAdapter;

    constructor(options?: TimerControllerConfig) {
        options = processOptions(options);

        this.handlers = new Map();
        this.adapter = options.adapter;
    }

    set(functionName: string, taskConfig: TimerHandlerConfig) {
        if (this.handlers.has(functionName)) {
            throw new TypeError(`Timer handler for '${functionName}' has already been registered`);
        }
        const opConfig = buildOpConfig(functionName, taskConfig);
        this.handlers.set(functionName, opConfig);
    }

    async handler(context: AzureFunctionContext, message: object): Promise<void> {
        
        // 0 ----- make sure the task can be handled
        const functionName = context.executionContext.functionName;
        const opConfig = this.handlers.get(functionName);
        if (!opConfig) {
            throw new Error(`Task handler for '${functionName}' could not be found`);
        }

        let operation: Executable & Context = undefined;
        try {
            // 1 ----- create operation
            operation = this.adapter(context, opConfig.actions, opConfig.options);

            // 2 ----- execute actions
            const result = await operation.execute(undefined);

            // 3 ----- log the operation and return the result
            operation.log.close(201, true);         // TODO: set status to something else?
            return result;
        }
        catch (error) {
            // if the operation has been created - use it to log errors
            if (operation) {
                operation.log.error(error);
                operation.log.close(500, false);    // TODO: set status to something else?
            }

            throw error;
        }
    }
}

// HELPER FUNCTIONS
// =================================================================================================
function processOptions(options: TimerControllerConfig): TimerControllerConfig {
    if (!options) return defaults.timerController;

    const newOptions: TimerControllerConfig = {
        adapter         : options.adapter || defaults.timerController.adapter
    };

    return newOptions;
}

function buildOpConfig(functionName: string, taskConfig: TimerHandlerConfig): OperationConfig<any> {

    // validate and build actions
    const actions = [];
    if (taskConfig.action) {
        if (!util.isRegularFunction(taskConfig.action)) { 
            throw new TypeError(`Invalid definition for '${functionName}' timer handler: action must be a regular function`);
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
            if (!util.isRegularFunction(action)) { 
                throw new TypeError(`Invalid definition for '${functionName}' timer handler: all actions must be regular functions`);
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
        actions         : actions
    };
}