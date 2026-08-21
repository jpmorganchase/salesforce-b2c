/**
 * JPMC 3DS Browser Data Collector
 * Collects browser fingerprint data required for 3D Secure authentication
 * Consolidated module for all browser data collection needs
 * @module jpmc/browserDataCollector
 */

'use strict';

/**
 * Core browser data collection function
 * Collects all required fields for JPMC 3DS authentication
 * @returns {Object} Browser data object with all required 3DS fields
 */
function collectBrowserData() {
    var browserData = {};

    try {
        // Browser Accept Header (from HTTP request - approximate on client side)
        browserData.browserAcceptHeader = 'application/json';

        // Browser Language (ISO 639-1 two-letter code, max 8 chars)
        browserData.browserLanguage = (navigator.language || navigator.userLanguage || 'en-US').substring(0, 8);

        // Browser Color Depth (must be string)
        browserData.browserColorDepth = String(window.screen && window.screen.colorDepth ? window.screen.colorDepth : 24);

        // Browser Screen Dimensions (must be strings)
        browserData.browserScreenHeight = String(window.screen && window.screen.height ? window.screen.height : 1080);
        browserData.browserScreenWidth = String(window.screen && window.screen.width ? window.screen.width : 1920);

        // Device Local Time Zone (integer offset in minutes from UTC)
        // JPMC expects positive offset for timezones ahead of UTC (inverted from JS getTimezoneOffset)
        var timeZoneOffset = new Date().getTimezoneOffset();
        browserData.deviceLocalTimeZone = String(-timeZoneOffset);

        // Browser User Agent
        browserData.browserUserAgent = navigator.userAgent || 'Mozilla/5.0 (compatible)';

        // Java Enabled (must be string 'true' or 'false')
        try {
            browserData.javaEnabled = String(navigator.javaEnabled ? navigator.javaEnabled() : false);
        } catch (e) {
            browserData.javaEnabled = 'false';
        }

        // JavaScript Enabled (always true since this code is running)
        browserData.javaScriptEnabled = 'true';

        // Challenge Window Size (optional, defaults to FULL_SCREEN)
        // Options: FULL_SCREEN, 600X400, 500X600, 390X400, 250X400
        browserData.challengeWindowSize = 'FULL_SCREEN';

        // Device IP Address is captured server-side, not included in client collection
    } catch (e) {
        // Return partial data with safe defaults
    }

    return browserData;
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use collectBrowserData() instead
 * @returns {Object} Browser info object
 */
function collectBrowserInfo() {
    return collectBrowserData();
}

/**
 * Inject browser data as hidden form fields
 * Used by billing form serialization
 * @param {HTMLFormElement|jQuery} form - Form element or jQuery object
 */
function injectBrowserDataToForm(form) {
    var browserData = collectBrowserData();
    var $form = $(form);

    // Inject or update browser data fields
    Object.keys(browserData).forEach(function (fieldName) {
        var $existingField = $form.find('input[name="' + fieldName + '"]');
        
        if ($existingField.length) {
            // Update existing field
            $existingField.val(browserData[fieldName]);
        } else {
            // Create new hidden field
            $('<input>')
                .attr({
                    type: 'hidden',
                    name: fieldName,
                    value: browserData[fieldName]
                })
                .addClass('jpmc-3ds-field')
                .appendTo($form);
        }
    });
}

/**
 * Remove browser data fields from form
 * Useful for cleanup or re-injection
 * @param {HTMLFormElement|jQuery} form - Form element or jQuery object
 */
function removeBrowserDataFromForm(form) {
    var $form = $(form);
    $form.find('.jpmc-3ds-field').remove();
}

/**
 * Get browser data as URL-encoded query string
 * Used for GET requests or URL parameters
 * @returns {string} URL-encoded query string
 */
function getBrowserDataAsQueryString() {
    var browserData = collectBrowserData();
    var params = [];

    Object.keys(browserData).forEach(function (key) {
        params.push(encodeURIComponent(key) + '=' + encodeURIComponent(browserData[key]));
    });

    return params.join('&');
}

/**
 * Get browser data as plain object
 * Used for AJAX requests with JSON payload
 * @returns {Object} Browser data object
 */
function getBrowserDataAsObject() {
    return collectBrowserData();
}

module.exports = {
    // Primary methods
    collectBrowserData: collectBrowserData,
    injectBrowserDataToForm: injectBrowserDataToForm,
    removeBrowserDataFromForm: removeBrowserDataFromForm,
    getBrowserDataAsQueryString: getBrowserDataAsQueryString,
    getBrowserDataAsObject: getBrowserDataAsObject,
    
    // Legacy alias for backward compatibility
    collectBrowserInfo: collectBrowserInfo
};
