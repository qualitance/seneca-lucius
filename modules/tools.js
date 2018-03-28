'use strict';
const Ajv = require('ajv');
const ajv = new Ajv();
const logger = require('./logger');
const LuciusMessage = require('./message');
const {LuciusError} = require('../error');

const LuciusTools = module.exports = {
    isEmptyObject: o => Object.getOwnPropertyNames(o).length === 0,
    isAsyncFunction: f => {
        if (typeof f !== 'function') {
            return false;
        }
        const asyncProto = Object.getPrototypeOf(async function () {});
        const proto = Object.getPrototypeOf(f);
        return proto === asyncProto;
    },
    extractArgPayload: args => {
        if (typeof args !== 'object' || !args || Array.isArray(args)) {
            return args;
        }
        const out = {};
        Object.getOwnPropertyNames(args).forEach(prop => {
            if (prop.indexOf('$') === -1
                && prop !== 'role'
                && prop !== 'cmd'
                && prop !== 'internal'
                && prop !== '__'
            ) {
                out[prop] = args[prop];
            }
        });
        return out;
    },
    extractArgSideload: args => {
        return args.__ || {};
    },
    packArgSideload: (args, sideload) => {
        args.__ = sideload || (args.__ || {});
        return args;
    },
    /**
     * Verify the given output payload against a JSON schema.
     * @param {any} outputSchema JSON schema to check payload against. Check will be skipped if schema is falsey.
     * @param {any} payload The output payload to be checked.
     * @param {any} senecaPattern Seneca messaging pattern to which the arguments were addressed.
     * @param {any} senecaArgs Complete Seneca argument object.
     */
    validateOutputSchema: (outputSchema, payload, senecaPattern, senecaArgs) => {
        if (outputSchema) {
            const validate = ajv.compile(JSON.parse(outputSchema));
            if (!validate(payload)) {
                logger.error.format('OUTPUT-VALIDATION', senecaPattern, senecaArgs, validate.errors);
                throw new Error('Returned payload failed schema validation.');
            }
        }
    },
    /**
     * Verify the given arguments against a JSON schema.
     * @param {any} inputSchema JSON schema to check args against. Check will be skipped if schema is falsey.
     * @param {any} args The input arguments to be checked.
     * @param {any} senecaPattern Seneca messaging pattern to which the arguments were addressed.
     * @param {any} senecaArgs Complete Seneca argument object.
     */
    validateInputSchema: (inputSchema, args, senecaPattern, senecaArgs) => {
        if (inputSchema) {
            const validate = ajv.compile(JSON.parse(inputSchema));
            if (!validate(args)) {
                logger.error.format('INPUT-VALIDATION', senecaPattern, senecaArgs, ajv.errors);
                throw new Error('Input arguments failed schema validation.');
            }
        }
    },
    /**
     * Create a message in internal format.
     * @param {LuciusMessage|any} [message=null] Optionally provide an existing
     * message, as either a LuciusMessage or an exported variant of one. If this
     * is missing it will create a new successful message with empty payload.
     * @returns {LuciusMessage}
     */
    makeMessage: (message = null) => {
        if (message && message instanceof LuciusMessage) {
            return message;
        }
        return new LuciusMessage(message);
    },
    isMessage: messageOrNot => messageOrNot instanceof LuciusMessage,
    /**
     * This can be used to dig in a Seneca error for the original one.
     * (Seneca wraps the original errors in its own.)
     * @param {any} e Something thrown during a Seneca or Lucius request.
     * @returns {any} If error is recognized as something Seneca packs, it will be
     * decorated with additional info, otherwise it will be returned unchanged.
     * @memberof Lucius
     */
    getFatalError: e => {
        // unpack seneca errors
        if (e instanceof Error && e.seneca && e.orig) {
            const n = new Error(e.orig.message);
            n.code = e.orig.code;
            n.stack = e.stack;
            n.name = e.name;
            return n;
        }
        return e;
    },
    /**
     * Make sure that the given error is transformed into an Error instance,
     * since they carry special meaning in the Seneca messaging stack.
     * @param {any} e Whatever was returned by a previous Seneca call.
     * @returns Error An Error instance, or an object that extends Error.
     * @memberof Lucius
     */
    makeFatalError: e => {
        // normally, e should be an instance of our standard error, but in practice
        // it could be any error, or even a scalar, so we need to sanity check it
        if (!(e instanceof LuciusError)) {
            // seneca wraps foreign errors into its own, and keeps the original
            // under property .orig; we try to detect if we're dealing with such
            // nested errors and dig to uncover the original one
            //FIXME: this is undocumented behavior and could break upstream
            e = LuciusTools.getFatalError(e);
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
    },
};
