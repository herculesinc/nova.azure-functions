// IMPORTS
// =================================================================================================
const nova = require('../../bin');

// MODULE VARIABLES
// =================================================================================================
const controller = new nova.HttpController();
module.exports = controller;

// ROUTES
// =================================================================================================
controller.set('/', {
    get: {
        scope   : 'account:read',
        auth    : async function(scope, credentials) {
            if (credentials) {
                return credentials.data;
            }
        },
        mutator : function (inputs, auth) {
            return {
                action  : { ...inputs, auth },
                view    : { include: inputs.include }
            };
        },
        action  : async function (inputs) {
            return { action: 'GET /', name: this.name, inputs };
        },
        view    : function (result, options) { 
            return { result, options, context: this }; 
        }
    },
    post: {
        scope   : 'account:update',
        auth    : async function (scope, credentials) { return credentials.data; },
        action  : async function (inputs) { return { action: 'POST /', inputs }; },
        view    : function (result, options) { return { result, options, context: this }; }
    },
    put: {
        action  : async function (inputs) {

            this.log.debug('Debug text');
            this.log.info('Info text');
            this.log.warn('Warning text');
            this.log.error(new Error('Error message'));

            const error = new Error('Boom 400!');
            error.status = 400;
            error.toJSON = function() {
                return {
                    name    : this.name,
                    message : this.message
                };
            };
            throw error;
        }
    },
    patch: {
        action  : async function(inputs) { 
            const error = new Error('Boom 500!');
            error.status = 500;
            error.toJSON = function() {
                return {
                    name    : this.name,
                    message : this.message
                };
            };
            throw error;
         }
    }
});

controller.set('/multipart', {
    post: {
        inputs  : nova.parsers.multipart({ filter: { field: 'field3', maxCount: 1 }}),
        action  : async function (inputs) {
            return { action: 'POST /multipart', inputs };
        }
    }
});

controller.set('/view', {
    get: {
        action  : async function (inputs) { 
            return {
                action  : 'GET /view',
                name    : this.name,
                inputs 
            };
        },
        view    : function (result, options) {
            const view = { result, context: this };
            view[nova.symbols.responseHeaders] = { 'Test-Header': 'test value' };
            return view;
        }
    }
});

const segment = controller.segment('/segment');

segment.set('/', {
    get: {
        action: async function(inputs) {
            return {
                messge: 'segment root'
            };
        }
    }
});

segment.set('/test', {
    get: {
        action: async function(inputs) {
            return {
                messge: 'segment test'
            };
        }
    }
});