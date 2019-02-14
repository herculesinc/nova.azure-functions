// IMPORTS
// =================================================================================================
const nova = require('../../bin');

// MODULE VARIABLES
// =================================================================================================
const controller = new nova.HttpController();
module.exports = controller;

// ROUTES
// =================================================================================================
controller.set('HttpTrigger', '/', {
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
        view    : (result, options) => { 
            return { result, options, context: this }; 
        } 
    },
    post: {
        scope   : 'account:update',
        auth    : async (scope, credentials) => credentials.data,
        action  : async inputs => ({ action: 'POST /', inputs }),
        view    : (result, options, context) => ({ result, options, context })
    },
    put: {
        action  : async (inputs) => {

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

controller.set('HttpTrigger', '/multipart', {
    post: {
        inputs  : nova.parsers.multipart({ filter: { field: 'field3', maxCount: 1 }}),
        action  : async inputs => ({ action: 'POST /multipart', inputs })
    }
});

controller.set('HttpTrigger', '/view', {
    get: {
        action  : (inputs) => { 
            return {
                action  : 'GET /view',
                name    : this.name,
                inputs 
            };
        },
        view    : (result, options, context) => {
            const view = { result, context };
            view[nova.symbols.responseHeaders] = { 'Test-Header': 'test value' };
            return view;
        }
    }
});