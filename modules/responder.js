'use strict';
const logger = require('./logger');
const {LuciusError, LuciusSmuggleError, LUCIUS_ERROR_MARKER} = require('../error');
const LuciusMessage = require('./message');

class LuciusResponder {
    constructor(lucius, next, senecaPattern, senecaArgs, outputSchema) {
        this.lucius = lucius;
        this.next = next;
        this.senecaPattern = senecaPattern;
        this.senecaArgs = senecaArgs;
        this.outputSchema = outputSchema;
    }

    /**
     * Makes a Seneca request and returns the payload upon success, but handles any
     * errors in a special manner that will interrupt the registered handler to which
     * this response instance belongs.
     * @param {string} pattern Seneca message pattern identifier.
     * @param {any} [args={}] Optionally pass some parameters to the call.
     * @param {any} [userInfo=null] Optionally pass user information to the call.
     * @returns {any} Whatever the called endpoint returns.
     * @throws {LuciusSmuggleError} Endpoint errors will throw a "magic" error.
     * @memberof LuciusResponder
     */
    async inquest(pattern, args = {}, userInfo = null) {
        const message = await this.lucius.request(pattern, args, userInfo);
        if (message.isSuccessful()) {
            return message.getPayload();
        }
        else {
            // this special error will be intercepted by the handler's catch
            throw new LuciusSmuggleError(message);
        }
    };

    // next() wrapper that produces a successful response message
    async success(messageOrPayload = null) {
        let message;
        if (messageOrPayload instanceof LuciusMessage) {
            message = messageOrPayload;
        }
        else {
            // validate the response payload against schema, if any
            this.lucius.validateOutputSchema(this.outputSchema, messageOrPayload, this.senecaPattern, this.senecaArgs);
            // make sure the payload is put in a standard format
            message = this.lucius.makeMessage();
            message.setPayload(messageOrPayload);
        }
        // log the response
        logger.debug.format('SENECA', 'RESP', this.senecaPattern, this.senecaArgs, message.getPayload());
        // call next()
        this.next(null, message.export());
    };

    // next() wrapper that produces a failure response message
    failure(messageOrErrors) {
        let message;
        if (messageOrErrors instanceof LuciusMessage) {
            message = messageOrErrors;
        }
        else {
            let errorSet = messageOrErrors;
            // sanity checks
            if (!Array.isArray(errorSet)) {
                errorSet = [errorSet];
            }
            errorSet.map((value, index) => {
                if (!(value instanceof LuciusError)) {
                    throw new TypeError(`Error at index ${index} must be instance of LuciusError`);
                }
            });
            // pack all errors in a standardized format
            message = this.lucius.makeMessage();
            errorSet.forEach(e => {
                e.marker = LUCIUS_ERROR_MARKER;
                message.setError(e);
            });
        }
        // log the errors
        logger.debug.format('SENECA', 'ERROR', this.senecaPattern, this.senecaArgs, `${message.getErrors().length} error(s)`);
        message.getErrors().forEach(e => {
            logger.error.format('SENECA', '\error', this.senecaPattern, this.senecaArgs, e);
        });
        // call next()
        return this.next(null, message.export());
    };

    fatal(e) {
        if (e instanceof LuciusSmuggleError) {
            return this.failure(e.message);
        }
        e = this.lucius.makeFatalError(e);
        logger.fatal.format('SENECA', 'CRASH', this.senecaPattern, this.senecaArgs, e);
        return this.next(e);
    }

}

module.exports = LuciusResponder;
