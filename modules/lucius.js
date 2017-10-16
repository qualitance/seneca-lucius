'use strict';
const util = require('./util');
const {LuciusError} = require('../error');
const logger = require('./logger');
const Ajv = require('ajv');
const ajv = new Ajv();
const LuciusMessage = require('./message');
const LuciusResponder = require('./responder');

class Lucius {
    /**
     * Creates an instance of Lucius.
     * @param {any} seneca A Seneca instance.
     * @memberof Lucius
     */
    constructor(seneca) {
        this.promisifiedAct = util.promisify(seneca.act, seneca);
        this.seneca = seneca;
    }

    /**
     * Create a message in internal format.
     * @param {LuciusMessage|any} [message=null] Optionally provide an existing
     * message, as either a LuciusMessage or an exported variant of one. If this
     * is missing it will create a new successful message with empty payload.
     * @returns {LuciusMessage}
     * @memberof Lucius
     */
    makeMessage(message = null) {
        if (message && message instanceof LuciusMessage) {
            return message;
        }
        return new LuciusMessage(message);
    }

    /**
     * This can be used to dig in a Seneca error for the original one.
     * (Seneca wraps the original errors in its own.)
     * @param {any} e Something thrown during a Seneca or Lucius request.
     * @returns {any} If error is recognized as something Seneca packs, it will be
     * decorated with additional info, otherwise it will be returned unchanged.
     * @memberof Lucius
     */
    getFatalError(e) {
        // unpack seneca errors
        if (e instanceof Error && e.seneca && e.orig) {
            const n = new Error(e.orig.message);
            n.code = e.orig.code;
            n.stack = e.stack;
            n.name = e.name;
            return n;
        }
        return e;
    }

    /**
     * Make sure that the given error is transformed into an Error instance,
     * since they carry special meaning in the Seneca messaging stack.
     * @param {any} e Whatever was returned by a previous Seneca call.
     * @returns Error An Error instance, or an object that extends Error.
     * @memberof Lucius
     */
    makeFatalError(e) {
        // normally, e should be an instance of our standard error, but in practice
        // it could be any error, or even a scalar, so we need to sanity check it
        if (!(e instanceof LuciusError)) {
            // seneca wraps foreign errors into its own, and keeps the original
            // under property .orig; we try to detect if we're dealing with such
            // nested errors and dig to uncover the original one
            //FIXME: this is undocumented behavior and could break upstream
            e = this.getFatalError(e);
            // what we're left with could, once again, be anything;
            // but we MUST make it into an Error object, because that's
            // the magic value that tells seneca there's been a fatal error
            if (!(e instanceof Error)) {
                const oldCode = e && e.hasOwnProperty('code') ? e.code : 'UNKNOWN CODE';
                const oldMessage = e && e.hasOwnProperty('message') ? e.message : 'UNKNOWN MESSAGE';
                e = new Error(oldMessage);
                e.code = oldCode;
            }
        }
        return e;
    }

    /**
     * This wraps seneca.act() in an async version, and wraps the response inside
     * an instance of LuciusMessage, allowing you to deal with it via standard methods.
     * @param {string} pattern Seneca message addressing pattern.
     * @param {object} [args={}] Extra arguments to be passed to seneca.act().
     * @param {object} [userInfo=null] If provided, and if args doesn't
     *   already carry user information in args.__, it will use this parameter.
     * @returns {LuciusMessage} A Lucius message instance.
     * @memberof Lucius
     */
    async request(pattern, args = {}, userInfo = null) {
        // if args doesn't already contain user info and it was provided explicitly,
        // overwrite it in params
        if (!args.__ && userInfo) {
            args.__ = userInfo;
        }

        const params = [pattern, args];
        logger.debug.format('SENECA', 'SEND', pattern, params);
        const response = await this.promisifiedAct.apply(this.seneca, params);
        logger.debug.format('SENECA', 'RECV', pattern, params, response);
        return this.makeMessage(response);
    }

    /**
     * Registers to the seneca init:plugin_name pattern with a standard function that
     * logs some messages and lets you run a custom callback.
     * @param {string} pluginName The name of the plugin. It must match the plugin you call from,
     *   otherwise the code won't execute.
     * @param {function} [customCallback] Optionally provide a callback that will receive
     *   the ready function and the plugin name and can control when the plugin is ready by
     *   calling that function.
     * @memberof Lucius
     */
    pluginInit(pluginName, customCallback = undefined) {
        const seneca = this.seneca;
        seneca.add(`init:${pluginName}`, function (args, next) {
            const ready = (...params) => {
                logger.debug.format('SENECA', 'PLUGIN', pluginName, args);
                if (!params.length) {
                    logger.info.format('SENECA', 'PLUGIN', pluginName, 'ready');
                } else {
                    logger.error.format('SENECA', 'PLUGIN', pluginName, 'failed', params[0]);
                }
                next.apply(seneca, params);
            };
            if (customCallback && typeof customCallback === 'function') {
                return customCallback.apply(this, [ready, pluginName]);
            }
            return ready();
        });
    }

    /**
     * Verify the given arguments against a JSON schema.
     * @param {any} inputSchema JSON schema to check args against. Check will be skipped if schema is falsey.
     * @param {any} args The input arguments to be checked.
     * @param {any} senecaPattern Seneca messaging pattern to which the arguments were addressed.
     * @param {any} senecaArgs Complete Seneca argument object.
     * @memberof Lucius
     */
    validateInputSchema(inputSchema, args, senecaPattern, senecaArgs) {
        if (inputSchema) {
            const validate = ajv.compile(JSON.parse(inputSchema));
            if (!validate(args)) {
                logger.error.format('SENECA', 'INPUT-VALIDATION', senecaPattern, senecaArgs, ajv.errors);
                throw new Error('Input arguments failed schema validation.');
            }
        }
    }

    /**
     * Verify the given output payload against a JSON schema.
     * @param {any} outputSchema JSON schema to check payload against. Check will be skipped if schema is falsey.
     * @param {any} payload The output payload to be checked.
     * @param {any} senecaPattern Seneca messaging pattern to which the arguments were addressed.
     * @param {any} senecaArgs Complete Seneca argument object.
     * @memberof Lucius
     */
    validateOutputSchema(outputSchema, payload, senecaPattern, senecaArgs) {
        if (outputSchema) {
            const validate = ajv.compile(JSON.parse(outputSchema));
            if (!validate(payload)) {
                logger.error.format('SENECA', 'OUTPUT-VALIDATION', senecaPattern, senecaArgs, validate.errors);
                throw new Error('Returned payload failed schema validation.');
            }
        }
    }

    /**
     * This is a version of seneca.add() which requires an async callback
     * with the signature (responder, args), where responder is an object
     * that can be used to return standardized payloads and will also call
     * next() for you.
     * @param {string} senecaPattern The Seneca message pattern to be registered.
     * @param {function} ourCallback Async callback(responder, args).
     * @param {any} [inputSchema=null] Optionally provide a JSON schema against which to check the input parameters.
     * @param {any} [outputSchema=null] Optionally provide a JSON schema against which to check the output payload.
     * @memberof Lucius
     */
    register(senecaPattern, ourCallback, inputSchema = null, outputSchema = null) {
        // log the registration of this handler
        logger.debug.format('SENECA', 'REGISTER', senecaPattern);
        // we require handler to be async, to facilitate the use of await inside it
        if (!util.isAsyncFunction(ourCallback)) {
            throw new TypeError('Callback was not declared async.');
        }
        // we fabricate a callback which observes the signature that Seneca expects
        const senecaCallback = async (senecaArgs, next) => {
            const responder = new LuciusResponder(this, next, senecaPattern, senecaArgs, outputSchema);
            try {
                // log the entrance into the handler
                logger.debug.format('SENECA', 'ENTER', senecaPattern, senecaArgs);
                // extract the parts that interest us from the seneca arguments
                const sessionInfo = senecaArgs.__ || {};
                const argPayload = util.filterCoreArgs(senecaArgs);
                // validate input arguments against schema, if any
                this.validateInputSchema(inputSchema, argPayload, senecaPattern, senecaArgs);
                // we delegate to the custom callback, then sit back
                // and wait for it to call one of the responder methods
                await ourCallback.apply(this.seneca, [responder, argPayload, sessionInfo]);
            } catch (e) {
                return responder.fatal(e);
            }
        };
        // call the real deal, seneca.add()
        return this.seneca.add.apply(this.seneca, [senecaPattern, senecaCallback]);
    }

}

module.exports = Lucius;
