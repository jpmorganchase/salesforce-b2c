'use strict';

/**
 * Mock for dw.util.UUIDUtils
 */
var counter = 0;

function UUIDUtils() {}

UUIDUtils.createUUID = function () {
    counter++;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

UUIDUtils.resetCounter = function () {
    counter = 0;
};

module.exports = UUIDUtils;
