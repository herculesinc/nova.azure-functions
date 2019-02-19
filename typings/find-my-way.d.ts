declare module "find-my-way" {
    
    module FindMyWay { 
        type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
        type RouteHandler = Function;

        export interface RouterConfig {
            ignoreTrailingSlash?    : boolean;  // default false
            caseSensitive?          : boolean;  // default true
            allowUnsafeRegex?       : boolean;  // default false
            maxParamLength?         : boolean;  // default 100
        }

        export interface RouteOptions {
            version                 : string;
        }

        export interface RouteDescriptor {
            handler : RouteHandler;
            params? : { [key: string]: string | undefined; };
            store?  : any;
        }

        export interface Router {
            on(method: HttpMethod, path: string, handler: RouteHandler, store?: object): void;
            on(methods: HttpMethod[], path: string, handler: RouteHandler, store?: object): void;
            on(method: HttpMethod, path: string, options: RouteOptions, handler: RouteHandler, store?: object): void;
            on(methods: HttpMethod[], path: string, options: RouteOptions, handler: RouteHandler, store?: object): void;

            off(method: HttpMethod, path: string): void;
            off(methods: HttpMethod[], path: string): void;

            find(method: HttpMethod, path: string, version?: string): RouteDescriptor;

            reset(): void;
            prettyPrint(): void;
        }
    }

    function FindMyWay(config?: FindMyWay.RouterConfig): FindMyWay.Router;
    export = FindMyWay;
}