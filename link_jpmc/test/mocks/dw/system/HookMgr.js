'use strict';

/**
 * Mock for dw/system/HookMgr
 */

var hooks = {};
var hookResults = {};

var HookMgr = {
    /**
     * Check if a hook exists
     * @param {string} hookID - Hook ID
     * @returns {boolean} True if hook exists
     */
    hasHook: function (hookID) {
        return hooks.hasOwnProperty(hookID);
    },

    /**
     * Call a hook
     * @param {string} hookID - Hook ID
     * @param {string} extensionPoint - Extension point
     * @param {...*} args - Arguments to pass to hook
     * @returns {*} Hook result
     */
    callHook: function (hookID, extensionPoint) {
        var key = hookID + '.' + extensionPoint;
        
        // If a result is pre-configured, return it
        if (hookResults.hasOwnProperty(key)) {
            var result = hookResults[key];
            
            // If result is a function, call it with the arguments
            if (typeof result === 'function') {
                var args = Array.prototype.slice.call(arguments, 2);
                return result.apply(null, args);
            }
            
            return result;
        }
        
        // Default behavior - return null
        return null;
    },

    /**
     * Helper to register a hook for testing
     * @param {string} hookID - Hook ID
     */
    _registerHook: function (hookID) {
        hooks[hookID] = true;
    },

    /**
     * Helper to unregister a hook for testing
     * @param {string} hookID - Hook ID
     */
    _unregisterHook: function (hookID) {
        delete hooks[hookID];
    },

    /**
     * Helper to set hook result for testing
     * @param {string} hookID - Hook ID
     * @param {string} extensionPoint - Extension point
     * @param {*} result - Result to return (can be a function)
     */
    _setHookResult: function (hookID, extensionPoint, result) {
        var key = hookID + '.' + extensionPoint;
        hookResults[key] = result;
    },

    /**
     * Helper to clear a specific hook result
     * @param {string} hookID - Hook ID
     * @param {string} extensionPoint - Extension point
     */
    _clearHookResult: function (hookID, extensionPoint) {
        var key = hookID + '.' + extensionPoint;
        delete hookResults[key];
    },

    /**
     * Reset mock state
     */
    reset: function () {
        hooks = {};
        hookResults = {};
    },

    /**
     * Reset mock state (alias)
     */
    resetMock: function () {
        this.reset();
    }
};

module.exports = HookMgr;
