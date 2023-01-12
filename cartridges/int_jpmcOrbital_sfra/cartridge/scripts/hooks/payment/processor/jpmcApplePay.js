'use strict';

/* eslint-disable no-param-reassign */
var JPMCLogger = require('dw/system/Logger').getLogger('JPMCLogger', 'JPMCLogger');
var Resource = require('dw/web/Resource');
var transactionHelper = require('*/cartridge/scripts/helpers/transactionHelper');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 * Verifies that entered credit card information is a valid card. If the information is valid a
 * credit card payment instrument is created
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @param {string} paymentMethodID - paymentmethodID
 * @param {Object} req the request object
 * @return {Object} returns an error object
 */
function Handle(basket, paymentInformation) {
    var currentBasket = basket;
    var securityCode = paymentInformation.jpmcOApplePayForm.jpmcOApplePayForm.securityCodeApple.value;
    var saveCustomerPaymentCheckboxAP = paymentInformation.jpmcOApplePayForm.jpmcOApplePayForm.saveCustomerPaymentCheckboxAP.checked;
    if ((empty(securityCode) || securityCode.search(/^[0-9]{3,4}$/) === -1)) {
        var securityCodeErrors = {};
        securityCodeErrors.dwfrm_billing_jpmcOApplePayForm_securityCodeApple = Resource.msg('error.invalid.securityCode.number', 'creditCard', null);
        JPMCLogger.error('jpmcApplePay.js (Handle): securityCodeApple errors: {0}.', securityCodeErrors);

        return { fieldErrors: [securityCodeErrors], error: true };
    }
    var paymentMethodId = JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD;
    transactionHelper.getHandleTransaction(null, currentBasket, paymentMethodId, securityCode, saveCustomerPaymentCheckboxAP, null, null, paymentInformation.applepay.value);

    return { fieldErrors: {}, serverErrors: [], error: false };
}

/**
 * @description Create payment data and make call to API
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current payment method
 * @returns {Object} - Object containing errors or redirect token and URL
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var authorize = transactionHelper.getAuthorize(orderNumber, paymentInstrument, paymentProcessor);
    return {
        serverErrors: authorize.serverErrors,
        error: authorize.error
    };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
