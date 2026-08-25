'use strict';

/**
 * @module scripts/helpers/AccountUpdaterHelper
 */

var Logger = require('dw/system/Logger').getLogger('AccountUpdater', 'helper');
var Transaction = require('dw/system/Transaction');

/**
 * RTAU response codes that require a wallet payment instrument update
 * All other codes are ignored
 */
var RTAU_UPDATE_CODES = {
    NEW_ACCOUNT: true,
    NEW_ACCOUNT_AND_EXPIRY: true,
    NEW_EXPIRY: true
};

/**
 * Returns the new Safetech token from the RTAU response, or null if absent.
 * @param {Object} responseData - JPMC payment response
 * @param {Object} au - accountUpdater related response block
 * @returns {string|null} - new Safetech token or null if not present
 */
function extractRtauNewToken(responseData, au) {
    if (au && au.accountNumber) {
        return au.accountNumber;
    }

    var card = responseData.paymentMethodType && responseData.paymentMethodType.card;
    if (!card || !Array.isArray(card.paymentTokens)) {
        return null;
    }

    for (var i = 0; i < card.paymentTokens.length; i++) {
        var entry = card.paymentTokens[i];
        if (entry && entry.tokenNumber && entry.responseStatus === 'SUCCESS') {
            return entry.tokenNumber;
        }
    }
    return null;
}

/**
 * Applies an RTAU response by replacing the customer's saved payment instrument as 
 * SFCC wallet PIs cannot be mutated; a new PI is created with updated
 * values and the old one is removed
 *
 * @param {dw.customer.CustomerPaymentInstrument} paymentInstrument - wallet PI to replace
 * @param {Object} responseData - JPMC payment response
 * @param {dw.customer.Wallet} wallet - customer wallet
 * @returns {Object} summary - { updated: boolean, action: string|null }
 */
function handleRTAUResponse(paymentInstrument, responseData, wallet) {
    var summary = { updated: false, action: null };

    if (!paymentInstrument || !responseData) {
        return summary;
    }

    try {
        var card = responseData.paymentMethodType && responseData.paymentMethodType.card;
        var au = responseData.accountUpdater || (card && card.accountUpdater);
        if (!au) {
            return summary;
        }

        var responseCode = au.accountUpdaterResponse || null;
        summary.action = responseCode;

        if (!responseCode || !RTAU_UPDATE_CODES[responseCode]) {
            return summary;
        }

        var newToken = (responseCode === 'NEW_EXPIRY') ? null : extractRtauNewToken(responseData, au);
        var expiry = au.newAccountExpiry || null;
        var newMonth = expiry ? parseInt(String(expiry.month), 10) : null;
        var newYear = expiry ? parseInt(String(expiry.year), 10) : null;

        var hasTokenChange = !!newToken;
        var hasExpiryChange = !!(newMonth && newYear);

        if (!hasTokenChange && !hasExpiryChange) {
            Logger.warn('RTAU {0}: no actionable data in response; update skipped', responseCode);
            return summary;
        }

        if (!wallet) {
            Logger.warn('RTAU {0}: wallet unavailable; update skipped', responseCode);
            return summary;
        }

        var PaymentInstrument = require('dw/order/PaymentInstrument');

        Transaction.wrap(function () {
            var holder = paymentInstrument.getCreditCardHolder();
            var number = paymentInstrument.getCreditCardNumber();
            var type = paymentInstrument.getCreditCardType();
            var currentToken = paymentInstrument.getCreditCardToken();
            var currentMonth = paymentInstrument.getCreditCardExpirationMonth();
            var currentYear = paymentInstrument.getCreditCardExpirationYear();

            var newPI = wallet.createPaymentInstrument(PaymentInstrument.METHOD_CREDIT_CARD);
            newPI.setCreditCardHolder(holder);
            newPI.setCreditCardNumber(number);
            newPI.setCreditCardType(type);
            newPI.setCreditCardExpirationMonth(hasExpiryChange ? newMonth : currentMonth);
            newPI.setCreditCardExpirationYear(hasExpiryChange ? newYear : currentYear);
            newPI.setCreditCardToken(hasTokenChange ? newToken : currentToken);
            wallet.removePaymentInstrument(paymentInstrument);
        });

        summary.updated = true;
    } catch (e) {
        Logger.warn('handleRTAUResponse: {0}', e.message || String(e));
    }

    return summary;
}

/**
 * Locates the saved payment instrument for a stored-card order and applies any
 * RTAU updates from the authorization response
 *
 * @param {dw.order.Order} order - order to process RTAU for
 * @param {Object} responseData - JPMC authorization response data
 */
function processRTAUForOrder(order, responseData) {
    try {
        if (!order || !responseData) {
            return;
        }

        var resolvedConfig = require('*/cartridge/scripts/helpers/JPMCMerchantResolver').resolveForOrder(order);
        if (!resolvedConfig || resolvedConfig.accountUpdaterMode !== 'REAL_TIME') {
            return;
        }

        var customer = order.getCustomer();
        if (!customer || !customer.isRegistered()) {
            return;
        }

        var wallet = customer.getProfile().getWallet();

        var PaymentInstrument = require('dw/order/PaymentInstrument');
        var orderPIs = order.getPaymentInstruments(PaymentInstrument.METHOD_CREDIT_CARD);
        if (!orderPIs || orderPIs.isEmpty()) {
            return;
        }

        var orderPI = orderPIs.iterator().next();
        var creditCardToken = orderPI ? orderPI.getCreditCardToken() : null;
        if (!creditCardToken) {
            return;
        }

        var custPI = null;
        var it = wallet.getPaymentInstruments(PaymentInstrument.METHOD_CREDIT_CARD).iterator();
        while (it.hasNext()) {
            var pi = it.next();
            if (pi && pi.getCreditCardToken() === creditCardToken) {
                custPI = pi;
                break;
            }
        }

        if (!custPI) {
            return;
        }

        handleRTAUResponse(custPI, responseData, wallet);
    } catch (e) {
        Logger.warn('processRTAUForOrder: {0}', e.message || String(e));
    }
}

module.exports = {
    handleRTAUResponse: handleRTAUResponse,
    processRTAUForOrder: processRTAUForOrder
};
