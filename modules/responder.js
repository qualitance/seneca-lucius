'use strict';
const logger = require('./logger');
const {LUCIUS_ERROR_MARKER} = require('../error');
const errorFactory = require('../error/factory');
const LuciusTools = require('./tools');

const LuciusBreakoutError = errorFactory('LuciusBreakoutError', function (message) {
    this.message = message;
    this.stack = (new Error('just smuggling a failure message, ignore me')).stack;
});

class LuciusResponder {
    /**
     * Creates an instance of LuciusResponder.
     * @param {Lucius} lucius A Lucius instance.
     * @param {callback} next The next() callback for a seneca.act() endpoint.
     * @param {string} senecaPattern A Seneca endpoint addressing pattern.
     * @param {object} senecaArgs A raw Seneca messaging payload.
     * @param {string} outputSchema Optionally provide a JSON schema for the output.
     * @memberof LuciusResponder
     */
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
     * @param {any} [sideload=null] Optionally overwrite sideloaded information.
     * @returns {any} Whatever the called endpoint returns.
     * @throws {LuciusBreakoutError} Endpoint errors will throw a "magic" error.
     * @memberof LuciusResponder
     */
    async inquest(pattern, args = {}, sideload = null) {
        const message = await this.request(pattern, args, sideload);
        if (message.isSuccessful()) {
            return message.getPayload();
        }
        else {
            // this special error will be intercepted by the handler's catch
            throw new LuciusBreakoutError(message);
        }
    }

    // lucius.request() wrapper that auto-propagates the sideload
    request(pattern, args = {}, sideload = null) {
        sideload = LuciusTools.extractArgSideload(LuciusTools.packArgSideload(args, sideload));
        if (LuciusTools.isEmptyObject(sideload)) {
            sideload = LuciusTools.extractArgSideload(this.senecaArgs);
        }
        return this.lucius.request(pattern, args, sideload);
    }

    // next() wrapper that produces a successful response message
    async success(messageOrPayload = null) {
        // the payload either is already in message format, or we make it so
        const message = LuciusTools.isMessage(messageOrPayload)
            ? messageOrPayload
            : LuciusTools.makeMessage().setPayload(messageOrPayload);
        // validate the response payload against schema, if any
        LuciusTools.validateOutputSchema(
            this.outputSchema, message.getPayload(), this.senecaPattern, this.senecaArgs);
        // log the response
        logger.debug.format('RESP', this.senecaPattern, this.senecaArgs, '[PAYLOAD TRUNCATED...]');
        // call next()
        this.next(null, message.export());
    }

    // next() wrapper that produces a failure response message
    failure(messageOrErrors) {
        let message;
        if (LuciusTools.isMessage(messageOrErrors)) {
            message = messageOrErrors;
        }
        else {
            let errorSet = messageOrErrors;
            if (!Array.isArray(errorSet)) {
                errorSet = [errorSet];
            }
            // pack all errors in a standardized format
            message = LuciusTools.makeMessage();
            errorSet.forEach(e => {
                e.marker = LUCIUS_ERROR_MARKER;
                message.setError(e);
            });
        }
        // log the errors
        message.getErrors().forEach(e => {
            logger.error.format('ERROR', this.senecaPattern, this.senecaArgs, e);
        });
        // call next()
        return this.next(null, message.export());
    }

    fatal(e) {
        if (e instanceof LuciusBreakoutError) {
            return this.failure(e.message);
        }
        e = LuciusTools.makeFatalError(e);
        logger.fatal.format('CRASH', this.senecaPattern, this.senecaArgs, e);
        return this.next(e);
    }

}

module.exports = LuciusResponder;
