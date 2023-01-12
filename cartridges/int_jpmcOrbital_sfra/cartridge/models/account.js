/* eslint-disable no-param-reassign */
'use strict';

var AddressModel = require('*/cartridge/models/address');
var URLUtils = require('dw/web/URLUtils');
var Customer = require('dw/customer/Customer');

var jpmcOrbitalEnabled = require('*/cartridge/scripts/helpers/preferenceHelper').isOrbitalAPIEnabled();
var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 * Creates a plain object that contains profile information
 * @param {Object} profile - current customer's profile
 * @returns {Object} an object that contains information about the current customer's profile
 */
function getProfile(profile) {
    var result;
    if (profile) {
        result = {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            phone: Object.prototype.hasOwnProperty.call(profile, 'phone') ? profile.phone : profile.phoneHome,
            password: '********'
        };
    } else {
        result = null;
    }
    return result;
}

/**
 * Creates an array of plain object that contains address book addresses, if any exist
 * @param {Object} addressBook - target customer
 * @returns {Array<Object>} an array of customer addresses
 */
function getAddresses(addressBook) {
    var result = [];
    if (addressBook) {
        for (var i = 0, ii = addressBook.addresses.length; i < ii; i++) {
            result.push(new AddressModel(addressBook.addresses[i]).address);
        }
    }

    return result;
}

/**
 * Creates a plain object that contains the customer's preferred address
 * @param {Object} addressBook - target customer
 * @returns {Object} an object that contains information about current customer's preferred address
 */
function getPreferredAddress(addressBook) {
    var result = null;
    if (addressBook && addressBook.preferredAddress) {
        result = new AddressModel(addressBook.preferredAddress).address;
    }

    return result;
}

/**
 * Creates a plain object that contains payment instrument information
 * @param {Object} wallet - current customer's wallet
 * @param {*} fromCheckout fromCheckout
 * @returns {Object} object that contains info about the current customer's payment instrument
 */
function getPayment(wallet, fromCheckout) {
    var isGooglePayEnabled = preferenceHelper.isGooglePayEnabled();
    var isVisaPayEnabled = preferenceHelper.isVisaPayEnabled();
    if (wallet && !fromCheckout) {
        var paymentInstruments = wallet.paymentInstruments;
        if (jpmcOrbitalEnabled && paymentInstruments.length > 0) {
            for (var i = 0; i < paymentInstruments.length; i++) {
                var pInstrument = paymentInstruments[i];
                if (pInstrument) {
                    var skip = false;
                    if (pInstrument.creditCardType === JPMCOrbitalConstants.EC && preferenceHelper.getPaymentPlatformMode() === JPMCOrbitalConstants.tandem) {
                        skip = true;
                    }
                    if (!isGooglePayEnabled && (pInstrument.creditCardType && (pInstrument.creditCardType === JPMCOrbitalConstants.GOOGLE || (pInstrument.creditCardType.split('_').length > 1 && pInstrument.creditCardType.split('_')[1] === JPMCOrbitalConstants.GOOGLE)))) {
                        skip = true;
                    }
                    if (!isVisaPayEnabled && (pInstrument.creditCardType && (pInstrument.creditCardType === JPMCOrbitalConstants.VISA_CHECKOUT || (pInstrument.creditCardType.split('_').length > 1 && pInstrument.creditCardType.split('_')[1] === JPMCOrbitalConstants.VISA_CHECKOUT)))) {
                        skip = true;
                    }
                    if (pInstrument.paymentMethod.slice(0, 4) !== JPMCOrbitalConstants.JPMC) {
                        skip = true;
                    }
                    if (!skip) {
                        if (pInstrument.creditCardType === JPMCOrbitalConstants.EC || (preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.orbitalProfile && pInstrument.custom.jpmcOIsProfile)) {
                            if (pInstrument.custom.jpmcOAccountID === preferenceHelper.getMerchantId()) {
                                if (pInstrument.creditCardType === JPMCOrbitalConstants.EC) {
                                    return {
                                        creditCardHolder: pInstrument.creditCardHolder,
                                        maskedBankAccountNumber: pInstrument.maskedBankAccountNumber,
                                        creditCardType: pInstrument.creditCardType
                                    };
                                } else if (pInstrument.creditCardType !== JPMCOrbitalConstants.EC) {
                                    return {
                                        maskedCreditCardNumber: pInstrument.maskedCreditCardNumber,
                                        creditCardType: pInstrument.creditCardType,
                                        creditCardExpirationMonth: pInstrument.creditCardExpirationMonth,
                                        creditCardExpirationYear: pInstrument.creditCardExpirationYear
                                    };
                                }
                            }
                        } else if (preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken && pInstrument.custom.jpmcOIsSafetech) {
                            if (pInstrument.custom.jpmcOAccountID === preferenceHelper.getPageEncryptionConfigurations().pieSubscriberID) {
                                if (pInstrument.creditCardType === JPMCOrbitalConstants.EC) {
                                    return {
                                        creditCardHolder: pInstrument.creditCardHolder,
                                        maskedBankAccountNumber: pInstrument.maskedBankAccountNumber,
                                        creditCardType: pInstrument.creditCardType
                                    };
                                } else if (pInstrument.creditCardType !== JPMCOrbitalConstants.EC) {
                                    return {
                                        maskedCreditCardNumber: pInstrument.maskedCreditCardNumber,
                                        creditCardType: pInstrument.creditCardType,
                                        creditCardExpirationMonth: pInstrument.creditCardExpirationMonth,
                                        creditCardExpirationYear: pInstrument.creditCardExpirationYear
                                    };
                                }
                            }
                        }
                    }
                }
            }
        } else if (paymentInstruments && paymentInstruments.length > 0) {
            var paymentResponse = null;
            var j = 0;
            while (empty(paymentResponse) && j < paymentInstruments.length) {
                var paymentInstrument = paymentInstruments[j];
                if (paymentInstrument.paymentMethod.slice(0, 4) !== JPMCOrbitalConstants.JPMC) {
                    paymentResponse = {
                        maskedCreditCardNumber: paymentInstrument.maskedCreditCardNumber,
                        creditCardType: paymentInstrument.creditCardType,
                        creditCardExpirationMonth: paymentInstrument.creditCardExpirationMonth,
                        creditCardExpirationYear: paymentInstrument.creditCardExpirationYear
                    };
                }
                j++;
            }

            return paymentResponse;
        }
    }
    return null;
}

/**
 * Creates a plain object that contains payment instrument information
 * @param {Object} userPaymentInstruments - current customer's paymentInstruments
 * @returns {Object} object that contains info about the current customer's payment instruments
 */
function getCustomerPaymentInstruments(userPaymentInstruments) {
    var paymentInstruments;
    paymentInstruments = userPaymentInstruments.map(function (paymentInstrument) {
        var result;
        if (paymentInstrument.creditCardType !== JPMCOrbitalConstants.EC) {
            result = {
                creditCardHolder: paymentInstrument.creditCardHolder,
                maskedCreditCardNumber: paymentInstrument.maskedCreditCardNumber,
                creditCardType: paymentInstrument.creditCardType,
                creditCardExpirationMonth: paymentInstrument.creditCardExpirationMonth,
                creditCardExpirationYear: paymentInstrument.creditCardExpirationYear,
                UUID: paymentInstrument.UUID
            };
        } else {
            result = {
                creditCardHolder: paymentInstrument.creditCardHolder,
                maskedBankAccountNumber: paymentInstrument.maskedBankAccountNumber,
                creditCardType: paymentInstrument.creditCardType,
                UUID: paymentInstrument.UUID
            };
        }
        if (paymentInstrument.creditCardType) {
            result.cardTypeImage = {
                src: URLUtils.staticURL('/images/' +
                    paymentInstrument.creditCardType.toLowerCase().replace(/\s/g, '') +
                    '-dark.svg'),
                alt: paymentInstrument.creditCardType
            };
        }
        return result;
    });
    return paymentInstruments;
}
/**
 * Account class that represents the current customer's profile dashboard
 * @param {Object} currentCustomer - Current customer
 * @param {Object} addressModel - The current customer's preferred address
 * @param {Object} orderModel - The current customer's order history
 * @constructor
 */
function account(currentCustomer, addressModel, orderModel) {
    this.profile = getProfile(currentCustomer.profile);
    this.addresses = getAddresses(currentCustomer.addressBook);
    this.preferredAddress = addressModel || getPreferredAddress(currentCustomer.addressBook);
    this.orderHistory = orderModel;
    var fromCheckout = false;
    if (currentCustomer.profile && currentCustomer.profile.wallet) {
        fromCheckout = true;
    } else {
        fromCheckout = false;
    }
    if (currentCustomer.profile) {
        var CustomerMgr = require('dw/customer/CustomerMgr');
        currentCustomer = CustomerMgr.getCustomerByCustomerNumber(currentCustomer.profile.customerNo);
    }
    this.payment = getPayment(currentCustomer instanceof Customer ? currentCustomer.profile.wallet : currentCustomer.wallet, fromCheckout);
    this.registeredUser = currentCustomer instanceof Customer ? (currentCustomer.authenticated && currentCustomer.registered) : (currentCustomer.raw.authenticated && currentCustomer.raw.registered);
    this.isExternallyAuthenticated = currentCustomer instanceof Customer ? currentCustomer.externallyAuthenticated : currentCustomer.raw.externallyAuthenticated;
    if (currentCustomer instanceof Customer) {
        this.customerPaymentInstruments = currentCustomer.profile.wallet
        && currentCustomer.profile.wallet.paymentInstruments
        ? getCustomerPaymentInstruments(currentCustomer.profile.wallet.paymentInstruments.toArray())
        : null;
    } else {
        this.customerPaymentInstruments = currentCustomer.wallet
        && currentCustomer.wallet.paymentInstruments
        ? getCustomerPaymentInstruments(currentCustomer.wallet.paymentInstruments)
        : null;
    }
}

account.getCustomerPaymentInstruments = getCustomerPaymentInstruments;

module.exports = account;
