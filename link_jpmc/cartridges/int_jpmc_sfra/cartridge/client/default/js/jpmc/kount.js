'use strict';

/**
 * Kount Fraud Detection SDK Integration
 * Initializes Kount Web Client SDK for device fingerprinting
 */

var kountModule = require('@kount/kount-web-client-sdk');
var kountSDK = kountModule.default || kountModule;

var kountInstance = null;

/**
 * Gets Kount client ID from data attribute or site preferences
 * @returns {string} Kount client ID
 */
function getClientId() {
    var clientId = $('body').data('kount-client-id') || $('#kount-config').data('client-id');
    if (!clientId) {
        return null;
    }
    return clientId;
}

/**
 * Gets Kount environment from data attribute
 * @returns {string} 'TEST' or 'PROD'
 */
function getEnvironment() {
    var env = $('body').data('kount-environment') || $('#kount-config').data('environment') || 'TEST';
    return env.toUpperCase();
}

/**
 * Gets or generates session ID for Kount
 * Uses SFCC session ID if available, otherwise generates UUID
 * @returns {string} Session ID
 */
function getSessionId() {
    var sessionId = $('#kount-config').data('session-id') || $('body').data('session-id');

    if (!sessionId) {
        sessionId = $('input[name="kountSessionId"]').val();
    }

    if (!sessionId) {
        sessionId = generateUUID();
    }

    return sessionId;
}

/**
 * Generates a UUID v4 using cryptographically secure random values when available
 * @returns {string} UUID
 */
function generateUUID() {
    if (window.crypto && window.crypto.getRandomValues) {
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
        var hex = Array.from(bytes, function (b) {
            return ('0' + b.toString(16)).slice(-2);
        });
        return hex.slice(0, 4).join('') + '-' + hex.slice(4, 6).join('') + '-' +
               hex.slice(6, 8).join('') + '-' + hex.slice(8, 10).join('') + '-' +
               hex.slice(10, 16).join('');
    }
    // Fallback for legacy browsers only
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.trunc(Math.random() * 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/**
 * Initializes Kount SDK
 * @param {Object} options - Optional configuration overrides
 * @returns {boolean} True if initialized successfully
 */
function initKount(options) {
    options = options || {};

    var clientId = options.clientId || getClientId();
    if (!clientId) {
        return false;
    }

    var sessionId = options.sessionId || getSessionId();
    var environment = options.environment || getEnvironment();

    var kountConfig = {
        clientID: clientId,
        environment: environment,
        isSinglePageApp: true,
        isDebugEnabled: options.debug || false,
        callbacks: {
            'collect-begin': function () {},
            'collect-end': function () {
                sessionStorage.setItem('kount-collection-complete', 'true');
            }
        }
    };

    try {
        kountInstance = kountSDK(kountConfig, sessionId);

        if (kountInstance) {
            updateSessionIdField(sessionId);
            return true;
        }

        return false;
    } catch (e) {
        return false;
    }
}

/**
 * Updates or creates hidden field with Kount session ID
 * @param {string} sessionId - Session ID to store
 */
function updateSessionIdField(sessionId) {
    var fieldName = 'kountSessionId';
    var $existingField = $('input[name="' + fieldName + '"]');

    if ($existingField.length > 0) {
        $existingField.val(sessionId);
    } else {
        var $checkoutForm = $('.checkout-form, form[name="dwfrm_billing"]');
        if ($checkoutForm.length > 0) {
            $checkoutForm.append(
                $('<input>')
                    .attr('type', 'hidden')
                    .attr('name', fieldName)
                    .val(sessionId)
            );
        }
    }
}

/**
 * Re-initializes Kount with new session ID
 * Call this when navigating between checkout stages in SPA
 * @param {string} newSessionId - New session ID (optional)
 * @returns {Object} kount instance
 */
function refreshKount(newSessionId) {
    if (!kountInstance) {
        return initKount({ sessionId: newSessionId });
    }

    var sessionId = newSessionId || getSessionId();

    try {
        if (kountInstance.NewSession) {
            kountInstance.NewSession(sessionId);
            updateSessionIdField(sessionId);
            return true;
        }

        return initKount({ sessionId: sessionId });
    } catch (e) {
        return false;
    }
}

/**
 * Checks if Kount collection is complete
 * @returns {boolean} True if collection completed
 */
function isCollectionComplete() {
    return sessionStorage.getItem('kount-collection-complete') === 'true';
}

/**
 * Gets current Kount session ID
 * @returns {string|null} Current session ID
 */
function getCurrentSessionId() {
    if (kountInstance && kountInstance.sessionID) {
        return kountInstance.sessionID;
    }
    return getSessionId();
}

module.exports = {
    init: initKount,
    refresh: refreshKount,
    getSessionId: getCurrentSessionId,
    isCollectionComplete: isCollectionComplete
};
