'use strict';

var currentPreferences = {};
var defaultCurrency = 'USD';
var defaultLocale = 'en_US';
var currentSite = null;

/**
 * Mock for dw.system.Site
 */
function Site() {}

Site.getCurrent = function () {
    if (!currentSite) {
        currentSite = {
            getPreferences: function () {
                return {
                    getCustom: function () {
                        return currentPreferences;
                    }
                };
            },
            getID: function () {
                return 'RefArch';
            },
            getDefaultCurrency: function () {
                return defaultCurrency;
            },
            getDefaultLocale: function () {
                return defaultLocale;
            }
        };
    }
    return currentSite;
};

/**
 * Helper to set mock preferences for testing
 * @param {Object} prefs - Preferences object
 */
Site.setMockPreferences = function (prefs) {
    currentPreferences = prefs || {};
};

/**
 * Helper to set default currency
 * @param {String} currency - Currency code
 */
Site.setDefaultCurrency = function (currency) {
    defaultCurrency = currency;
};

/**
 * Helper to set default locale
 * @param {String} locale - Locale code
 */
Site.setDefaultLocale = function (locale) {
    defaultLocale = locale;
};

/**
 * Helper to reset preferences
 */
Site.resetMockPreferences = function () {
    currentPreferences = {};
    defaultCurrency = 'USD';
    defaultLocale = 'en_US';
};

/**
 * Alias for resetMockPreferences
 */
Site.reset = function () {
    currentPreferences = {};
    defaultCurrency = 'USD';
    defaultLocale = 'en_US';
    currentSite = null;
};

module.exports = Site;
