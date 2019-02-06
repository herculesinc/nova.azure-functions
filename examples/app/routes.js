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
        inputs  : (body, query, params, defaults) => ({
            action  : { ...defaults, ...query, ...params, ...body },
            view    : { include: query.include }
        }),
        action  : async (inputs, context) => {
            context.log.info('testing1 testing1 testing1');
            context.log.debug('testing2 testing2 testing2');
            return { action: 'GET /', name: context.name, inputs };
        },
        view    : (result, options, context) => ({ result, options, context })
    },
    post: {
        scope   : 'account:update',
        auth    : async (scope, credentials) => credentials.data,
        action  : async inputs => ({ action: 'POST /', inputs }),
        view    : (result, options, context) => ({ result, options, context })
    },
    put: {
        action  : async (inputs, context) => {

            context.log.debug('Debug text');
            context.log.info('Info text');
            context.log.warn('Warning text');
            context.log.error(new Error('Error message'));

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
        action  : function(inputs) { 
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
        body    : nova.parsers.multipart({ filter: { field: 'field3', maxCount: 1 }}),
        action  : async inputs => ({ action: 'POST /multipart', inputs })
    }
});

controller.set('HttpTrigger', '/view', {
    get: {
        action  : (inputs, context) => { 
            return {
                action  : 'GET /view',
                name    : context.name,
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