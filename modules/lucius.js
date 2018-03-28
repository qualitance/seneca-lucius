'use strict';
const util = require('util');
const LuciusTools = require('./tools');
const LuciusResponder = require('./responder');
const logger = require('./logger');

//FIXME: receive logger instance as parameter (but tools also needs it!)

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
     * This wraps seneca.act() in an async version, and wraps the response inside
     * an instance of LuciusMessage, allowing you to deal with it via standard methods.
     * @param {string} pattern Seneca message addressing pattern.
     * @param {object} [args={}] Extra arguments to be passed to seneca.act().
     * @param {object} [sideload=null] Optionally pass along a sideload that will be
     * propagated back and forth all along the Seneca messaging chain. Useful for
     * passing info like user identity and end-to-end request UIDs.
     * @returns {LuciusMessage} A Lucius message instance.
     * @memberof Lucius
     */
    async request(pattern, args = {}, sideload = null) {
        if (typeof args !== 'object' || !args || Array.isArray(args)) {
            throw new TypeError('Arguments must be an object.');
        }
        args = LuciusTools.packArgSideload(args, sideload);
        const senecaActParams = [pattern, args];
        logger.debug.format('SEND', pattern, senecaActParams);
        const response = await this.promisifiedAct.apply(this.seneca, senecaActParams);
        logger.debug.format('RECV', pattern, senecaActParams, '[RESPONSE TRUNCATED...]');
        return LuciusTools.makeMessage(response);
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
                logger.debug.format('PLUGIN', pluginName, args);
                if (params[0]) {
                    logger.error.format('PLUGIN', pluginName, 'failed', params[0]);
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
        logger.debug.format('REGISTER', 'endpoint', senecaPattern);
        // we require handler to be async, to facilitate the use of await inside it
        if (!LuciusTools.isAsyncFunction(ourCallback)) {
            throw new TypeError('Callback was not declared async.');
        }
        // we fabricate a callback which observes the signature that Seneca expects
        const senecaCallback = async (senecaArgs, next) => {
            const responder = new LuciusResponder(this, next, senecaPattern, senecaArgs, outputSchema);
            try {
                // log the entrance into the handler
                logger.debug.format('ENTER', senecaPattern, senecaArgs);
                // extract the parts that interest us from the seneca arguments
                const payload = LuciusTools.extractArgPayload(senecaArgs);
                const sideload = LuciusTools.extractArgSideload(senecaArgs);
                // validate input arguments against schema, if any
                LuciusTools.validateInputSchema(inputSchema, payload, senecaPattern, senecaArgs);
                // we delegate to the custom callback, then sit back
                // and wait for it to call one of the responder methods
                await ourCallback.apply(this.seneca, [responder, payload, sideload]);
            } catch (e) {
                return responder.fatal(e);
            }
        };
        // call the real deal, seneca.add()
        return this.seneca.add.apply(this.seneca, [senecaPattern, senecaCallback]);
    }

}

module.exports = Lucius;
