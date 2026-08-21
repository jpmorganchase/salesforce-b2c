'use strict';

/**
 * Mock for dw.system.Logger
 */
var loggers = {};

function Logger() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
}

Logger.prototype.debug = function () {
    this.debugMessages.push(Array.prototype.slice.call(arguments));
};

Logger.prototype.info = function () {
    this.infoMessages.push(Array.prototype.slice.call(arguments));
};

Logger.prototype.warn = function () {
    this.warnMessages.push(Array.prototype.slice.call(arguments));
};

Logger.prototype.error = function () {
    this.errorMessages.push(Array.prototype.slice.call(arguments));
};

Logger.prototype.reset = function () {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
};

Logger.getLogger = function (category, subCategory) {
    var key = category + (subCategory ? '.' + subCategory : '');
    if (!loggers[key]) {
        loggers[key] = new Logger();
    }
    return loggers[key];
};

Logger.reset = function () {
    loggers = {};
};

Logger.resetAllLoggers = function () {
    loggers = {};
};

module.exports = Logger;
