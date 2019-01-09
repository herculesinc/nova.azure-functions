// IMPORTS
// =================================================================================================
const nova = require('../../bin');

// MODULE VARIABLES
// =================================================================================================
const controller = new nova.TimerController();
module.exports = controller;

let counter = 0;

// TIMER HANDLERS
// =================================================================================================
controller.set('TimerTrigger', {
    action  : async (inputs, context) => {
        counter++;
        context.log.info(counter);
    }
});