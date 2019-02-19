// IMPORTS
// =================================================================================================
import {
    AzureFunctionContext,
    AzureExecutionContext,
    AzureHttpResponse,
    AzureFunctionLogger,
    BindingDefinition
} from 'azure-functions';

// CLASS DEFINITION
// =================================================================================================
const logger = function(message: string) {};

(logger as any).verbose = () => {};
(logger as any).info = () => {};
(logger as any).error = () => {};
(logger as any).warn = () => {};

export class AzureFuncContext implements AzureFunctionContext {
    readonly invocationId: string;
    readonly executionContext: AzureExecutionContext;
    readonly bindings: { [key: string]: any; };
    readonly bindingDefinitions: BindingDefinition[];
    readonly log: AzureFunctionLogger = logger as AzureFunctionLogger;

    constructor (id: string, name: string) {
        this.invocationId = id;

        this.executionContext = {
            invocationId     : id,
            functionName     : name,
            functionDirectory: ''
        };

        this.bindings = {};

        this.bindingDefinitions = [];
    }

    done (error?: Error, response?: AzureHttpResponse): void {}
}
