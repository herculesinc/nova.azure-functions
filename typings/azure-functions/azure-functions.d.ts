declare module "azure-functions" {

    type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    
	export interface AzureFunctionContext {

        invocationId        : string;
        executionContext    : AzureExecutionContext;
        bindingData?        : AzureQueueBidingData | AzureTimerBindingData;
        log                 : AzureFunctionLogger;        
    
        done(error?: Error, response?: AzureHttpResponse);
    }

    export interface AzureFunctionLogger {
        (message): void;
        verbose(message: string);
        info(message: string);
        warn(message: string);
        error(message: string);
    }
    
    export interface AzureExecutionContext {
        invocationId        : string;
        functionName        : string;
        functionDirectory   : string;
    }
    
    export interface AzureHttpRequest {
        method      : HttpMethod;
        url         : string;
        originalUrl : string;
        headers     : { [header: string]: string; };
        query?      : { [param: string]: string; };
        params?     : { [param: string]: string; };
        body?       : object | Buffer | string;
        rawBody?    : string;
    }
    
    export interface AzureHttpResponse {
        status      : number;
        headers?    : { [header: string] : string; }
        body?       : object | Buffer;
        isRaw?      : boolean;    
    }

    export interface AzureQueueBidingData {
        invocationId    : string;
        id              : string;
        queueTrigger    : object;
        dequeueCount    : number;
        insertionTime   : string;
        expirationTime  : string;
        nextVisibleTime : string;
        popReceipt      : string;
    }

    export interface AzureTimerData {
        Schedule: {
            AdjustForDST: boolean;
        };
        ScheduleStatus  : any;
        IsPastDue       : boolean;
    }

    export interface AzureTimerBindingData {
        invocationId    : string;
        timerTrigger    : string;
    }
}