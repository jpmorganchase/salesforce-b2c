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
    var saveCustomerPaymentCheckboxEC = paymentInformation.jpmcElectronicCheckPaymentForm.jpmcOElectronicCheckForm.saveCustomerPaymentCheckboxEC.checked;
    var PaymentObject = {};
    try {
        PaymentObject.ecpCheckRT = paymentInformation.ecpCheckRT.value;
        PaymentObject.ecpCheckDDA = paymentInformation.ecpCheckDDA.value;
        PaymentObject.ecpBankAcctType = paymentInformation.ecpBankAcctType.value;
    } catch (error) {
        var fieldErrors = {};
        fieldErrors[paymentInformation] = Resource.msg('ecp.invalid.electronicCheckPayment.error', 'payment', null);
        JPMCLogger.error('jpmcOrbitalElectronicCheck.js (Handle): electronicCheck field errors: {0}.', fieldErrors);

        return { fieldErrors: [fieldErrors], error: true };
    }
    var paymentMethodId = JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD;
    transactionHelper.getHandleTransaction(PaymentObject, currentBasket, paymentMethodId, null, saveCustomerPaymentCheckboxEC, null);
    JPMCLogger.info('jpmcOrbitalElectronicCheck.js (Handle): paymentInstrument is created. ecpCheckRT, ecpCheckDDA and ecpBankAcctType are assign to paymentInstrument.');
    return { fieldErrors: {}, serverErrors: [], error: false };
}


exports.Authorize = Authorize;
exports.Handle = Handle;
