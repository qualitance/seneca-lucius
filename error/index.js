'use strict';
const LUCIUS_ERROR_MARKER = 'lucius';
const registry = require('./registry');
const {LuciusError, LuciusSmuggleError} = require('./exceptions');

module.exports = {
    E: registry,
    LuciusError,
    LuciusSmuggleError,
    isLuciusError: e => {
        return (
            e instanceof LuciusError
            || e.name && e.name === 'LuciusError'
            || e.marker && e.marker === LUCIUS_ERROR_MARKER
        );
    },
    LUCIUS_ERROR_MARKER,
};
