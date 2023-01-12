'use strict';

var server = require('server');
server.extend(module.superModule);
var JPMCLogger = require('dw/system/Logger').getLogger('JPMCLogger', 'JPMCLogger');
var BasketMgr = require('dw/order/BasketMgr');
var Transaction = require('dw/system/Transaction');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
* CheckoutServices-SubmitPayment : The CheckoutServices-SubmitPayment endpoint will submit the payment information and render the checkout place order page allowing the shopper to confirm and place the order
* @name Base/CheckoutServices-SubmitPayment
* @function
* @memberof CheckoutServices
* @param {middleware} - csrfProtection.validateAjaxRequest
* @param {httpparameter} - csrf_token - hidden input field CSRF token
* @param {category} - sensitive
* @param {returns} - json
* @param {serverfunction} - post
*/
server.append('SubmitPayment', function (req, res, next) {
    var viewData = res.getViewData();
    var paymentForm = server.forms.getForm('billing');
    if (!viewData.paymentInformation) {
        JPMCLogger.info('CheckoutServices.js (SubmitPayment): paymentInformation is missing');
        return next();
    }
    if (paymentForm.paymentMethod.value === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
        viewData.paymentInformation.jpmcCreditPaymentForm = paymentForm;
    }
    if (paymentForm.paymentMethod.value === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD) {
        viewData.paymentInformation.jpmcProfilePaymentForm = paymentForm;
    }
    if (paymentForm.paymentMethod.value === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
        viewData.paymentInformation.jpmcOGooglePayForm = paymentForm;
    }
    if (paymentForm.paymentMethod.value === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
        viewData.paymentInformation.jpmcOVisaPayForm = paymentForm;
    }
    if (paymentForm.paymentMethod.value === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
        viewData.paymentInformation.jpmcElectronicCheckPaymentForm = paymentForm;
    }
    if (paymentForm.paymentMethod.value === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
        viewData.paymentInformation.jpmcOApplePayForm = paymentForm;
    }

    res.setViewData(viewData);

    return next();
});

/**
 * CheckoutServices-PlaceOrder : The CheckoutServices-PlaceOrder endpoint places the order
 * @name Base/CheckoutServices-PlaceOrder
 * @function
 * @memberof CheckoutServices
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.prepend('PlaceOrder', function (req, res, next) {
    var currentBasket = BasketMgr.getCurrentBasket();
    var paymentInstruments = currentBasket.getPaymentInstruments();
    for (var i = 0; i < paymentInstruments.length; i++) {
        var paymentInstrument = paymentInstruments[i];
        if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD) {
            // eslint-disable-next-line no-loop-func
            Transaction.wrap(function () {
                var cardType = paymentInstrument.creditCardType;
                var newMethodID = JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD;
                if (cardType === JPMCOrbitalConstants.EC) {
                    newMethodID = JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK;
                }
                if (cardType === JPMCOrbitalConstants.GOOGLE) {
                    newMethodID = JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY;
                }
                if (cardType === JPMCOrbitalConstants.VISA_CHECKOUT) {
                    newMethodID = JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_VISA_CHECKOUT;
                }
                if (cardType === JPMCOrbitalConstants.APPLE) {
                    newMethodID = JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_APPLE_PAY;
                }
                var amount = currentBasket.getTotalGrossPrice();
                var newPaymentInstrument = currentBasket.createPaymentInstrument(newMethodID, amount);
                if (newMethodID !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK) {
                    newPaymentInstrument.setCreditCardHolder(paymentInstrument.creditCardHolder);
                    newPaymentInstrument.setCreditCardNumber(paymentInstrument.getCreditCardNumber());
                    newPaymentInstrument.setCreditCardHolder(paymentInstrument.getCreditCardHolder());
                    newPaymentInstrument.setCreditCardExpirationMonth(paymentInstrument.getCreditCardExpirationMonth());
                    newPaymentInstrument.setCreditCardExpirationYear(paymentInstrument.getCreditCardExpirationYear());
                    newPaymentInstrument.custom.jpmco_cardNumber = newPaymentInstrument.maskedCreditCardNumber;
                    newPaymentInstrument.custom.jpmco_cardHolderName = newPaymentInstrument.creditCardHolder;
                    newPaymentInstrument.custom.jpmco_cardBrand = paymentInstrument.custom.jpmco_cardBrand;
                } else {
                    newPaymentInstrument.setBankAccountNumber(session.privacy.ecpCheckDDA);
                    newPaymentInstrument.setCreditCardNumber(session.privacy.ecpCheckDDA);
                    newPaymentInstrument.setBankRoutingNumber(session.privacy.ecpCheckRT);
                    session.privacy.ecpCheckDDA = newPaymentInstrument.maskedBankAccountNumber;
                }
                newPaymentInstrument.setCreditCardType(cardType);
                newPaymentInstrument.setCreditCardToken(paymentInstrument.creditCardToken);
                currentBasket.removePaymentInstrument(paymentInstrument);
                JPMCLogger.info('jpmcOrbitalProfile.js (PlaceOrder): paymentInstrument is created. customerRefNum is assign to paymentInstrument.');
            });
            break;
        }
    }
    next();
});

module.exports = server.exports();
