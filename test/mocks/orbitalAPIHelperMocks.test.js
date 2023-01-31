'use strict';

var Site = {
    getCurrent: function () {
        return {
            getCustomPreferenceValue: function () {
                return {
                };
            }
        };
    },
    current: {
        ID: 'SFRA_V_6'
    }
};
var JPMCOPaymentServices = require('../mocks/jpmcOServicesMocks.test');
var PaymentModel = require('../mocks/jpmcModelsMocks/paymentModelMock.test');
var JpmcMerchantModel = require('../mocks/jpmcModelsMocks/jpmcMerchantModelMock.test');
var CacheMgr = {
    getCache: function () {
        return {
            get: function () {
                return {
                };
            }
        };
    }
};
var Resource = {};
var preferenceHelper = require('../mocks/preferenceHelperMocks.test');
var JPMCOrbitalConstants = require('../mocks/jpmcOConstantsHelperMocks.test');

/**
 *
 * @returns {Object}  Returns billingform Object.
 */
function prepareBillingFormJPMC() {
    var server = require('server');
    var billingForm = server.forms.getForm('billing');
    billingForm.clear();

    return billingForm;
}
/**
 *
 * @param {Object} order order Object.
 * @param {Object} cardData raw cardData object from form.
 * @param {string} paymentMethod paymentMethod.
 * @returns {Object} returns paymentObject object, required for payment service call.
 * @desc prepares paymentObject object, required for payment service call.
 */
function preparePaymentObjectForCard(order, cardData, paymentMethod) {
    var jpmcOPaymentMode = preferenceHelper.getPaymentModeCard();
    var paymentObject = {};
    if (jpmcOPaymentMode === JPMCOrbitalConstants.Authorization) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForCardAuthorizationOnly(order, cardData, paymentMethod));
    }
    if (jpmcOPaymentMode === JPMCOrbitalConstants.AuthorizationAndCapture) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForCardAuthorizationAndCapture(order, cardData, paymentMethod));
    }
    return paymentObject;
}
/**
 * @param {Object} jpmcOPaymentObject paymentObjects object.
 * @returns {Object}  Returns parsedResponse Object.
 * @desc payment service call.
 */
function makePaymentCallForCard(jpmcOPaymentObject) {
    if	(jpmcOPaymentObject) {
        var service = new JPMCOPaymentServices();
        var response = service.payments(jpmcOPaymentObject);
        return response.responseBody;
    }
    return null;
}

/**
 * @param {Object} order order Object
 * @param {Object} cardData raw cardData object from form.
 * @returns {Object}  Returns paymentObject Object.
 * @desc prepares paymentObject object, required for payment service call.
 */
function preparePaymentObjectForCardZeroAuth(order, cardData) {
    var paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForCardZeroAuth(order, cardData));
    return paymentObject;
}

/**
 * @param {Object} order order Object.
 * @param {string} customerRefNum customerRefNum.
 * @param {string} customerPaymentType customerPaymentType
 * @param {string} securityCode securityCode.
 * @returns {Object}  Returns paymentObject Object.
 */
function preparePaymentObjectForProfile(order, customerRefNum, customerPaymentType, securityCode) {
    var jpmcOPaymentMode = preferenceHelper.getPaymentModeProfile();
    var paymentObject = {};
    if (jpmcOPaymentMode === JPMCOrbitalConstants.Authorization) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForProfileAuthorizationOnly(order, customerRefNum, customerPaymentType, securityCode));
    }
    if (jpmcOPaymentMode === JPMCOrbitalConstants.AuthorizationAndCapture) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForProfileAuthorizationAndCapture(order, customerRefNum, customerPaymentType, securityCode));
    }
    return paymentObject;
}

/**
 *
* @param {Object} jpmcOPaymentObject paymentObjects object.
* @returns {Object} response from payment service.
* @desc payment service call for Profile
 */
function makePaymentCallForProfile(jpmcOPaymentObject) {
    if	(jpmcOPaymentObject) {
        var service = new JPMCOPaymentServices();
        var response = service.payments(jpmcOPaymentObject);
        return response.responseBody;
    }
    return null;
}

/**
 *
* @param {Object} jpmcOPaymentObject paymentObjects object.
* @returns {Object} response from payment service.
* @desc payment service call for Profile
 */
function makeRecurringPaymentCall(jpmcOPaymentObject) {
    if	(jpmcOPaymentObject) {
        var jpmcOPO = jpmcOPaymentObject;
        jpmcOPO.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.MREC
        };
        var service = new JPMCOPaymentServices();
        var response = service.payments(jpmcOPO);
        return response.responseBody;
    }
    return null;
}


/**
 *
 * @param {Object} order order Object.
 * @param {Object} eCheckData raw eCheckData object from form.
 * @returns {Object} returns paymentObject object, required for payment service call.
 * @desc prepares paymentObject object, required for payment service call.
 */
function preparePaymentObjectForElectronicCheck(order, eCheckData) {
    var jpmcOPaymentMode = preferenceHelper.getPaymentModeElectronicCheck();
    var paymentObject = {};
    if (jpmcOPaymentMode === JPMCOrbitalConstants.Authorization) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForElectronicCheckAuthorizationOnly(order, eCheckData));
    }
    if (jpmcOPaymentMode === JPMCOrbitalConstants.AuthorizationAndCapture) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForElectronicCheckAuthorizationAndCapture(order, eCheckData));
    }
    return paymentObject;
}

/**
 * @param {Object} jpmcOPaymentObject paymentObjects object.
 * @returns {Object}  Returns parsedResponse Object.
 * @desc payment service call.
 */
function makePaymentCallForElectronicCheck(jpmcOPaymentObject) {
    if	(jpmcOPaymentObject) {
        var service = new JPMCOPaymentServices();
        var response = service.payments(jpmcOPaymentObject);
        return response.responseBody;
    }
    return null;
}

/**
 * @param {string} orderID orderID.
 * generate unique id
 * @param {string} type indique type of payment that we use
 * @returns {string} unique id
 */
function getRetryTrace(orderID, type) {
    const cache = CacheMgr.getCache(JPMCOrbitalConstants.retryTrace);
    return cache.get(Site.current.ID + type + 'retry-trace-' + orderID, function () {
        var maxLength = 1000000000000000;

        return Math.floor(Math.random() * maxLength);
    });
}

/**
 * creditCardType
 * @param {*} cc creditcard
 * @returns {*} type
 */
function creditCardType(cc) {
    let amex = new RegExp('^3[47][0-9]{13}$');
    let visa = new RegExp('^4[0-9]{12}(?:[0-9]{3})?$');

    let mastercard = new RegExp('^5[1-5][0-9]{14}$');
    let mastercard2 = new RegExp('^2[2-7][0-9]{14}$');

    let disco1 = new RegExp('^6011[0-9]{12}[0-9]*$');
    let disco2 = new RegExp('^62[24568][0-9]{13}[0-9]*$');
    let disco3 = new RegExp('^6[45][0-9]{14}[0-9]*$');

    let diners = new RegExp('^3[0689][0-9]{12}[0-9]*$');

    let maestro = new RegExp('^(?:5[0678][0-9]{0,2}|6304|67[0-9]{0,2})[0-9]{0,15}');

    let jcb = new RegExp('^35[0-9]{14}[0-9]*$');

    if (visa.test(cc)) {
        return JPMCOrbitalConstants.VI;
    }
    if (amex.test(cc)) {
        return JPMCOrbitalConstants.AX;
    }
    if (mastercard.test(cc) || mastercard2.test(cc)) {
        return JPMCOrbitalConstants.MC;
    }
    if (disco1.test(cc) || disco2.test(cc) || disco3.test(cc) || diners.test(cc)) {
        return JPMCOrbitalConstants.DI;
    }
    if (maestro.test(cc)) {
        return JPMCOrbitalConstants.IM;
    }
    if (jcb.test(cc)) {
        return JPMCOrbitalConstants.JC;
    }

    return undefined;
}

 /**
     * creditCardType
     * @param {string} cc cc
     * @returns {string} type
     */
function creditCardTypeFullName(cc) {
    let amex = new RegExp('^3[47][0-9]{13}$');
    let visa = new RegExp('^4[0-9]{12}(?:[0-9]{3})?$');

    let mastercard = new RegExp('^5[1-5][0-9]{14}$');
    let mastercard2 = new RegExp('^2[2-7][0-9]{14}$');

    let disco1 = new RegExp('^6011[0-9]{12}[0-9]*$');
    let disco2 = new RegExp('^62[24568][0-9]{13}[0-9]*$');
    let disco3 = new RegExp('^6[45][0-9]{14}[0-9]*$');

    let diners = new RegExp('^3[0689][0-9]{12}[0-9]*$');
    let jcb = new RegExp('^35[0-9]{14}[0-9]*$');
    let maestro = new RegExp('^(?:5[0678][0-9]{0,2}|6304|67[0-9]{0,2})[0-9]{0,15}');

    if (visa.test(cc)) {
        return JPMCOrbitalConstants.Visa;
    }
    if (amex.test(cc)) {
        return JPMCOrbitalConstants.Amex;
    }
    if (mastercard.test(cc) || mastercard2.test(cc)) {
        return JPMCOrbitalConstants.Master_Card;
    }
    if (disco1.test(cc) || disco2.test(cc) || disco3.test(cc)) {
        return JPMCOrbitalConstants.Discover;
    }
    if (diners.test(cc)) {
        return JPMCOrbitalConstants.Diners;
    }
    if (jcb.test(cc)) {
        return JPMCOrbitalConstants.Jcb;
    }
    if (maestro.test(cc)) {
        return JPMCOrbitalConstants.International_Maestro;
    }
    return undefined;
}
/**
 * save customer payment
 * @param {*} customerNo customerNo
 * @param {*} paymentMethodID paymentMethodID
 * @param {*} token token
 * @param {*} form form
 * @param {*} cardBrand cardBrand
 */
function saveCustomerPayment(customerNo, paymentMethodID, token, form, cardBrand) {
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var Transaction = require('dw/system/Transaction');
    var customer = CustomerMgr.getCustomerByCustomerNumber(customerNo);
    Transaction.wrap(function () { // NOSONAR
        var newPaymentInstrument = customer.profile.wallet.createPaymentInstrument(paymentMethodID);
        var name = customer.profile.firstName + ' ' + customer.profile.lastName;

        if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD || paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD || paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD || paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
            if (cardBrand) {
                newPaymentInstrument.custom.jpmco_cardBrand = cardBrand;
            }
            if (!empty(form.googlePayToken)) {
                session.privacy.googlePayToken = form.googlePayToken;
            }
            if (!empty(form.visaPay)) {
                session.privacy.visaPay = form.visaPay;
            }
            if (!empty(form.applePay)) {
                session.privacy.applePay = form.applePay;
            }
            if (!empty(form.expirationYear.value) && !empty(form.expirationMonth.value)) {
                newPaymentInstrument.setCreditCardExpirationYear(parseInt(form.expirationYear.value, 10));
                newPaymentInstrument.setCreditCardExpirationMonth(parseInt(form.expirationMonth.value, 10));
            }
            if (!empty(form.cardNumber.value)) {
                newPaymentInstrument.setCreditCardNumber(form.cardNumber.value);
            }
            if (!empty(form.cardType.value)) {
                var cardType = form.cardType.value;
                if (form.cardType.value === JPMCOrbitalConstants.Unknown || !form.cardType.value) {
                    var cardCCType = creditCardType(form.cardNumber.value);
                    cardType = cardCCType;
                }
                newPaymentInstrument.setCreditCardType(cardType);
            }
        } else if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
            newPaymentInstrument.setCreditCardType(JPMCOrbitalConstants.EC);
            newPaymentInstrument.setBankRoutingNumber(form.ecpCheckRT.value);
            newPaymentInstrument.setBankAccountNumber(form.ecpCheckDDA.value);
            newPaymentInstrument.custom.jpmco_ecp_ecpCheckDDA = form.ecpCheckDDA.value;
            newPaymentInstrument.custom.jpmco_ecp_ecpCheckRT = form.ecpCheckRT.value;
        }
        newPaymentInstrument.setCreditCardHolder(name);
        newPaymentInstrument.setCreditCardToken(token);
        if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD || preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.orbitalProfile) {
            newPaymentInstrument.custom.jpmcOIsProfile = true;
            newPaymentInstrument.custom.jpmcOIsSafetech = false;
            newPaymentInstrument.custom.jpmcOAccountID = preferenceHelper.getMerchantId();
        } else {
            newPaymentInstrument.custom.jpmcOIsSafetech = true;
            newPaymentInstrument.custom.jpmcOIsProfile = false;
            newPaymentInstrument.custom.jpmcOAccountID = preferenceHelper.getPageEncryptionConfigurations().pieSubscriberID;
        }
    });
}
/**
 * activeProfilePayments
 * @param {*} customerNo customerNo
 * @returns {*} activeProfile
 */
function activeProfilePayments(customerNo) {
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var customer = CustomerMgr.getCustomerByCustomerNumber(customerNo);
    var savedPymentInstruments = customer.profile.wallet.paymentInstruments;
    var activeProfile = [];
    var savedPymentInstrumentsKeys = Object.keys(savedPymentInstruments);
    savedPymentInstrumentsKeys.forEach(function (index) {
        var savedPymentInstrument = savedPymentInstruments[index];
        var token = savedPymentInstrument.creditCardToken;
        if (!empty(token)) {
            var name = '';
            if (savedPymentInstrument.creditCardType === JPMCOrbitalConstants.EC) {
                name = Resource.msg('ecp.payment', 'payment', null) + ' ' + savedPymentInstrument.maskedBankAccountNumber;
            } else if (savedPymentInstrument.creditCardType === JPMCOrbitalConstants.GOOGLE) {
                name = Resource.msg('google.pay.payment', 'payment', null) + ' ' + savedPymentInstrument.maskedCreditCardNumber + ' ' + Resource.msg('card.expiration', 'payment', null) + ' ' + savedPymentInstrument.creditCardExpirationMonth + '/' + savedPymentInstrument.creditCardExpirationYear;
            } else if (savedPymentInstrument.creditCardType === JPMCOrbitalConstants.VISA_CHECKOUT) {
                name = Resource.msg('visa.pay.payment', 'payment', null) + ' ' + savedPymentInstrument.maskedCreditCardNumber + ' ' + Resource.msg('card.expiration', 'payment', null) + ' ' + savedPymentInstrument.creditCardExpirationMonth + '/' + savedPymentInstrument.creditCardExpirationYear;
            } else if (savedPymentInstrument.creditCardType === JPMCOrbitalConstants.APPLE) {
                name = Resource.msg('apple.pay.payment', 'payment', null) + ' ' + savedPymentInstrument.maskedCreditCardNumber + ' ' + Resource.msg('card.expiration', 'payment', null) + ' ' + savedPymentInstrument.creditCardExpirationMonth + '/' + savedPymentInstrument.creditCardExpirationYear;
            } else {
                name = Resource.msg('card.payment', 'payment', null) + ' ' + savedPymentInstrument.maskedCreditCardNumber + ' ' + Resource.msg('card.expiration', 'payment', null) + ' ' + savedPymentInstrument.creditCardExpirationMonth + '/' + savedPymentInstrument.creditCardExpirationYear;
            }
            var UUID = savedPymentInstrument.UUID;
            var skip = false;
            if (savedPymentInstrument.creditCardType === JPMCOrbitalConstants.EC && preferenceHelper.getPaymentPlatformMode() === JPMCOrbitalConstants.tandem) {
                skip = true;
            }
            if (savedPymentInstrument.creditCardType === JPMCOrbitalConstants.GOOGLE && !preferenceHelper.isGooglePayEnabled()) {
                skip = true;
            }
            if (savedPymentInstrument.creditCardType === JPMCOrbitalConstants.VISA_CHECKOUT && !preferenceHelper.isVisaPayEnabled()) {
                skip = true;
            }
            if (savedPymentInstrument.creditCardType === JPMCOrbitalConstants.APPLE && !preferenceHelper.isApplePayEnabled()) {
                skip = true;
            }
            if (!skip) {
                if (savedPymentInstrument.creditCardType === JPMCOrbitalConstants.EC || (preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.orbitalProfile && savedPymentInstrument.custom.jpmcOIsProfile)) {
                    if (savedPymentInstrument.custom.jpmcOAccountID === preferenceHelper.getMerchantId()) {
                        if (UUID !== JPMCOrbitalConstants.undefined) {
                            activeProfile.push({
                                name: name,
                                value: UUID
                            });
                        }
                    }
                } else if (preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken && savedPymentInstrument.custom.jpmcOIsSafetech) {
                    if (savedPymentInstrument.custom.jpmcOAccountID === preferenceHelper.getPageEncryptionConfigurations().pieSubscriberID) {
                        if (UUID !== JPMCOrbitalConstants.undefined) {
                            activeProfile.push({
                                name: name,
                                value: UUID
                            });
                        }
                    }
                }
            }
        }
    });
    return activeProfile;
}

/**
 *
 * @param {Object} order order Object.
 * @param {string} googlePayToken token get from Google.
 * @param {string} securityCode securityCode.
 * @param {string} paymentMethod paymentMethod.
 * @returns {Object}  Returns paymentObject Object.
 */
function preparePaymentObjectForGooglePay(order, googlePayToken, securityCode, paymentMethod) {
    var jpmcOPaymentModeGooglePay = preferenceHelper.getPaymentModeGooglePay();
    var paymentObject = {};
    if (jpmcOPaymentModeGooglePay === JPMCOrbitalConstants.Authorization) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForGooglePayAuthorizationOnly(order, googlePayToken, securityCode, paymentMethod));
    } else if (jpmcOPaymentModeGooglePay === JPMCOrbitalConstants.AuthorizationAndCapture) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForGooglePayAuthorizationAndCapture(order, googlePayToken, securityCode, paymentMethod));
    }
    return paymentObject;
}

/**
 *
* @param {Object} jpmcOPaymentObject paymentObjects object.
* @returns {Object} response from payment service.
* @desc payment service call for Google Pay
 */
function makePaymentCallForGooglePay(jpmcOPaymentObject) {
    if	(jpmcOPaymentObject) {
        var service = new JPMCOPaymentServices();
        var response = service.payments(jpmcOPaymentObject);
        return response.responseBody;
    }

    return null;
}

/**
 *
 * @param {Object} order order Object.
 * @param {Object} visaPay token get from Visa Checkout.
 * @param {string} securityCode securityCode.
 * @param {string} paymentMethod paymentMethod.
 * @returns {Object}  Returns paymentObject Object.
 */
function preparePaymentObjectForVisaPay(order, visaPay, securityCode, paymentMethod) {
    var jpmcOPaymentModeVisaPay = preferenceHelper.getPaymentModeVisaPay();
    var paymentObject = {};
    if (jpmcOPaymentModeVisaPay === JPMCOrbitalConstants.Authorization) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForVisaPayAuthorizationOnly(order, visaPay, securityCode, paymentMethod));
    } else if (jpmcOPaymentModeVisaPay === JPMCOrbitalConstants.AuthorizationAndCapture) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForVisaPayAuthorizationAndCapture(order, visaPay, securityCode, paymentMethod));
    }
    return paymentObject;
}

/**
 *
* @param {Object} jpmcOPaymentObject paymentObjects object.
* @returns {Object} response from payment service.
* @desc payment service call
 */
function makePaymentCallForVisaPay(jpmcOPaymentObject) {
    if	(jpmcOPaymentObject) {
        var service = new JPMCOPaymentServices();
        var response = service.payments(jpmcOPaymentObject);
        return response.responseBody;
    }

    return null;
}

/**
 *
* @param {Object} jpmcOPaymentObject paymentObjects object.
* @returns {Object} response from payment service.
* @desc debundle payment information
 */
function debundlePaymentInfoForVisaPay(jpmcOPaymentObject) {
    if	(jpmcOPaymentObject) {
        var service = new JPMCOPaymentServices();
        var response = service.debundle(jpmcOPaymentObject);
        return response.responseBody;
    }

    return null;
}

/**
 *
* @param {Object} visaPay paymentObjects object.
* @returns {Object} response from payment service.
* @desc prepare debundle payment object for Visa Checkout
 */
function prepareDebundlePaymentObjectForVisaPay(visaPay) {
    var paymentObject = {};
    var encryptedPaymentBundle = JSON.parse(visaPay);
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());

    paymentObject.bin = MerchantModel.bin;

    paymentObject.latitudeLongitude = JPMCOrbitalConstants.latitudeLongitude;

    paymentObject.walletType = JPMCOrbitalConstants.visaWallet;

    paymentObject.encryptedPaymentBundle = {
        CallID: encryptedPaymentBundle.callid
    };

    return paymentObject;
}

/**
 *
* @param {Object} jpmcOPaymentObject paymentObjects object.
* @returns {Object} response from payment service.
* @desc debundle payment information
 */
function debundlePaymentInfoForGooglePay(jpmcOPaymentObject) {
    if	(jpmcOPaymentObject) {
        var service = new JPMCOPaymentServices();
        var response = service.debundle(jpmcOPaymentObject);
        return response.responseBody;
    }

    return null;
}

/**
 *
* @param {Object} googlePayToken paymentObjects object.
* @returns {Object} response from payment service.
* @desc prepare debundle payment object for Google Pay
 */
function prepareDebundlePaymentObjectForGooglePay(googlePayToken) {
    var paymentObject = {};
    var encryptedPaymentBundle = JSON.parse(googlePayToken);
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());

    paymentObject.bin = MerchantModel.bin;

    paymentObject.latitudeLongitude = JPMCOrbitalConstants.latitudeLongitude;

    paymentObject.walletType = JPMCOrbitalConstants.googleWallet;

    paymentObject.encryptedPaymentBundle = {
        signature: encryptedPaymentBundle.signature,
        protocolVersion: encryptedPaymentBundle.protocolVersion,
        signedMessage: encryptedPaymentBundle.signedMessage
    };

    paymentObject.publicKey = '';

    return paymentObject;
}


/**
 *
 * @param {Object} order order Object.
 * @param {string} applePayToken token get from Apple.
 * @param {string} securityCode securityCode.
 * @returns {Object}  Returns paymentObject Object.
 */
function preparePaymentObjectForApplePay(order, applePayToken, securityCode) {
    var jpmcOPaymentModeApplePay = preferenceHelper.getPaymentModeApplePay();
    var paymentObject = {};
    if (jpmcOPaymentModeApplePay === JPMCOrbitalConstants.Authorization) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForApplePayAuthorizationOnly(order, applePayToken, securityCode));
    } else if (jpmcOPaymentModeApplePay === JPMCOrbitalConstants.AuthorizationAndCapture) {
        paymentObject = new PaymentModel(PaymentModel.getPaymentObjectForApplePayAuthorizationAndCapture(order, applePayToken, securityCode));
    }
    return paymentObject;
}

/**
 *
* @param {Object} jpmcOPaymentObject paymentObjects object.
* @returns {Object} response from payment service.
* @desc payment service call for Apple Pay
 */
function makePaymentCallForApplePay(jpmcOPaymentObject) {
    if	(jpmcOPaymentObject) {
        var service = new JPMCOPaymentServices();
        var response = service.payments(jpmcOPaymentObject);
        return response.responseBody;
    }

    return null;
}


/**
 *
* @param {Object} jpmcOPaymentObject paymentObjects object.
* @returns {Object} response from payment service.
* @desc debundle payment information
 */
function debundlePaymentInfoForApplePay(jpmcOPaymentObject) {
    if	(jpmcOPaymentObject) {
        var service = new JPMCOPaymentServices();
        var response = service.debundle(jpmcOPaymentObject);
        return response.responseBody;
    }

    return null;
}

/**
 *
* @param {Object} applePayToken paymentObjects object.
* @returns {Object} response from payment service.
* @desc prepare debundle payment object for Apple Pay
 */
function prepareDebundlePaymentObjectForApplePay(applePayToken) {
    var paymentObject = {};
    var encryptedPaymentBundle = JSON.parse(applePayToken);
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());

    paymentObject.bin = MerchantModel.bin;

    paymentObject.latitudeLongitude = JPMCOrbitalConstants.latitudeLongitude;

    paymentObject.walletType = JPMCOrbitalConstants.appleWallet;

    paymentObject.encryptedPaymentBundle = {
        data: encryptedPaymentBundle.data,
        header: {
            ephemeralPublicKey: encryptedPaymentBundle.header.ephemeralPublicKey,
            publicKeyHash: encryptedPaymentBundle.header.publicKeyHash,
            transactionId: encryptedPaymentBundle.header.transactionId
        },
        signature: encryptedPaymentBundle.signature,
        version: encryptedPaymentBundle.version
    };

    return paymentObject;
}

module.exports = {
    prepareBillingFormJPMC: prepareBillingFormJPMC,
    preparePaymentObjectForCard: preparePaymentObjectForCard,
    makePaymentCallForCard: makePaymentCallForCard,
    preparePaymentObjectForProfile: preparePaymentObjectForProfile,
    makePaymentCallForProfile: makePaymentCallForProfile,
    preparePaymentObjectForCardZeroAuth: preparePaymentObjectForCardZeroAuth,
    saveCustomerPayment: saveCustomerPayment,
    activeProfilePayments: activeProfilePayments,
    getRetryTrace: getRetryTrace,
    preparePaymentObjectForElectronicCheck: preparePaymentObjectForElectronicCheck,
    makePaymentCallForElectronicCheck: makePaymentCallForElectronicCheck,
    makeRecurringPaymentCall: makeRecurringPaymentCall,
    preparePaymentObjectForGooglePay: preparePaymentObjectForGooglePay,
    makePaymentCallForGooglePay: makePaymentCallForGooglePay,
    preparePaymentObjectForVisaPay: preparePaymentObjectForVisaPay,
    makePaymentCallForVisaPay: makePaymentCallForVisaPay,
    debundlePaymentInfoForGooglePay: debundlePaymentInfoForGooglePay,
    prepareDebundlePaymentObjectForGooglePay: prepareDebundlePaymentObjectForGooglePay,
    debundlePaymentInfoForVisaPay: debundlePaymentInfoForVisaPay,
    prepareDebundlePaymentObjectForVisaPay: prepareDebundlePaymentObjectForVisaPay,
    preparePaymentObjectForApplePay: preparePaymentObjectForApplePay,
    makePaymentCallForApplePay: makePaymentCallForApplePay,
    debundlePaymentInfoForApplePay: debundlePaymentInfoForApplePay,
    prepareDebundlePaymentObjectForApplePay: prepareDebundlePaymentObjectForApplePay,
    creditCardType: creditCardType,
    creditCardTypeFullName: creditCardTypeFullName
};
