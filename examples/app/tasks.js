// IMPORTS
// =================================================================================================
const nova = require('../../bin');

// MODULE VARIABLES
// =================================================================================================
const controller = new nova.QueueController();
module.exports = controller;

// TASK HANDLERS
// =================================================================================================
controller.set('QueueTrigger', {
    inputs  : (message, defaults, meta) => ({ message, defaults, meta }),
    action  : async (inputs, context) => {
        context.log.info(inputs);
    }
});