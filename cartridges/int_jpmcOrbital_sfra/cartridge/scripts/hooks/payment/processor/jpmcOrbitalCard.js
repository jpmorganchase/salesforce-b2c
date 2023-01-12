var Resource = require('dw/web/Resource');
var OrderMgr = require('dw/order/OrderMgr');
var OrbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var JPMCLogger = require('dw/system/Logger').getLogger('JPMCLogger', 'JPMCLogger');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
var transactionHelper = require('*/cartridge/scripts/helpers/transactionHelper');
var PaymentMgr = require('dw/order/PaymentMgr');
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
    var cardType = paymentInformation.cardType.value;
    var cardNumber = paymentInformation.cardNumber.value;
    var cardExpirationMonth = paymentInformation.expirationMonth.value;
    var cardExpirationYear = paymentInformation.expirationYear.value;
    var cardSecurityCode = paymentInformation.securityCode.value;
    var saveCustomerPaymentCheckbox = paymentInformation.jpmcCreditPaymentForm.jpmcOCreditForm.saveCustomerPaymentCheckbox.checked;
    var currentMonth = (new Date().getMonth() + 1);
    var currentYear = new Date().getFullYear();
    var currencyCode = basket.currencyCode;
    var cardErrorMessage;
    var creditCardMethod = PaymentMgr.getPaymentMethod(JPMCOrbitalConstants.CREDIT_CARD);
    var activePaymentCards = creditCardMethod.getActivePaymentCards();
    var cardTypeFullName = OrbitalAPIHelper.creditCardTypeFullName(cardNumber);
    var activeCardsArray = [];
    for (var i = 0; i < activePaymentCards.length; i++) {
        activeCardsArray.push(activePaymentCards[i].cardType);
    }
    if (activeCardsArray.indexOf(cardTypeFullName) === -1) {
        var activecardErrors = {};
        activecardErrors[paymentInformation.cardNumber.htmlName] = Resource.msg('error.invalid.card.number', 'creditCard', null);
        JPMCLogger.error('jpmcOrbitalCard.js (Handle): Card errors: {0}.', activecardErrors);

        return { fieldErrors: [activecardErrors], error: true };
    }
    if (cardType === JPMCOrbitalConstants.Unknown || !cardType) {
        var cardCCType = OrbitalAPIHelper.creditCardType(cardNumber);
        cardType = cardCCType;
    }
    if (cardNumber.length < 14 || cardNumber.length > 19) {
        var cardErrors = {};
        cardErrors[paymentInformation.cardNumber.htmlName] = Resource.msg('error.invalid.card.number', 'creditCard', null);
        JPMCLogger.error('jpmcOrbitalCard.js (Handle): Card errors: {0}.', cardErrors);

        return { fieldErrors: [cardErrors], error: true };
    }
    if (cardType === JPMCOrbitalConstants.AX && cardSecurityCode.search(/^[0-9]{4}$/) === -1) {
        var securityCodeErrors = {};
        securityCodeErrors.dwfrm_billing_jpmcOCreditForm_securityCode = Resource.msg('error.invalid.securityCode.number', 'creditCard', null);
        JPMCLogger.error('jpmcOrbitalCard.js (Handle): securityCode errors: {0}.', securityCodeErrors);
        return { fieldErrors: [securityCodeErrors], error: true };
    }
    if ((cardExpirationMonth <= currentMonth) && (cardExpirationYear <= currentYear)) {
        var cardExpiredError = {};
        cardExpiredError[paymentInformation.cardNumber.htmlName] =
                Resource.msg('error.expired.credit.card', 'creditCard', null);
        return { fieldErrors: [cardExpiredError], error: true };
    }

    var cardData = {
        cardNumber: { value: cardNumber },
        expirationMonth: { value: cardExpirationMonth },
        expirationYear: { value: cardExpirationYear },
        securityCode: { value: cardSecurityCode },
        cardType: { value: cardType }
    };
    var order = {
        currentOrderNo: OrderMgr.createOrderNo(),
        totalGrossPrice: { value: 0 },
        billingAddress: {
            address1: basket.billingAddress.address1,
            address2: basket.billingAddress.address2,
            city: basket.billingAddress.city,
            stateCode: basket.billingAddress.stateCode,
            countryCode: { value: basket.billingAddress.countryCode.value },
            postalCode: basket.billingAddress.postalCode,
            fullName: basket.billingAddress.fullName,
            phone: basket.billingAddress.phone
        }
    };
    if (!basket.billingAddress.stateCode) {
        order.billingAddress.stateCode = '';
    }

    if (cardType === JPMCOrbitalConstants.DI && (currencyCode === JPMCOrbitalConstants.GBP || currencyCode === JPMCOrbitalConstants.EUR)) {
        cardErrorMessage = {};
        cardErrorMessage[paymentInformation.cardNumber.htmlName] =
           Resource.msgf('card.error.message', 'payment', null, cardType);
        return { fieldErrors: [cardErrorMessage], error: true };
    }

    if (!preferenceHelper.isPageEncryptionEnabled()) {
        var zeroDollarResponse = {};
        try {
            var zeroDollarAuthObject = OrbitalAPIHelper.preparePaymentObjectForCardZeroAuth(order, cardData);
            zeroDollarResponse = OrbitalAPIHelper.makePaymentCallForCard(zeroDollarAuthObject);
            if (!zeroDollarResponse || zeroDollarResponse === 'Error') {
                var cardError = {};
                cardError[paymentInformation.cardNumber.htmlName] =
                        Resource.msg('error.invalid.card.number', 'creditCard', null);
                return { fieldErrors: [cardError], error: true };
            }
        } catch (error) {
            return { fieldErrors: [], serverErrors: [Resource.msg('error.technical', 'checkout', null)], error: true };
        }
    }
    var paymentMethodId = JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD;
    transactionHelper.getHandleTransaction(cardData, currentBasket, paymentMethodId, cardSecurityCode, saveCustomerPaymentCheckbox, null);
    JPMCLogger.info('jpmcOrbitalCard.js (Handle): paymentInstrument is created. cardNumber, cardExpirationMonth, cardExpirationYear, cardType are assign to paymentInstrument.');
    return { fieldErrors: {}, serverErrors: [], error: false };
}

exports.Authorize = Authorize;
exports.Handle = Handle;
