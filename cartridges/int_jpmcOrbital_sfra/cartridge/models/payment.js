'use strict';

var base = module.superModule;

var PaymentMgr = require('dw/order/PaymentMgr');
var collections = require('*/cartridge/scripts/util/collections');
var jpmcOrbitalEnabled = require('*/cartridge/scripts/helpers/preferenceHelper').isOrbitalAPIEnabled();
var googlePayEnabled = require('*/cartridge/scripts/helpers/preferenceHelper').isGooglePayEnabled();
var applePayEnabled = require('*/cartridge/scripts/helpers/preferenceHelper').isApplePayEnabled();
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
var visaPayEnabled = require('*/cartridge/scripts/helpers/preferenceHelper').isVisaPayEnabled();

/**
 * Creates an array of objects containing applicable payment methods
 * @param {dw.util.ArrayList<dw.order.dw.order.PaymentMethod>} paymentMethods - An ArrayList of
 *      applicable payment methods that the user could use for the current basket.
 * @param {dw.customer.Customer} currentCustomer - the associated Customer object
 * @returns {Array} of object that contain information about the applicable payment methods for the
 *      current cart
 */
function applicablePaymentMethods(paymentMethods, currentCustomer) {
    var jpmcOrbitalPlatform = require('*/cartridge/scripts/helpers/preferenceHelper').getPaymentPlatformMode();
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var activeProfilePayments = false;
    var isFirstDigitalWallet = false;

    if (currentCustomer.authenticated
        && currentCustomer.registered) {
        var customerNo = currentCustomer.profile.customerNo;
        activeProfilePayments = !!(orbitalAPIHelper.activeProfilePayments(customerNo) && orbitalAPIHelper.activeProfilePayments(customerNo).length);
    }

    return collections.map(paymentMethods, function (method) {
        var templateTab = false;
        var templateContent = false;
        var displayDigitalWallet = false;
        var paymentMethod = {
            templateTab: templateTab,
            templateContent: templateContent
        };
        if (method.ID === JPMCOrbitalConstants.CREDIT_CARD && !jpmcOrbitalEnabled) {
            templateTab = 'checkout/billing/paymentOptions/creditCardTab';
            templateContent = 'checkout/billing/paymentOptions/creditCardContent';
        }
        if (method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD && jpmcOrbitalEnabled) {
            templateTab = 'checkout/billing/paymentOptions/jpmcOCreditTab';
            templateContent = 'checkout/billing/paymentOptions/jpmcOCreditContent';
        }
        if (method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD && jpmcOrbitalEnabled && activeProfilePayments) {
            templateTab = 'checkout/billing/paymentOptions/jpmcOProfileTab';
            templateContent = 'checkout/billing/paymentOptions/jpmcOProfileContent';
        }
        if (method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD && jpmcOrbitalEnabled && jpmcOrbitalPlatform === JPMCOrbitalConstants.stratus) {
            templateTab = 'checkout/billing/paymentOptions/jpmcOElectronicCheckTab';
            templateContent = 'checkout/billing/paymentOptions/jpmcOElectronicCheckContent';
        }
        if (method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD && jpmcOrbitalEnabled && googlePayEnabled) {
            templateTab = 'checkout/billing/paymentOptions/jpmcOGooglePayTab';
            templateContent = 'checkout/billing/paymentOptions/jpmcOGooglePayContent';
            if (!isFirstDigitalWallet) {
                displayDigitalWallet = true;
                isFirstDigitalWallet = true;
            }
        }
        if (method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD && jpmcOrbitalEnabled && visaPayEnabled) {
            templateTab = 'checkout/billing/paymentOptions/jpmcOVisaPayTab';
            templateContent = 'checkout/billing/paymentOptions/jpmcOVisaPayContent';
            if (!isFirstDigitalWallet) {
                displayDigitalWallet = true;
                isFirstDigitalWallet = true;
            }
        }
        if (method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD && jpmcOrbitalEnabled && applePayEnabled) {
            templateTab = 'checkout/billing/paymentOptions/jpmcOApplePayTab';
            templateContent = 'checkout/billing/paymentOptions/jpmcOApplePayContent';
            if (!isFirstDigitalWallet) {
                displayDigitalWallet = true;
                isFirstDigitalWallet = true;
            }
        }

        if (templateTab && templateContent) {
            paymentMethod = {
                templateTab: templateTab,
                templateContent: templateContent,
                ID: method.ID,
                name: method.name,
                displayDigitalWallet: displayDigitalWallet,
                hideDisplayDigitalWallet: activeProfilePayments ? JPMCOrbitalConstants.hidden : '',
                isHidden: (!activeProfilePayments && (method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD ||
                    method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD ||
                    method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK ||
                    method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY ||
                    method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_VISA_CHECKOUT ||
                    method.ID === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_APPLE_PAY)) || (activeProfilePayments && (method.ID !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD &&
                        method.ID !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD &&
                        method.ID !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK &&
                        method.ID !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY &&
                        method.ID !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_VISA_CHECKOUT &&
                        method.ID !== JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD)) ? JPMCOrbitalConstants.hidden : ''


            };
        }

        return paymentMethod;
    });
}

/**
 * Creates an array of objects containing selected payment information
 * @param {dw.util.ArrayList<dw.order.PaymentInstrument>} selectedPaymentInstruments - ArrayList
 *      of payment instruments that the user is using to pay for the current basket
 * @returns {Array} Array of objects that contain information about the selected payment instruments
 */
function getSelectedPaymentInstruments(selectedPaymentInstruments) {
    return collections.map(selectedPaymentInstruments, function (paymentInstrument) {
        var results = {
            paymentMethod: paymentInstrument.paymentMethod,
            amount: paymentInstrument.paymentTransaction.amount.value,
            template: false
        };
        if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.CREDIT_CARD) {
            results.lastFour = paymentInstrument.creditCardNumberLastDigits;
            results.owner = paymentInstrument.creditCardHolder;
            results.expirationYear = paymentInstrument.creditCardExpirationYear;
            results.type = paymentInstrument.creditCardType;
            results.maskedCreditCardNumber = paymentInstrument.maskedCreditCardNumber;
            results.expirationMonth = paymentInstrument.creditCardExpirationMonth;
            results.template = jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/creditCardSummary';
        } else if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.GIFT_CERTIFICATE) {
            results.giftCertificateCode = paymentInstrument.giftCertificateCode;
            results.maskedGiftCertificateCode = paymentInstrument.maskedGiftCertificateCode;
        } else if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
            results.lastFour = paymentInstrument.creditCardNumberLastDigits;
            results.owner = paymentInstrument.creditCardHolder;
            results.expirationYear = paymentInstrument.creditCardExpirationYear;
            results.type = paymentInstrument.creditCardType;
            results.maskedCreditCardNumber = paymentInstrument.maskedCreditCardNumber;
            results.expirationMonth = paymentInstrument.creditCardExpirationMonth;
            results.template = jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/paymentOptionsSummaryCC';
        } else if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD ||
        paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD ||
        paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK ||
        paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY ||
        paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_VISA_CHECKOUT ||
        paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_APPLE_PAY) {
            results.owner = paymentInstrument.creditCardHolder;
            if (paymentInstrument.creditCardType !== JPMCOrbitalConstants.EC) {
                results.lastFour = paymentInstrument.creditCardNumberLastDigits;
                results.expirationYear = paymentInstrument.creditCardExpirationYear;
                results.type = paymentInstrument.creditCardType;
                results.maskedCreditCardNumber = paymentInstrument.maskedCreditCardNumber;
                results.expirationMonth = paymentInstrument.creditCardExpirationMonth;
                if (paymentInstrument.creditCardType === JPMCOrbitalConstants.GOOGLE) {
                    results.template = jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/paymentOptionsSummaryGP';
                } else if (paymentInstrument.creditCardType === JPMCOrbitalConstants.VISA_CHECKOUT) {
                    results.template = jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/paymentOptionsSummaryVP';
                } else if (paymentInstrument.creditCardType === JPMCOrbitalConstants.APPLE) {
                    results.template = jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/paymentOptionsSummaryAP';
                } else {
                    results.template = jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/paymentOptionsSummaryCC';
                }
            } else {
                results.maskedBankAccountNumber = paymentInstrument.maskedCreditCardNumber;
                results.creditCardType = paymentInstrument.creditCardType;
                results.template = jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/paymentOptionsSummaryEC';
            }
        } else if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
            results.lastFour = paymentInstrument.creditCardNumberLastDigits;
            results.owner = paymentInstrument.creditCardHolder;
            results.expirationYear = paymentInstrument.creditCardExpirationYear;
            results.type = paymentInstrument.creditCardType;
            results.maskedCreditCardNumber = paymentInstrument.maskedCreditCardNumber;
            results.expirationMonth = paymentInstrument.creditCardExpirationMonth;
            results.template = googlePayEnabled && jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/paymentOptionsSummaryGP';
        } else if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
            results.expirationYear = paymentInstrument.creditCardExpirationYear;
            results.type = paymentInstrument.creditCardType;
            results.maskedCreditCardNumber = paymentInstrument.maskedCreditCardNumber;
            results.expirationMonth = paymentInstrument.creditCardExpirationMonth;
            results.template = googlePayEnabled && jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/paymentOptionsSummaryAP';
        } else if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
            results.maskedBankAccountNumber = paymentInstrument.maskedBankAccountNumber;
            results.creditCardType = JPMCOrbitalConstants.EC;
            results.template = jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/paymentOptionsSummaryEC';
        } else if (paymentInstrument.paymentMethod === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
            results.lastFour = paymentInstrument.creditCardNumberLastDigits;
            results.owner = paymentInstrument.creditCardHolder;
            results.expirationYear = paymentInstrument.creditCardExpirationYear;
            results.type = paymentInstrument.creditCardType;
            results.maskedCreditCardNumber = paymentInstrument.maskedCreditCardNumber;
            results.expirationMonth = paymentInstrument.creditCardExpirationMonth;
            results.template = visaPayEnabled && jpmcOrbitalEnabled && 'checkout/billing/paymentOptions/paymentOptionsSummaryVP';
        }
        return results;
    });
}

/**
 * Payment class that represents payment information for the current basket
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @param {dw.customer.Customer} currentCustomer - the associated Customer object
 * @param {string} countryCode - the associated Site countryCode
 * @constructor
 */
function Payment(currentBasket, currentCustomer, countryCode) {
    base.call(this, currentBasket, currentCustomer, countryCode);

    var paymentAmount = currentBasket.totalGrossPrice;
    var paymentMethods = PaymentMgr.getApplicablePaymentMethods(
        currentCustomer,
        countryCode,
        paymentAmount.value
    );

    var paymentInstruments = currentBasket.paymentInstruments;

    this.applicablePaymentMethods =
    paymentMethods ? applicablePaymentMethods(paymentMethods, currentCustomer) : null;
    this.selectedPaymentInstruments = paymentInstruments ?
        getSelectedPaymentInstruments(paymentInstruments) : null;
}


module.exports = Payment;
