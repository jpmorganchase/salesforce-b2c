'use strict';

/**
 * Mock for dw.object.CustomObjectMgr
 */
var customObjects = {};

function CustomObject(type, keyValue) {
    this.type = type;
    this.keyValue = keyValue;
    this.custom = {};
}

function CustomObjectMgr() {}

CustomObjectMgr.getCustomObject = function (type, keyValue) {
    var key = type + '::' + keyValue;
    return customObjects[key] || null;
};

CustomObjectMgr.createCustomObject = function (type, keyValue) {
    var key = type + '::' + keyValue;
    var co = new CustomObject(type, keyValue);
    customObjects[key] = co;
    return co;
};

CustomObjectMgr.remove = function (customObject) {
    if (!customObject) return;
    var key = customObject.type + '::' + customObject.keyValue;
    delete customObjects[key];
};

CustomObjectMgr.getAllCustomObjects = function (type) {
    var results = [];
    Object.keys(customObjects).forEach(function (key) {
        if (customObjects[key].type === type) {
            results.push(customObjects[key]);
        }
    });
    return results;
};

/**
 * Mock for queryCustomObjects - supports basic status filtering
 * @param {string} type - Custom Object type ID
 * @param {string} queryString - Query string (e.g., 'custom.status = {0}')
 * @param {string} sortString - Sort string (e.g., 'creationDate asc')
 * @param {...*} args - Query parameters
 * @returns {Object} SeekableIterator-like object
 */
CustomObjectMgr.queryCustomObjects = function (type, queryString, sortString) {
    var filterValues = Array.prototype.slice.call(arguments, 3);
    var hasStatusFilter = filterValues.length > 0 && queryString && queryString.indexOf('custom.status') > -1;
    var results = [];
    Object.keys(customObjects).forEach(function (key) {
        var co = customObjects[key];
        if (co.type === type) {
            if (hasStatusFilter) {
                if (co.custom && filterValues.indexOf(co.custom.status) > -1) {
                    results.push(co);
                }
            } else {
                results.push(co);
            }
        }
    });
    var index = 0;
    return {
        count: results.length,
        hasNext: function () { return index < results.length; },
        next: function () { return results[index++]; },
        close: function () { index = results.length; },
        getCount: function () { return results.length; }
    };
};

/**
 * Helper to reset all custom objects
 */
CustomObjectMgr.resetAllCustomObjects = function () {
    customObjects = {};
};

/**
 * Helper to get custom objects for testing
 */
CustomObjectMgr.getMockCustomObjects = function () {
    return customObjects;
};

module.exports = CustomObjectMgr;
