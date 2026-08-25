'use strict';

var currentPreferences = {};

/**
 * Mock for dw.system.System
 */
function System() {}

System.getPreferences = function () {
    return {
        getCustom: function () {
            return currentPreferences;
        }
    };
};

/**
 * Helper to set mock preferences for testing
 * @param {Object} prefs - Preferences object
 */
System.setMockPreferences = function (prefs) {
    currentPreferences = prefs || {};
};

/**
 * Helper to reset preferences
 */
System.resetMockPreferences = function () {
    currentPreferences = {};
};

module.exports = System;
