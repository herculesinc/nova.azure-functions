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
    action  : async function (inputs) {
        this.log.info(inputs);
    }
});