/**
 * JPMC CSC Helper — eligibility checks, history parsers, and display utilities.
 * @module scripts/helpers/CSCPaymentHelpers
 */

'use strict';

var Resource = require('dw/web/Resource');
var Logger = require('dw/system/Logger').getLogger('JPMC', 'CSC-helper');
var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');

var PAYMENT_STATUS = {
    AUTHORIZED: 'A',
    AUTH_AND_CAPTURE: 'AC',
    CAPTURED: 'C',
    PARTIAL_CAPTURED: 'PC',
    REFUNDED: 'RF',
    PARTIAL_REFUNDED: 'PRF',
    VOIDED: 'V',
    PARTIAL_VOID: 'PV'
};

var PAYMENT_STATUS_LABELS = {
    A:   Resource.msg('csc.status.authorized', 'jpmcbm', 'Authorized'),
    AC:  Resource.msg('csc.status.auth.and.capture', 'jpmcbm', 'Authorized & Captured'),
    C:   Resource.msg('csc.status.captured', 'jpmcbm', 'Captured'),
    PC:  Resource.msg('csc.status.partial.captured', 'jpmcbm', 'Partially Captured'),
    RF:  Resource.msg('csc.status.refunded', 'jpmcbm', 'Refunded'),
    PRF: Resource.msg('csc.status.partial.refunded', 'jpmcbm', 'Partially Refunded'),
    V:   Resource.msg('csc.status.voided', 'jpmcbm', 'Voided'),
    PV:  Resource.msg('csc.status.partial.void', 'jpmcbm', 'Partially Captured & Voided')
};

var AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
var AMOUNT_EPSILON = 0.0001;

var DELAYED_CAPTURE_WINDOW_MINUTES = (function () {
    try {
        var Site = require('dw/system/Site');
        var pref = Site.getCurrent().getPreferences().getCustom().JPMCDelayedCaptureWindowMinutes;
        if (pref !== null && pref !== undefined && !isNaN(Number(pref)) && Number(pref) > 0) {
            return Number(pref);
        }
    } catch (e) { /* fall through to default */ }
    return 120;
}());

/**
 * @param {string} authTimestamp - ISO timestamp of authorization
 * @returns {number} minutes elapsed since authorization
 */
function elapsedMinutesSince(authTimestamp) {
    return (new Date().getTime() - new Date(authTimestamp).getTime()) / 60000;
}

/**
 * @param {string|null} authTimestamp - ISO timestamp of authorization
 * @returns {boolean} true if within delayed capture window
 */
function isWithinDelayedCaptureWindow(authTimestamp) {
    if (!authTimestamp) return false;
    try {
        return elapsedMinutesSince(authTimestamp) < DELAYED_CAPTURE_WINDOW_MINUTES;
    } catch (e) {
        Logger.warn('isWithinDelayedCaptureWindow: Could not parse timestamp "{0}": {1}', authTimestamp, e.message);
        return false;
    }
}

/**
 * @param {string|null} authTimestamp - ISO timestamp of authorization
 * @returns {number} minutes remaining in delayed capture window
 */
function delayedWindowMinutesRemaining(authTimestamp) {
    if (!authTimestamp) return 0;
    try {
        var remaining = DELAYED_CAPTURE_WINDOW_MINUTES - elapsedMinutesSince(authTimestamp);
        return remaining > 0 ? Math.ceil(remaining) : 0;
    } catch (e) {
        return 0;
    }
}

/**
 * Resolves capture/void eligibility for DELAYED capture method orders.
 * @param {string} method - capture method
 * @param {Object} paymentDetails - payment details
 * @param {string} expiredMsgKey - resource key for expired message
 * @returns {Object|null} eligibility result
 */
function resolveDelayedEligibility(method, paymentDetails, expiredMsgKey) {
    if (method !== 'DELAYED') return null;
    if (isWithinDelayedCaptureWindow(paymentDetails.authTimestamp)) {
        return { allowed: true, reason: null };
    }
    return { allowed: false, reason: Resource.msg(expiredMsgKey, 'jpmcbm', null) };
}

/**
 * @param {Object} paymentDetails - payment details
 * @returns {Object} capture eligibility
 */
function canCapture(paymentDetails) {
    var status = paymentDetails.paymentStatus;
    var method = paymentDetails.captureMethod;
    var remaining = paymentDetails.amounts.remainingAuth;

    var captureAllowedStatuses = [
        PAYMENT_STATUS.AUTHORIZED,
        PAYMENT_STATUS.PARTIAL_CAPTURED,
        PAYMENT_STATUS.PARTIAL_REFUNDED,
        PAYMENT_STATUS.REFUNDED
    ];
    if (captureAllowedStatuses.indexOf(status) === -1) {
        return { allowed: false, reason: null };
    }
    if (remaining <= AMOUNT_EPSILON) {
        return { allowed: false, reason: Resource.msg('csc.info.capture.nothing', 'jpmcbm', null) };
    }
    if (method === 'MANUAL') {
        return { allowed: true, reason: null };
    }

    var delayed = resolveDelayedEligibility(method, paymentDetails, 'csc.info.capture.delayed.expired');
    if (delayed) return delayed;

    return { allowed: false, reason: null };
}

/**
 * @param {Object} paymentDetails - payment details
 * @returns {Object} void eligibility
 */
function canVoid(paymentDetails) {
    var status = paymentDetails.paymentStatus;
    var method = paymentDetails.captureMethod;
    var remaining = paymentDetails.amounts.remainingAuth;

    if (status === PAYMENT_STATUS.VOIDED || status === PAYMENT_STATUS.PARTIAL_VOID) {
        return { allowed: false, reason: null };
    }
    var voidAllowedStatuses = [
        PAYMENT_STATUS.AUTHORIZED,
        PAYMENT_STATUS.PARTIAL_CAPTURED,
        PAYMENT_STATUS.PARTIAL_REFUNDED
    ];
    if (remaining <= AMOUNT_EPSILON || voidAllowedStatuses.indexOf(status) === -1) {
        return { allowed: false, reason: null };
    }
    if (method === 'MANUAL') {
        return { allowed: true, reason: null };
    }

    var delayed = resolveDelayedEligibility(method, paymentDetails, 'csc.info.void.delayed.expired');
    if (delayed) return delayed;

    return { allowed: false, reason: null };
}

/**
 * @param {Object} paymentDetails - payment details
 * @returns {Object} refund eligibility
 */
function canRefund(paymentDetails) {
    var status = paymentDetails.paymentStatus;
    var method = paymentDetails.captureMethod;
    var remaining = paymentDetails.amounts.remainingRefundable;
    var isDelayedAuthorized = method === 'DELAYED' && status === PAYMENT_STATUS.AUTHORIZED;

    if (isDelayedAuthorized) {
        if (!isWithinDelayedCaptureWindow(paymentDetails.authTimestamp)) {
            return paymentDetails.amounts.authorized > 0
                ? { allowed: true, reason: null, delayedAutoCapture: true }
                : { allowed: false, reason: Resource.msg('csc.info.refund.nothing', 'jpmcbm', null) };
        }
        return { allowed: false, reason: Resource.msg('csc.info.refund.delayed.window.active', 'jpmcbm', null) };
    }

    var refundableStatuses = [
        PAYMENT_STATUS.AUTH_AND_CAPTURE,
        PAYMENT_STATUS.CAPTURED,
        PAYMENT_STATUS.PARTIAL_CAPTURED,
        PAYMENT_STATUS.PARTIAL_REFUNDED,
        PAYMENT_STATUS.PARTIAL_VOID
    ];

    if (refundableStatuses.indexOf(status) === -1) {
        return { allowed: false, reason: null };
    }
    if (remaining <= AMOUNT_EPSILON) {
        return { allowed: false, reason: Resource.msg('csc.info.refund.nothing', 'jpmcbm', null) };
    }

    return { allowed: true, reason: null };
}

/**
 * @param {dw.order.PaymentTransaction} paymentTransaction - payment transaction to parse
 * @param {string} attributeKey - custom attribute key containing JSON history
 * @param {string} logLabel - label for error logging
 * @returns {Array} parsed history array
 */
function parseHistory(paymentTransaction, attributeKey, logLabel) {
    if (!paymentTransaction || !paymentTransaction.custom || !paymentTransaction.custom[attributeKey]) {
        return [];
    }
    try {
        return JSON.parse(paymentTransaction.custom[attributeKey]);
    } catch (e) {
        Logger.error('{0}: Failed to parse {1} - {2}', logLabel, attributeKey, e.message);
        return [];
    }
}

/**
 * @param {dw.order.PaymentTransaction} paymentTransaction - payment transaction
 * @returns {Array} capture history records
 */
function getCaptureHistory(paymentTransaction) {
    return parseHistory(paymentTransaction, 'jpmcCaptureHistory', 'getCaptureHistory');
}

/**
 * @param {dw.order.PaymentTransaction} paymentTransaction - payment transaction
 * @returns {Array} refund history records
 */
function getRefundHistory(paymentTransaction) {
    return parseHistory(paymentTransaction, 'jpmcRefundHistory', 'getRefundHistory');
}

/**
 * @param {dw.order.PaymentTransaction} paymentTransaction - payment transaction
 * @returns {Array} void history records
 */
function getVoidHistory(paymentTransaction) {
    return parseHistory(paymentTransaction, 'jpmcVoidHistory', 'getVoidHistory');
}

/**
 * @param {string} cardNumber - full or partial card number
 * @returns {string} masked card number showing last 4 digits
 */
function maskCardNumber(cardNumber) {
    if (!cardNumber || cardNumber.length < 4) return '****';
    var maskLen = cardNumber.length - 4;
    var masked = new Array(maskLen + 1).join('*');
    return masked + cardNumber.substring(maskLen);
}

/**
 * @param {string} paymentMethod - payment method ID
 * @returns {string} display name for the payment method
 */
function getPaymentMethodName(paymentMethod) {
    if (!paymentMethod) return jpmcConstants.PAYMENT_METHOD_DISPLAY_UNKNOWN;
    try {
        var PaymentMgr = require('dw/order/PaymentMgr');
        var method = PaymentMgr.getPaymentMethod(paymentMethod);
        if (method && method.name) return method.name;
    } catch (e) {
        // intentionally empty
    }
    return paymentMethod;
}

/**
 * @param {string} paymentMethod - payment method ID to check
 * @returns {boolean} true if JPMC processor handles this method
 */
function isSupportedPaymentMethod(paymentMethod) {
    if (!paymentMethod) return false;
    try {
        var PaymentMgr = require('dw/order/PaymentMgr');
        var method = PaymentMgr.getPaymentMethod(paymentMethod);
        if (!method) return false;
        var processor = method.getPaymentProcessor();
        return !!(processor && processor.ID === jpmcConstants.JPMC_Processor);
    } catch (e) {
        return false;
    }
}

module.exports = {
    PAYMENT_STATUS: PAYMENT_STATUS,
    PAYMENT_STATUS_LABELS: PAYMENT_STATUS_LABELS,
    AMOUNT_REGEX: AMOUNT_REGEX,
    DELAYED_CAPTURE_WINDOW_MINUTES: DELAYED_CAPTURE_WINDOW_MINUTES,
    isWithinDelayedCaptureWindow: isWithinDelayedCaptureWindow,
    delayedWindowMinutesRemaining: delayedWindowMinutesRemaining,
    canCapture: canCapture,
    canVoid: canVoid,
    canRefund: canRefund,
    getCaptureHistory: getCaptureHistory,
    getRefundHistory: getRefundHistory,
    getVoidHistory: getVoidHistory,
    maskCardNumber: maskCardNumber,
    getPaymentMethodName: getPaymentMethodName,
    isSupportedPaymentMethod: isSupportedPaymentMethod
};
