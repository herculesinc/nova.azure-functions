// IMPORTS
// =================================================================================================
import { HttpController, HttpEndpointDefaults, HttpRouteConfig, HttpEndpointConfig } from "@nova/azure-functions";
import * as util from './util';

// CLASS DEFINITION
// =================================================================================================
export class HttpSegment {

    private readonly controller : HttpController;
    readonly root               : string;
    readonly defaults?          : HttpEndpointDefaults;

    // CONSTRUCTOR
    // ---------------------------------------------------------------------------------------------
    constructor(controller: HttpController, path: string, defaults?: HttpEndpointDefaults) {
        this.controller = controller;
        this.root = util.cleanPath(path);
        if (defaults) {
            this.defaults = { ...defaults, cors: { ...defaults.cors } };
        }
    }

    // ROUTE REGISTRATION
    // ---------------------------------------------------------------------------------------------
    set(path: string, config: HttpRouteConfig) {
        path = util.cleanPath(path);
        if (this.defaults) {
            config = applyDefaults(config, this.defaults, this.root + path);
        }
        this.controller.set(this.root + path, config);
    }
}

// HELPER FUNCTIONS
// =================================================================================================
function applyDefaults(config: HttpRouteConfig, defaults: HttpEndpointDefaults, path: string): HttpRouteConfig {
    
    const merged: HttpRouteConfig = {};
    for (let item in config) {
        switch (item) {
            case 'get': case 'post': case 'put': case 'patch': case 'delete': {
                merged[item] = { ...{ ...defaults, cors: undefined }, ...config[item] };
                break;
            }
            case 'cors': {
                if (!config.cors && defaults.cors) {
                    merged.cors = defaults.cors;
                }
                break;
            }
            default: {
                const method = item.toUpperCase();
                throw new TypeError(`Invalid definition for '${method} ${path}' endpoint: '${method}' method is not supported`);
            }
        }
    }

    return merged;
}