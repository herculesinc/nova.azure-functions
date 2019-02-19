// IMPORTS
// =================================================================================================
import {Operation, OperationConfig} from '@nova/core';
import { AzureHttpResponse, AzureFunctionContext } from 'azure-functions';
import { HttpRequestHead, Action } from '@nova/azure-functions';
import { MockLogger } from './logger';

// DEFINITION
// =================================================================================================
export function mockAdapter(context: AzureFunctionContext, request: HttpRequestHead, actions: Action[]): Operation {
    const config: OperationConfig = {
        id     : 'id',
        name   : 'name',
        origin : 'unknown',
        actions: actions
    };

    return new Operation(config, undefined, new MockLogger());
}
