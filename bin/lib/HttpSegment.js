"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("./util");
// CLASS DEFINITION
// =================================================================================================
class HttpSegment {
    // CONSTRUCTOR
    // ---------------------------------------------------------------------------------------------
    constructor(controller, path, defaults) {
        this.controller = controller;
        this.root = util.cleanPath(path);
        if (defaults) {
            this.defaults = validateDefaults(defaults, this.root);
        }
    }
    // ROUTE REGISTRATION
    // ---------------------------------------------------------------------------------------------
    set(path, config) {
        path = util.cleanPath(path);
        if (this.defaults) {
            config = applyDefaults(config, this.defaults, this.root + path);
        }
        this.controller.set(this.root + path, config);
    }
}
exports.HttpSegment = HttpSegment;
// HELPER FUNCTIONS
// =================================================================================================
function validateDefaults(defaults, root) {
    if (!util.isRegularFunction(defaults.auth)) {
        throw new TypeError(`Invalid definition for '${root}' segment: authenticator must be a regular function`);
    }
    if (!util.isRegularFunction(defaults.mutator)) {
        throw new TypeError(`Invalid definition for '${root}' segment: mutator must be a regular function`);
    }
    if (!util.isRegularFunction(defaults.view)) {
        throw new TypeError(`Invalid definition for '${root}' segment: view builder must be a regular function`);
    }
    const validated = Object.assign({}, defaults);
    validated.cors = Object.assign({}, defaults.cors);
    return validated;
}
function applyDefaults(config, defaults, path) {
    const merged = {};
    for (let item in config) {
        switch (item) {
            case 'get':
            case 'post':
            case 'put':
            case 'patch':
            case 'delete': {
                merged[item] = Object.assign({}, Object.assign({}, defaults, { cors: undefined }), config[item]);
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
//# sourceMappingURL=HttpSegment.js.map