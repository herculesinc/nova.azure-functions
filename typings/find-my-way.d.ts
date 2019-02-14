declare module "find-my-way" {
    
    module FindMyWay { 
        type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
        type RouteHandler = Function;

        export interface RouterConfig {
            ignoreTrailingSlash?    : boolean;
            maxParamLength?         : boolean;
            allowUnsafeRegex?       : boolean;
        }

        export interface RouteDescriptor {
            handler : RouteHandler;
            params? : object;
            store?  : object;
        }

        export interface Router {
            on(method: HttpMethod, path: string, handler: RouteHandler, store?: object);
            on(methods: HttpMethod[], path: string, handler: RouteHandler, store?: object);

            off(method: HttpMethod, path: string): RouteDescriptor;
            off(methods: HttpMethod[], path: string): RouteDescriptor[];

            find(method: HttpMethod, path: string): RouteDescriptor;

            reset();
            prettyPrint();
        }
    }

    function FindMyWay(config?: FindMyWay.RouterConfig): FindMyWay.Router;
    export = FindMyWay;
}