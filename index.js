'use strict';
const {E, LuciusError, isLuciusError, LUCIUS_ERROR_MARKER} = require('./error');
const Lucius = require('./modules/lucius');
const LuciusTools = require('./modules/tools');

module.exports = {
    Lucius,
    LuciusTools,
    E,
    LuciusError,
    isLuciusError,
    LUCIUS_ERROR_MARKER,
};
