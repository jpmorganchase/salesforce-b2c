var Resource = require('dw/web/Resource');
var JPMCLogger = require('dw/system/Logger').getLogger('JPMCLogger', 'JPMCLogger');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
var transactionHelper = require('*/cartridge/scripts/helpers/transactionHelper');

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
    var customerUUID = '';
    var selectedPaymentInstrument;
    var securityCode = paymentInformation.jpmcProfilePaymentForm.jpmcOProfileForm.securityCode.value;
    try {
        customerUUID = paymentInformation.jpmcProfilePaymentForm.jpmcOProfileForm.customerRefNum.value;
        var savedPaymentInstruments = currentBasket.customer.profile.wallet.paymentInstruments;
        for (var i = 0; i < savedPaymentInstruments.length; i++) {
            if (savedPaymentInstruments[i].UUID === customerUUID) {
                selectedPaymentInstrument = savedPaymentInstruments[i];
            }
        }
    } catch (error) {
        var cardErrors = {};
        cardErrors.dwfrm_billing_jpmcOProfileForm_customerRefNum = Resource.msg('error.invalid.card.number', 'creditCard', null);
        JPMCLogger.error('jpmcOrbitalProfile.js (Handle): customerRefNum errors: {0}.', cardErrors);

        return { fieldErrors: [cardErrors], error: true };
    }
    if ((empty(securityCode) || securityCode.search(/^[0-9]{3,4}$/) === -1) && (selectedPaymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD || selectedPaymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD || selectedPaymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD)) {
        var securityCodeErrors = {};
        securityCodeErrors.dwfrm_billing_jpmcOProfileForm_securityCode = Resource.msg('error.invalid.securityCode.number', 'creditCard', null);
        JPMCLogger.error('jpmcOrbitalProfile.js (Handle): securityCode errors: {0}.', securityCodeErrors);

        return { fieldErrors: [securityCodeErrors], error: true };
    }
    var paymentMethodId = JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD;
    transactionHelper.getHandleTransaction(selectedPaymentInstrument, currentBasket, paymentMethodId, securityCode, null, null);
    JPMCLogger.info('jpmcOrbitalProfile.js (Handle): paymentInstrument is created. customerRefNum is assign to paymentInstrument.');
    return { fieldErrors: {}, serverErrors: [], error: false };
}


exports.Authorize = Authorize;
exports.Handle = Handle;
