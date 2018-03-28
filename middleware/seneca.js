'use strict';
const {Lucius, LuciusTools} = require('.local/lucius');
const util = require('.local/util');

const requestMaker = async function (req, res, next, pattern, params, cbSuccess = null, cbFailure = null) {
    const lucius = new Lucius(req.sideload.seneca);
    try {
        // if params is a function, run it
        if (typeof params === 'function') {
            params = params(req);
        }
        // make sure params is never undefined
        params = params || {};
        // only pass certain items from the req sideload into the seneca sideload
        const sideload = util.object.filter(req.sideload, ['user', 'session', 'uuid']);
        // make the seneca request
        const response = await lucius.request(pattern, params, sideload);
        if (!response.isSuccessful()) {
            // business logic errors are signalled with 400
            res.status(400);
            if (cbFailure) {
                return cbFailure(res, next, response.getErrors());
            }
            return next(response.getErrors());
        }
        // business logic success
        res.status(200);
        if (cbSuccess) {
            return cbSuccess(res, response.getPayload());
        }
        res.json(response.getPayload());
        return;
    } catch (e) {
        // fatal errors are signalled with 500
        res.status(500);
        return next(LuciusTools.getFatalError(e));
    }
};

/**
 * Call this to get a middleware customized to perform a Seneca request
 * with the indicated pattern and parameters.
 * @param {string} pattern Seneca message pattern.
 * @param {object|function} params Seneca message parameters. Either object,
 *   or a function that will receive req and will return a parameter object.
 * @param {function} [cbSuccess=null] Optionally provide a function that
 *   will receive res and the Seneca successful response payload and will
 *   be expected to set the connect response and body. The default function
 *   sets status 200 and body = payload.
 * @returns Middleware that performs the indicated Seneca request and uses
 *   the result to set response status and body.
 */
module.exports = {
    setup: senecaService => (req, res, next) => {
        // Make the Seneca service accessible inside request handlers.
        req.sideload.seneca = senecaService;
        next();
    },
    /**
     * Middleware that performs a Seneca request and sets the response accordingly.
     * @param {string} pattern Seneca message pattern eg. "role:foo,cmd:bar".
     * @param {object|function} params Seneca message parameters. Either object,
     *   or a function that will receive req and will return a parameter object.
     * @param {function} [cbSuccess=null] Optionally provide a function that
     *   will receive res and a Seneca successful response payload and will
     *   be expected to set the connect response and body. The default function
     *   sets status 200, content type json, and body = json(payload).
     * @param {function} [cbFailure=null] Optionally provide a function that
     *   will receive res and the Seneca errors and can react to them in a custom
     *   manner. by default the response is set to status 400.
     */
    request: function (pattern, params, cbSuccess = null, cbFailure = null) {
        // XXX: need to wrap our async func in a normal func
        // because swagger-tools uses ancient lodash-compat
        // which doesn't recognize async as functions
        return function (req, res, next) {
            return requestMaker(req, res, next, pattern, params, cbSuccess, cbFailure);
        };
    },
};
