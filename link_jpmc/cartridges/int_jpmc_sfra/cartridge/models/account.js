'use strict';

var baseAccount = module.superModule;
var URLUtils = require('dw/web/URLUtils');
var Customer = require('dw/customer/Customer');

/**
 * @param {Object} pi - payment instrument
 * @returns {string|null} result
 */
function getMerchantId(pi) {
    if (pi.custom && pi.custom.jpmcMerchantId) {
        return pi.custom.jpmcMerchantId;
    }
    if (pi.raw && pi.raw.custom && pi.raw.custom.jpmcMerchantId) {
        return pi.raw.custom.jpmcMerchantId;
    }
    return null;
}

/**
 * @param {Array} paymentInstruments - customer payment instruments
 * @param {string|null} currentMerchantId - active merchant ID for filtering
 * @returns {Array} filtered payment instruments
 */
function filterByMerchant(paymentInstruments, currentMerchantId) {
    if (!currentMerchantId || !paymentInstruments || !paymentInstruments.length) {
        return paymentInstruments || [];
    }
    return paymentInstruments.filter(function (pi) {
        var piMid = getMerchantId(pi);
        return !piMid || piMid === currentMerchantId;
    });
}

/**
 * Builds a plain payment-summary object from the first matching instrument.
 * @param {Array} instruments - already-filtered payment instruments
 * @returns {Object|null} result
 */
function getPayment(instruments) {
    if (!instruments || !instruments.length) {
        return null;
    }
    var pi = instruments[0];
    return {
        maskedCreditCardNumber: pi.maskedCreditCardNumber,
        creditCardType: pi.creditCardType || 'Card',
        creditCardExpirationMonth: pi.creditCardExpirationMonth,
        creditCardExpirationYear: pi.creditCardExpirationYear
    };
}

/**
 * Maps raw/wrapped payment instruments into plain objects for templates.
 * @param {Array} instruments - already-filtered payment instruments
 * @returns {Array} result
 */
function mapPaymentInstruments(instruments) {
    if (!instruments || !instruments.length) {
        return [];
    }
    var mapped = instruments.map(function (pi) {
        var cardType = pi.creditCardType || 'Card';
        var result = {
            creditCardHolder: pi.creditCardHolder,
            maskedCreditCardNumber: pi.maskedCreditCardNumber,
            creditCardType: cardType,
            creditCardExpirationMonth: pi.creditCardExpirationMonth,
            creditCardExpirationYear: pi.creditCardExpirationYear,
            UUID: pi.UUID
        };
        result.cardTypeImage = {
            src: URLUtils.staticURL('/images/'
                + cardType.toLowerCase().replace(/\s/g, '')
                + '-dark.svg'),
            alt: cardType
        };
        return result;
    });
    return mapped;
}

/**
 * Account class — extends base with merchant-filtered payment instruments.
 * @param {Object} currentCustomer - Current customer
 * @param {Object} addressModel - preferred address model
 * @param {Object} orderModel - order model
 * @param {string} [currentMerchantId] - merchant ID for filtering
 * @constructor
 */
function account(currentCustomer, addressModel, orderModel, currentMerchantId) {
    baseAccount.call(this, currentCustomer, addressModel, orderModel);

    var rawInstruments;
    if (currentCustomer instanceof Customer) {
        rawInstruments = currentCustomer.profile.wallet
            && currentCustomer.profile.wallet.paymentInstruments
            ? currentCustomer.profile.wallet.paymentInstruments.toArray()
            : [];
    } else {
        rawInstruments = currentCustomer.wallet
            && currentCustomer.wallet.paymentInstruments
            ? currentCustomer.wallet.paymentInstruments
            : [];
    }

    var filtered = filterByMerchant(rawInstruments, currentMerchantId);
    this.payment = getPayment(filtered);
    this.customerPaymentInstruments = mapPaymentInstruments(filtered);
}

account.prototype = Object.create(baseAccount.prototype);
account.prototype.constructor = account;
account.getCustomerPaymentInstruments = mapPaymentInstruments;

module.exports = account;
