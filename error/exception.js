'use strict';
const factory = require('./factory');
const registry = require('./registry');

function Constructor(msgCode, interpolationValues = {}) {
    if (typeof msgCode !== 'string') {
        if (msgCode && typeof msgCode === 'object') {
            msgCode = msgCode.code;
        }
    }
    if (!registry.hasOwnProperty(msgCode)) {
        throw new Error(`Unknown message code '${msgCode}'.`);
    }
    const errorDefinition = registry[msgCode];
    this.code = errorDefinition.code;
    this.message = errorDefinition.message(interpolationValues);
    // XXX: This is the right place to attach the stack to the error, because
    // this function is executed every time someone does `new MyError()`, so
    // the stack will cover the place where `new` happens.
    Error.captureStackTrace(this, Constructor);
}

module.exports = {
    LuciusError: factory('LuciusError', Constructor),
};
