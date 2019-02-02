declare module "azure-functions" {

    type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    
	export interface AzureFunctionContext {

        /**
         * A unique GUID per function invocation.
         */
        readonly invocationId: string;

        /**
         * Function execution metadata.
         */
        readonly executionContext: AzureExecutionContext;

        /**
         * Input and trigger binding data, as defined in function.json. Properties on this object are dynamically
         * generated and named based off of the "name" property in function.json.
         */
        readonly bindings: { [key: string]: any; };

        /**
         * Trigger metadata and function invocation data.
         */
        readonly bindingData?: AzureQueueBidingData | AzureTimerBindingData;

        /**
         * Bindings your function uses, as defined in function.json.
         */
        readonly bindingDefinitions: BindingDefinition[];

        /**
         * Allows you to write streaming function logs. Calling directly allows you to write streaming function logs
         * at the default trace level.
         */
        readonly log: AzureFunctionLogger;        
    
        /**
         * A callback function that signals to the runtime that your code has completed. If your function is synchronous,
         * you must call context.done at the end of execution. If your function is asynchronous, you should not use this
         * callback.
         *
         * @param error A user-defined error to pass back to the runtime. If present, your function execution will fail.
         * @param response An object containing output binding data. `response` will be passed to JSON.stringify unless it is
         *  a string, Buffer, ArrayBufferView, or number.
         */
        done(error?: Error, response?: AzureHttpResponse): void;
    }

    export interface AzureFunctionLogger {
        /**
         * Writes streaming function logs at the default trace level.
         */
        (message: string): void;
    
        /**
         * Writes to verbose level logging.
         */
        verbose(message: string): void;

        /**
         * Writes to info level logging or lower.
         */
        info(message: string): void;

        /**
         * Writes to warning level logging or lower.
         */
        warn(message: string): void;

        /**
         * Writes to error level logging or lower.
         */
        error(message: string): void;
    }
    
    export interface AzureExecutionContext {
        /**
         * A unique GUID per function invocation.
         */
        readonly invocationId: string;

        /**
         * The name of the function that is being invoked. The name of your function is always the same as the
         * name of the corresponding function.json's parent directory.
         */
        readonly functionName: string;

        /**
         * The directory your function is in (this is the parent directory of this function's function.json).
         */
        readonly functionDirectory   : string;
    }
    
    export interface AzureHttpRequest {
        /**
         * HTTP request method used to invoke this function.
         */
        readonly method: HttpMethod;

        /**
         * Request URL.
         */
        readonly url: string;


        readonly originalUrl: string;

        /**
         * HTTP request headers.
         */
        readonly headers: { [header: string]: string; };

        /**
         * Query string parameter keys and values from the URL.
         */
        readonly query?: { [param: string]: string; };

        /**
         * Route parameter keys and values.
         */
        readonly params?: { [param: string]: string; };

        /**
         * The HTTP request body.
         */
        readonly body?: object | Buffer | string;

        /**
         * The HTTP request body as a UTF-8 string.
         */
        readonly rawBody?: string;
    }
    
    export interface AzureHttpResponse {
        readonly status         : number;
        readonly headers?       : { [header: string] : string; }
        readonly body?          : object | Buffer;
        readonly isRaw?         : boolean;    
    }

    export interface AzureQueueBidingData {
        readonly invocationId   : string;
        readonly id             : string;
        readonly queueTrigger   : object;
        readonly dequeueCount   : number;
        readonly insertionTime  : string;
        readonly expirationTime : string;
        readonly nextVisibleTime: string;
        readonly popReceipt     : string;
    }

    export interface BindingDefinition {
        /**
         * The name of your binding, as defined in function.json.
         */
        readonly name: string;

        /**
         * The type of your binding, as defined in function.json.
         */
        readonly type: string;

        /**
         * The direction of your binding, as defined in function.json.
         */
        readonly direction: 'in' | 'out' | 'inout' | undefined;
    }

    export interface AzureTimerData {
        readonly Schedule: {
            AdjustForDST: boolean;
        };
        readonly ScheduleStatus : any;
        readonly IsPastDue      : boolean;
    }

    export interface AzureTimerBindingData {
        readonly invocationId   : string;
        readonly timerTrigger   : string;
    }
}