'use strict';

/**
 * JPMC PIE (Page Integrated Encryption) utility module
 * Shared encryption logic for billing and payment instruments
 */

/**
 * Checks if JPMC PIE library is ready
 *
 * All key-material fields (K, L, E, key_id, phase) are checked for truthiness
 * rather than just existence:
 *
 * - `typeof null` returns 'object' and `typeof ''` returns 'string', so a pure
 *   typeof check passes even when getkey.js has set placeholder values while
 *   its async key-fetch XHR is still in flight.
 *
 * - `phase` is intentionally kept as a typeof/existence check rather than a
 *   truthy check. JPMC PIE sets phase = 0 when keys are fully loaded in some
 *   environments, so !!phase would permanently return false and prevent
 *   encryption from ever being attempted.
 *
 * @returns {boolean} True if PIE library is fully loaded with valid key material
 */
function isPieReady() {
    return typeof window.PIE !== 'undefined' &&
           !!window.PIE.K &&
           !!window.PIE.L &&
           !!window.PIE.E &&
           !!window.PIE.key_id &&
           typeof window.PIE.phase !== 'undefined' &&
           typeof window.ValidatePANChecksum === 'function' &&
           typeof window.ProtectPANandCVV === 'function';
}

/**
 * Encrypts card data using JPMC PIE
 * @param {string} cardNumber - Card number (will be sanitized)
 * @param {string} cvv - CVV/security code
 * @returns {Object|null} Encrypted data object or null if encryption fails
 */
function encryptCardData(cardNumber, cvv) {
    if (!cardNumber || !cvv || !isPieReady()) {
        return null;
    }

    var sanitizedCardNumber = cardNumber.replace(/\s/g, '');

    if (!window.ValidatePANChecksum(sanitizedCardNumber)) {
        return null;
    }

    var result = window.ProtectPANandCVV(sanitizedCardNumber, cvv, false);

    if (result && result[0] && result[1]) {
        return {
            accountNumber: result[0],
            cvv: result[1],
            encryptionIntegrityCheck: result[2] || null
        };
    }

    return null;
}

/**
 * Polls until the PIE library is fully initialised, then invokes the callback.
 * PIE's getkey.js fires an async XHR to fetch live key material; this function
 * waits for that XHR to complete before signalling readiness.
 * @param {Function} callback - Called with true when ready, false on timeout
 * @param {number} [timeoutMs=10000] - Maximum ms to wait before giving up
 */
function waitForPieReady(callback, timeoutMs) {
    if (isPieReady()) {
        callback(true);
        return;
    }

    var limit = typeof timeoutMs === 'number' ? timeoutMs : 10000;
    var elapsed = 0;
    var POLL_INTERVAL = 100;

    var timer = setInterval(function () {
        elapsed += POLL_INTERVAL;
        if (isPieReady()) {
            clearInterval(timer);
            callback(true);
        } else if (elapsed >= limit) {
            clearInterval(timer);
            callback(false);
        }
    }, POLL_INTERVAL);
}

/**
 * Encrypts card data and stores in target element
 * @param {string} cardSelector - Selector for card number input
 * @param {string} cvvSelector - Selector for CVV input
 * @param {string} targetSelector - Selector for hidden encrypted data field
 * @returns {boolean} True if encryption was successful
 */
function encryptAndStore(cardSelector, cvvSelector, targetSelector) {
    var $target = $(targetSelector);
    var cardNumber = $(cardSelector).val();
    var cvv = $(cvvSelector).val();

    $target.val('');

    var encrypted = encryptCardData(cardNumber, cvv);
    if (encrypted) {
        $target.val(JSON.stringify(encrypted));
        return true;
    }

    return false;
}

module.exports = {
    isPieReady: isPieReady,
    waitForPieReady: waitForPieReady,
    encryptAndStore: encryptAndStore
};
