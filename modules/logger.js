'use strict';
const logger = require('.local/logger');

// adjust the parameters and format to our needs
const formatterFactory = () => function (prefix, action, pattern, args, ...extra) {
    // adapt to variable signatures
    switch (arguments.length) {
        case 0:
            return;
        case 1:
            [prefix, action, pattern, args, extra] = [undefined, undefined, undefined, undefined, arguments[0]];
            break;
        case 2:
            [prefix, action, pattern, args, extra] = [arguments[0], undefined, undefined, undefined, arguments[1]];
            break;
        case 3:
            [prefix, action, pattern, args, extra] = [arguments[0], undefined, arguments[1], undefined, arguments[2]];
            break;
    }
    // dynamic output depending on parameters
    let log = '';
    let anyBefore = false;
    if (typeof prefix !== 'undefined') {
        log += `${prefix}:`;
        anyBefore = true;
    }
    if (typeof action !== 'undefined') {
        log += anyBefore ? ' ' : '';
        log += `[${action}]`;
        anyBefore = true;
    }
    if (typeof pattern !== 'undefined') {
        log += anyBefore ? ' ' : '';
        log += pattern;
        anyBefore = true;
    }
    if (typeof args !== 'undefined') {
        log += anyBefore ? ' ' : '';
        log += typeof args === 'string' ? args : JSON.stringify(args);
        anyBefore = true;
    }
    log += extra.length ? (anyBefore ? ' ' : '') + '//' : '';
    if (typeof extra !== 'undefined') {
        if (!Array.isArray(extra)) {
            extra = [extra];
        }
        return [log, ...extra];
    }
    return [log];
};
const entryFormatter = formatterFactory();

const cleanupEntryParams = params => {
    //XXX: IT IS VERY IMPORTANT TO MAKE ALL MODIFICATIONS BY CLONING.
    //The parameters array refers data which may still be in use by other code.
    //Modifying any of it will corrupt that data (eg. message payloads etc.)
    const output = [];
    for (let i = 0; i < params.length; i++) {
        // Fix error stack printing. Some Error objects are missing the error message
        // from the serialized trace, and none of them include the code property in it.
        // We replace each logger method with a function that intercepts Error instances
        // and reformats the first line of their trace to include name, code and message.
        if (params[i] instanceof Error && params[i].stack) {
            const e = params[i];
            const lines = e.stack.split('\n');
            lines.shift();
            lines.unshift(`${e.name}:` + (e.code ? ` [${e.code}]` : '') + ` ${e.message}`);
            output[i] = lines.join('\n');
        }
        // The following blocks attempt to trim down excessively large strings or arrays.
        else if (typeof params[i] === 'string' && params[i].length > 1000) {
            const more = params[i].length - 1000;
            output[i] = params[i].substring(0, 1000) + `[...${more} chars skipped]`;
        }
        else if (Array.isArray(params[i]) && params[i].length > 20) {
            const more = params[i].length - 20;
            output[i] = params[i].slice(0, 20);
            output[i].push(`[...${more} items skipped]`);
        }
        else if (params[i] && typeof params[i] === 'object' && params[i].payload) {
            if (typeof params[i].payload === 'string' && params[i].payload.length > 1000) {
                const more = params[i].payload.length - 1000;
                output[i] = Object.assign({}, params[i]);
                output[i].payload = params[i].payload.substring(0, 1000) + `[...${more} chars skipped]`;
            }
            else if (Array.isArray(params[i].payload) && params[i].payload.length > 20) {
                const more = params[i].payload.length - 20;
                output[i] = Object.assign({}, params[i]);
                output[i].payload = params[i].payload.slice(0, 20);
                output[i].payload.push(`[...${more} items skipped]`);
            }
        }
        else {
            output[i] = params[i];
        }
    }
    return output;
};

['fatal', 'error', 'warning', 'info', 'debug', 'verbose'].forEach(name => {
    let original = logger[name];
    logger[name] = (...params) => original(...cleanupEntryParams(params));
    logger[name].format = (...params) => {
        params.unshift('LUCIUS');
        return logger[name].apply(logger, entryFormatter(...params));
    };
});

module.exports = logger;
