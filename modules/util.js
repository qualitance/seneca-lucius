'use strict';

const filterProps = (o, what, hardCheck = false) => {
    const n = {};
    for (let prop in o) {
        if (o.hasOwnProperty(prop)) {
            if (what.hasOwnProperty(prop)) {
                if (typeof what[prop] === 'object') {
                    n[prop] = filterProps(o[prop], what[prop]);
                } else {
                    n[prop] = o[prop];
                }
            }
            else if (hardCheck) {
                throw new Error(`Hard check is on, property '${prop}' is not present in whitemap.`);
            }
        }
    }
    return n;
};

module.exports = {
    objectFilter: filterProps,
    isAsyncFunction: f => {
        if (typeof f !== 'function') {
            return false;
        }
        const asyncProto = Object.getPrototypeOf(async function () {});
        const proto = Object.getPrototypeOf(f);
        return proto === asyncProto;
    },
    promisify: (f, context) => {
        return (...params) => {
            return new Promise((resolve, reject) => {
                params.push((err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(res);
                });
                f.apply(context, params);
            });
        };
    },
};
