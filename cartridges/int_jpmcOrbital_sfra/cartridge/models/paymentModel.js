'use strict';

var JpmcMerchantModel = require('*/cartridge/models/jpmcModels/jpmcMerchantModel');
var JpmcOrderModel = require('*/cartridge/models/jpmcModels/jpmcOrderModel');
var JpmcPaymentInstrumentModel = require('*/cartridge/models/jpmcModels/jpmcPaymentInstrumentModel');
var JpmcCardholderVerificationModel = require('*/cartridge/models/jpmcModels/jpmcCardholderVerificationModel');
var JpmcAVSModel = require('*/cartridge/models/jpmcModels/jpmcAVSModel');
var JpmcPageEncryptionModel = require('*/cartridge/models/jpmcModels/jpmcPageEncryptionModel');
var JpmcAdditionalAuthInfoModel = require('*/cartridge/models/jpmcModels/jpmcAdditionalAuthInfoModel');
var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
var profileAddModel = require('*/cartridge/models/jpmcModels/jpmcProfileAddModel');
var JPMCOProfileServices = require('*/cartridge/scripts/services/jpmcOServices.js');
var tokenModel = require('*/cartridge/models/jpmcModels/jpmcTokenModel');
var JPMCOTokenServices = require('*/cartridge/scripts/services/jpmcOServices.js');
var JpmcCardPresentModel = require('*/cartridge/models/jpmcModels/jpmcCardPresentModel');

/**
 * @desc Creates a Payment model nested object with required fields for making a request.
 * @param {paymentObject} paymentObject paymentObject
 */
function PaymentModel(paymentObject) {
    this.merchant = paymentObject.merchant;
    this.order = paymentObject.order;
    if (paymentObject.paymentInstrument) {
        this.paymentInstrument = paymentObject.paymentInstrument;
    }
    if (paymentObject.avsBilling) {
        this.avsBilling = paymentObject.avsBilling;
    }
    if (paymentObject.cardholderVerification) {
        this.cardholderVerification = paymentObject.cardholderVerification;
    }
    if (paymentObject.profile) {
        this.profile = paymentObject.profile;
    }
    if (paymentObject.card) {
        this.card = paymentObject.card;
    }
    if (paymentObject.pageEncryption) {
        this.pageEncryption = paymentObject.pageEncryption;
    }
    if (paymentObject.merchantInitiatedTransaction) {
        this.merchantInitiatedTransaction = paymentObject.merchantInitiatedTransaction;
    }
    if (paymentObject.additionalAuthInfo) {
        this.additionalAuthInfo = paymentObject.additionalAuthInfo;
    }
    if (paymentObject.electronicCheck) {
        this.electronicCheck = paymentObject.electronicCheck;
    }
    if (paymentObject.cardPresent) {
        this.cardPresent = paymentObject.cardPresent;
    }

    this.transType = paymentObject.transType;
    this.version = JPMCOrbitalConstants.version;
}

/**
 * setCustomerSavedPayment
 * @param {*} order order
 * @param {*} paymentObject paymentObject
 * @param {*} paymentInstrument paymentInstrument
 * @param {*} type type
 * @param {*} skipPaymentModelForEncryption skipPaymentModelForEncryption
 * @param {*} paymentMethod paymentMethod
 */
function setCustomerSavedPayment(order, paymentObject, paymentInstrument, type, skipPaymentModelForEncryption, paymentMethod) {
    var pObject = paymentObject;
    if (type === JPMCOrbitalConstants.EC || preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.orbitalProfile) {
        var profileAddObject = profileAddModel.getProfileAddObject(order, pObject, paymentInstrument, type);
        var profileServices = new JPMCOProfileServices();
        var profileAddResponse = profileServices.addProfile(profileAddObject);
        if (profileAddResponse.status === JPMCOrbitalConstants.OK) {
            pObject.paymentInstrument = {
                useProfile: {
                    useCustomerRefNum: profileAddResponse.responseBody.profile.customerRefNum
                }
            };
        }
    } else if (type === JPMCOrbitalConstants.CC || type === JPMCOrbitalConstants.GOOGLE || type === JPMCOrbitalConstants.VISA_CHECKOUT || type === JPMCOrbitalConstants.APPLE) {
        var tokenObject;
        var tokenServices;
        var tokenResponse;
        if (paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD &&
            paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY &&
            paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD &&
            paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD &&
            !session.privacy.profile_visa) {
            tokenObject = tokenModel.getTokenObject(pObject, type, paymentInstrument);
            tokenServices = new JPMCOTokenServices();
            tokenResponse = tokenServices.getToken(tokenObject);
        }
        if (paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD &&
            paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY &&
            paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD &&
            paymentMethod !== JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD &&
            !session.privacy.profile_visa) {
            if (tokenResponse.status === JPMCOrbitalConstants.OK && !skipPaymentModelForEncryption) {
                if (type === JPMCOrbitalConstants.CC) {
                    pObject.paymentInstrument = {
                        card: paymentInstrument.card
                    };
                }
                pObject.paymentInstrument.card.ccAccountNum = tokenResponse.responseBody.paymentInstrument.card.ccAccountNum;
                pObject.paymentInstrument.card.tokenTxnType = JPMCOrbitalConstants.UT;
            }
        } else if (!skipPaymentModelForEncryption) {
            if (type === JPMCOrbitalConstants.CC) {
                pObject.paymentInstrument = {
                    card: paymentInstrument.card
                };
            }
        }
        if (paymentObject.paymentInstrument.card.cardBrand !== JPMCOrbitalConstants.AX) {
            pObject.additionalAuthInfo = {
                cardIndicators: JPMCOrbitalConstants.Y
            };
        }
    }
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    pObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };
}

PaymentModel.getPaymentObjectForCardAuthorizationOnly = function (order, card, paymentMethod) {
    var paymentObject = {};
    var PaymentInstrumentModel = new JpmcPaymentInstrumentModel(JpmcPaymentInstrumentModel.getPaymentInstrumentObjectForCredit(card));
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForCredit(order));
    var CardholderVerificationModel = new JpmcCardholderVerificationModel(JpmcCardholderVerificationModel.getCardholderVerificationObject(card));
    var AdditionalAuthInfoModel = new JpmcAdditionalAuthInfoModel(JpmcAdditionalAuthInfoModel.getCardTypeIndicatorObject());
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));

        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsCountryCode: AVSModel.avsCountryCode,
            avsState: AVSModel.avsState,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }

    var skipPaymentModelForEncryption = false;

    if (preferenceHelper.isPageEncryptionEnabled() && preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken) {
        var encryptedData = session.forms.billing.encryptedData.value;
        if (encryptedData) {
            paymentObject.pageEncryption = new JpmcPageEncryptionModel(encryptedData);
            skipPaymentModelForEncryption = true;
        }
    }

    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };
    paymentObject.paymentInstrument = {
        card: PaymentInstrumentModel.card
    };

    paymentObject.additionalAuthInfo = {};

    if (MerchantModel.bin === JPMCOrbitalConstants.stratus && paymentObject.paymentInstrument.card.cardBrand !== JPMCOrbitalConstants.AX) {
        paymentObject.additionalAuthInfo.cardIndicators = AdditionalAuthInfoModel.cardIndicators;
    }
    if (PaymentInstrumentModel.card.cardBrand === JPMCOrbitalConstants.MC || PaymentInstrumentModel.card.cardBrand === JPMCOrbitalConstants.IM) {
        paymentObject.additionalAuthInfo.paymentActionInd = JPMCOrbitalConstants.P;
    }
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForCardAuthorizationOnly),
        industryType: OrderModel.industryType
    };

    if (card.cardType.value === JPMCOrbitalConstants.GOOGLE || order.getPaymentInstruments()[0].creditCardType === JPMCOrbitalConstants.VISA_CHECKOUT || order.getPaymentInstruments()[0].creditCardType === JPMCOrbitalConstants.APPLE) {
        PaymentInstrumentModel.card.cardBrand = card.cardBrand.value;
        PaymentInstrumentModel.card.tokenTxnType = JPMCOrbitalConstants.UT;
        PaymentInstrumentModel.customerAccountType = JPMCOrbitalConstants.CC;
    }

    setCustomerSavedPayment(order, paymentObject, PaymentInstrumentModel, JPMCOrbitalConstants.CC, skipPaymentModelForEncryption, paymentMethod);
    paymentObject.cardholderVerification = {
        ccCardVerifyNum: CardholderVerificationModel.ccCardVerifyNum
    };
    if (MerchantModel.bin === JPMCOrbitalConstants.stratus && (PaymentInstrumentModel.card.cardBrand === JPMCOrbitalConstants.VI || PaymentInstrumentModel.card.cardBrand === JPMCOrbitalConstants.DI)) {
        paymentObject.cardholderVerification.ccCardVerifyPresenceInd = JPMCOrbitalConstants.ccCardVerifyPresenceInd;
    }
    paymentObject.transType = JPMCOrbitalConstants.Authorization;
    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    if (preferenceHelper.isIncrementalAuthorizationEnabled() && card.cardType.value !== JPMCOrbitalConstants.DI && card.cardType.value !== JPMCOrbitalConstants.JC) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CEST
        };
    } else if (session.privacy.saveCustomerPaymentCheckbox) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CSTO
        };
    } else {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CGEN
        };
    }

    return paymentObject;
};

PaymentModel.getPaymentObjectForCardAuthorizationAndCapture = function (order, card, paymentMethod) {
    var paymentObject = {};
    var PaymentInstrumentModel = new JpmcPaymentInstrumentModel(JpmcPaymentInstrumentModel.getPaymentInstrumentObjectForCredit(card));
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForCredit(order));
    var CardholderVerificationModel = new JpmcCardholderVerificationModel(JpmcCardholderVerificationModel.getCardholderVerificationObject(card));
    var AdditionalAuthInfoModel = new JpmcAdditionalAuthInfoModel(JpmcAdditionalAuthInfoModel.getCardTypeIndicatorObject());
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }

    var skipPaymentModelForEncryption = false;

    if (preferenceHelper.isPageEncryptionEnabled() && preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken) {
        var encryptedData = session.forms.billing.encryptedData.value;
        if (encryptedData) {
            paymentObject.pageEncryption = new JpmcPageEncryptionModel(encryptedData);
            skipPaymentModelForEncryption = true;
        }
    }
    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        card: PaymentInstrumentModel.card
    };

    paymentObject.additionalAuthInfo = {};

    if (MerchantModel.bin === JPMCOrbitalConstants.stratus && paymentObject.paymentInstrument.card.cardBrand !== JPMCOrbitalConstants.AX) {
        paymentObject.additionalAuthInfo.cardIndicators = AdditionalAuthInfoModel.cardIndicators;
    }
    if (PaymentInstrumentModel.card.cardBrand === JPMCOrbitalConstants.MC || PaymentInstrumentModel.card.cardBrand === JPMCOrbitalConstants.IM) {
        paymentObject.additionalAuthInfo.paymentActionInd = JPMCOrbitalConstants.P;
    }
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForCardAuthorizationAndCapture),
        industryType: OrderModel.industryType
    };

    if (order.getPaymentInstruments()[0].creditCardType === JPMCOrbitalConstants.GOOGLE || order.getPaymentInstruments()[0].creditCardType === JPMCOrbitalConstants.VISA_CHECKOUT || order.getPaymentInstruments()[0].creditCardType === JPMCOrbitalConstants.APPLE) {
        PaymentInstrumentModel.card.cardBrand = order.getPaymentInstruments()[0].custom.jpmco_cardBrand;
        PaymentInstrumentModel.card.tokenTxnType = JPMCOrbitalConstants.UT;
        PaymentInstrumentModel.customerAccountType = JPMCOrbitalConstants.CC;
    }

    setCustomerSavedPayment(order, paymentObject, PaymentInstrumentModel, JPMCOrbitalConstants.CC, skipPaymentModelForEncryption, paymentMethod);

    paymentObject.cardholderVerification = {
        ccCardVerifyNum: CardholderVerificationModel.ccCardVerifyNum
    };
    if (MerchantModel.bin === JPMCOrbitalConstants.stratus && (PaymentInstrumentModel.card.cardBrand === JPMCOrbitalConstants.VI || PaymentInstrumentModel.card.cardBrand === JPMCOrbitalConstants.DI)) {
        paymentObject.cardholderVerification.ccCardVerifyPresenceInd = JPMCOrbitalConstants.ccCardVerifyPresenceInd;
    }

    if (session.privacy.saveCustomerPaymentCheckbox) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CSTO
        };
    } else {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CGEN
        };
    }

    paymentObject.transType = JPMCOrbitalConstants.AuthorizationAndCapture;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

PaymentModel.getPaymentObjectForProfileAuthorizationOnly = function (order, customerRefNum, customerPaymentType, securityCode) {
    var paymentObject = {};
    var PaymentInstrumentModel = new JpmcPaymentInstrumentModel(JpmcPaymentInstrumentModel.getPaymentInstrumentObjectForProfile(customerRefNum));
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForProfile(order));
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }

    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        useProfile: PaymentInstrumentModel.useProfile
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForProfileAuthorizationOnly),
        industryType: OrderModel.industryType
    };
    paymentObject.transType = JPMCOrbitalConstants.Authorization;

    if ((customerPaymentType !== JPMCOrbitalConstants.EC)) {
        if (preferenceHelper.isIncrementalAuthorizationEnabled() && customerPaymentType !== JPMCOrbitalConstants.DI && customerPaymentType !== JPMCOrbitalConstants.JC) {
            paymentObject.merchantInitiatedTransaction = {
                mitMsgType: JPMCOrbitalConstants.CEST
            };
        } else {
            paymentObject.merchantInitiatedTransaction = {
                mitStoredCredentialInd: JPMCOrbitalConstants.Y,
                mitMsgType: JPMCOrbitalConstants.CUSE
            };
        }
    }
    if (securityCode) {
        paymentObject.cardholderVerification = {
            ccCardVerifyNum: securityCode
        };
    }
    paymentObject.additionalAuthInfo = {};

    if (MerchantModel.bin === JPMCOrbitalConstants.stratus) {
        paymentObject.additionalAuthInfo.cardIndicators = JPMCOrbitalConstants.Y;
    }
    if (customerPaymentType === JPMCOrbitalConstants.International_Maestro || customerPaymentType === JPMCOrbitalConstants.Master_Card) {
        paymentObject.additionalAuthInfo.paymentActionInd = JPMCOrbitalConstants.P;
    }

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

PaymentModel.getPaymentObjectForProfileAuthorizationAndCapture = function (order, customerRefNum, customerPaymentType, securityCode) {
    var paymentObject = {};
    var PaymentInstrumentModel = new JpmcPaymentInstrumentModel(JpmcPaymentInstrumentModel.getPaymentInstrumentObjectForProfile(customerRefNum));
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForProfile(order));
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }

    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        useProfile: PaymentInstrumentModel.useProfile
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForProfileAuthorizationAndCapture),
        industryType: OrderModel.industryType
    };
    paymentObject.transType = JPMCOrbitalConstants.AuthorizationAndCapture;

    if ((customerPaymentType !== JPMCOrbitalConstants.EC)) {
        if (preferenceHelper.isIncrementalAuthorizationEnabled() && customerPaymentType !== JPMCOrbitalConstants.DI && customerPaymentType !== JPMCOrbitalConstants.JC) {
            paymentObject.merchantInitiatedTransaction = {
                mitMsgType: JPMCOrbitalConstants.CEST
            };
        } else {
            paymentObject.merchantInitiatedTransaction = {
                mitStoredCredentialInd: JPMCOrbitalConstants.Y,
                mitMsgType: JPMCOrbitalConstants.CUSE
            };
        }
    }
    if (securityCode) {
        paymentObject.cardholderVerification = {
            ccCardVerifyNum: securityCode
        };
    }
    paymentObject.additionalAuthInfo = {};

    if (MerchantModel.bin === JPMCOrbitalConstants.stratus) {
        paymentObject.additionalAuthInfo.cardIndicators = JPMCOrbitalConstants.Y;
    }
    if (customerPaymentType === JPMCOrbitalConstants.International_Maestro || customerPaymentType === JPMCOrbitalConstants.Master_Card) {
        paymentObject.additionalAuthInfo.paymentActionInd = JPMCOrbitalConstants.P;
    }

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

PaymentModel.getPaymentObjectForElectronicCheckAuthorizationOnly = function (order, eCheck) {
    var paymentObject = {};
    var PaymentInstrumentModel = new JpmcPaymentInstrumentModel(JpmcPaymentInstrumentModel.getPaymentInstrumentObjectForElectronicCheck(eCheck));
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForElectronicCheck(order));

    var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForElectronicCheck(order));
    paymentObject.avsBilling = {
        avsName: AVSModel.avsName
    };
    if (preferenceHelper.isAVSEnabled()) {
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }
    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForElectronicCheckAuthorizationOnly),
        industryType: OrderModel.industryType
    };
    paymentObject.paymentInstrument = {
        card: {
            cardBrand: JPMCOrbitalConstants.EC
        },
        ecp: PaymentInstrumentModel.electronicCheck
    };
    if (order.customer.registered && order.customer.authenticated) {
        setCustomerSavedPayment(order, paymentObject, PaymentInstrumentModel, JPMCOrbitalConstants.EC);
    }

    paymentObject.transType = JPMCOrbitalConstants.Authorization;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

PaymentModel.getPaymentObjectForElectronicCheckAuthorizationAndCapture = function (order, card) {
    var paymentObject = {};
    var PaymentInstrumentModel = new JpmcPaymentInstrumentModel(JpmcPaymentInstrumentModel.getPaymentInstrumentObjectForElectronicCheck(card));
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForElectronicCheck(order));
    var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForElectronicCheck(order));
    paymentObject.avsBilling = {
        avsName: AVSModel.avsName
    };

    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        card: {
            cardBrand: JPMCOrbitalConstants.EC
        },
        ecp: PaymentInstrumentModel.electronicCheck
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForElectronicCheckAuthorizationAndCapture),
        industryType: OrderModel.industryType
    };
    if (order.customer.registered && order.customer.authenticated) {
        setCustomerSavedPayment(order, paymentObject, PaymentInstrumentModel, JPMCOrbitalConstants.EC);
    }

    paymentObject.transType = JPMCOrbitalConstants.AuthorizationAndCapture;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};


// $0 used in card payment, and it needs to have A transType so this methods should be created.

PaymentModel.getPaymentObjectForCardZeroAuth = function (order, card) {
    var paymentObject = {};
    var PaymentInstrumentModel = new JpmcPaymentInstrumentModel(JpmcPaymentInstrumentModel.getPaymentInstrumentObjectForCredit(card));
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForCredit(order));
    var CardholderVerificationModel = new JpmcCardholderVerificationModel(JpmcCardholderVerificationModel.getCardholderVerificationObject(card));
    var AdditionalAuthInfoModel = new JpmcAdditionalAuthInfoModel(JpmcAdditionalAuthInfoModel.getCardTypeIndicatorObject());
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }
    if (preferenceHelper.isPageEncryptionEnabled()) {
        var encryptedData = session.forms.billing.encryptedData.value;
        paymentObject.pageEncryption = new JpmcPageEncryptionModel(encryptedData);
    }

    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        card: PaymentInstrumentModel.card
    };

    paymentObject.additionalAuthInfo = {};

    if (MerchantModel.bin === JPMCOrbitalConstants.stratus && paymentObject.paymentInstrument.card.cardBrand !== JPMCOrbitalConstants.AX) {
        paymentObject.additionalAuthInfo.cardIndicators = AdditionalAuthInfoModel.cardIndicators;
    }
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: JPMCOrbitalConstants.n_0,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForCardZeroAuth),
        industryType: OrderModel.industryType
    };

    paymentObject.cardholderVerification = {

        ccCardVerifyNum: CardholderVerificationModel.ccCardVerifyNum
    };

    if (MerchantModel.bin === JPMCOrbitalConstants.stratus && (PaymentInstrumentModel.card.cardBrand === JPMCOrbitalConstants.VI || PaymentInstrumentModel.card.cardBrand === JPMCOrbitalConstants.DI)) {
        paymentObject.cardholderVerification.ccCardVerifyPresenceInd = JPMCOrbitalConstants.ccCardVerifyPresenceInd;
    }

    if (session.privacy.saveCustomerPaymentCheckbox) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CSTO
        };
    } else {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CGEN
        };
    }

    paymentObject.transType = JPMCOrbitalConstants.Authorization;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

PaymentModel.getPaymentObjectForGooglePayAuthorizationOnly = function (order, googlePayToken, securityCode, paymentMethod) {
    var paymentObject = {};
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForProfile(order));
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }
    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        card: {
            cardBrand: ''
        }
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForGooglePayAuthorizationOnly),
        industryType: OrderModel.industryType
    };

    setCustomerSavedPayment(order, paymentObject, googlePayToken, JPMCOrbitalConstants.GOOGLE, null, paymentMethod);

    if (preferenceHelper.isIncrementalAuthorizationEnabled()) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CEST

        };
    } else if (session.privacy.saveCustomerPaymentCheckbox) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CSTO
        };
    } else {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CGEN
        };
    }

    if (securityCode) {
        paymentObject.cardholderVerification = {
            ccCardVerifyNum: securityCode
        };
    }

    paymentObject.transType = JPMCOrbitalConstants.Authorization;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

PaymentModel.getPaymentObjectForGooglePayAuthorizationAndCapture = function (order, googlePayToken, securityCode, paymentMethod) {
    var paymentObject = {};
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForProfile(order));
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }
    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        card: {
            cardBrand: ''
        }
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForGooglePayAuthorizationAndCapture),
        industryType: OrderModel.industryType
    };
    if (securityCode) {
        paymentObject.cardholderVerification = {
            ccCardVerifyNum: securityCode
        };
    }
    setCustomerSavedPayment(order, paymentObject, googlePayToken, JPMCOrbitalConstants.GOOGLE, null, paymentMethod);

    if (session.privacy.saveCustomerPaymentCheckbox) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CSTO
        };
    } else {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CGEN
        };
    }

    paymentObject.transType = JPMCOrbitalConstants.AuthorizationAndCapture;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

PaymentModel.getPaymentObjectForApplePayAuthorizationOnly = function (order, applePayToken, securityCode) {
    var paymentObject = {};
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForProfile(order));
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }
    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        card: {
            cardBrand: ''
        }
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForApplePayAuthorizationOnly),
        industryType: OrderModel.industryType
    };

    setCustomerSavedPayment(order, paymentObject, applePayToken, JPMCOrbitalConstants.APPLE);

    if (preferenceHelper.isIncrementalAuthorizationEnabled()) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CEST

        };
    } else if (session.privacy.saveCustomerPaymentCheckbox) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CSTO
        };
    } else {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CGEN
        };
    }

    if (securityCode) {
        paymentObject.cardholderVerification = {
            ccCardVerifyNum: securityCode
        };
    }

    paymentObject.transType = JPMCOrbitalConstants.Authorization;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

PaymentModel.getPaymentObjectForApplePayAuthorizationAndCapture = function (order, applePayToken, securityCode) {
    var paymentObject = {};
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForProfile(order));
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }
    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        card: {
            cardBrand: ''
        }
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForApplePayAuthorizationAndCapture),
        industryType: OrderModel.industryType
    };
    if (securityCode) {
        paymentObject.cardholderVerification = {
            ccCardVerifyNum: securityCode
        };
    }
    setCustomerSavedPayment(order, paymentObject, applePayToken, JPMCOrbitalConstants.APPLE);

    if (session.privacy.saveCustomerPaymentCheckbox) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CSTO
        };
    } else {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CGEN
        };
    }

    paymentObject.transType = JPMCOrbitalConstants.AuthorizationAndCapture;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

PaymentModel.getPaymentObjectForElectronicCheckAuthorizationAndCapture = function (order, card) {
    var paymentObject = {};
    var PaymentInstrumentModel = new JpmcPaymentInstrumentModel(JpmcPaymentInstrumentModel.getPaymentInstrumentObjectForElectronicCheck(card));
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForElectronicCheck(order));
    var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForElectronicCheck(order));

    paymentObject.avsBilling = {
        avsName: AVSModel.avsName
    };

    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        card: { cardBrand: JPMCOrbitalConstants.EC },
        ecp: PaymentInstrumentModel.electronicCheck
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForElectronicCheckAuthorizationOnly),
        industryType: OrderModel.industryType
    };

    setCustomerSavedPayment(order, paymentObject, PaymentInstrumentModel, JPMCOrbitalConstants.EC);

    paymentObject.transType = JPMCOrbitalConstants.AuthorizationAndCapture;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

/**
 * getPaymentObjectForVisaPayAuthorizationOnly
 * @param {*} order order
 * @param {*} visaPay visaPay
 * @param {*} securityCode securityCode
 * @param {*} paymentMethod paymentMethod
 * @returns {Object} payment object
 */
PaymentModel.getPaymentObjectForVisaPayAuthorizationOnly = function (order, visaPay, securityCode, paymentMethod) {
    var paymentObject = {};
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForProfile(order));
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }

    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        card: {
            cardBrand: ''
        }
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForVisaPayAuthorizationOnly),
        industryType: OrderModel.industryType
    };

    setCustomerSavedPayment(order, paymentObject, visaPay, JPMCOrbitalConstants.VISA_CHECKOUT, null, paymentMethod);

    if (preferenceHelper.isIncrementalAuthorizationEnabled()) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CEST

        };
    } else if (session.privacy.saveCustomerPaymentCheckbox) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CSTO
        };
    } else {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CGEN
        };
    }

    if (securityCode) {
        paymentObject.cardholderVerification = {
            ccCardVerifyNum: securityCode
        };
    }

    paymentObject.transType = JPMCOrbitalConstants.Authorization;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

/**
 * getPaymentObjectForVisaPayAuthorizationAndCapture
 * @param {*} order order
 * @param {*} visaPay visaPay
 * @param {*} securityCode securityCode
 * @param {*} paymentMethod paymentMethod
 *@returns {Object} payment object
 */
PaymentModel.getPaymentObjectForVisaPayAuthorizationAndCapture = function (order, visaPay, securityCode, paymentMethod) {
    var paymentObject = {};
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());
    var OrderModel = new JpmcOrderModel(JpmcOrderModel.getOrderObjectForProfile(order));
    if (preferenceHelper.isAVSEnabled()) {
        var AVSModel = new JpmcAVSModel(JpmcAVSModel.getAVSObjectForPayment(order));
        paymentObject.avsBilling = {
            avsAddress1: AVSModel.avsAddress1,
            avsCity: AVSModel.avsCity,
            avsState: AVSModel.avsState,
            avsCountryCode: AVSModel.avsCountryCode,
            avsZip: AVSModel.avsZip,
            avsName: AVSModel.avsName,
            avsPhone: AVSModel.avsPhone
        };
    }

    paymentObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };

    paymentObject.paymentInstrument = {
        card: {
            cardBrand: ''
        }
    };
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    paymentObject.order = {
        orderID: OrderModel.orderID,
        amount: OrderModel.amount,
        retryTrace: orbitalAPIHelper.getRetryTrace(OrderModel.orderID, JPMCOrbitalConstants.getPaymentObjectForVisaPayAuthorizationAndCapture),
        industryType: OrderModel.industryType
    };

    if (securityCode) {
        paymentObject.cardholderVerification = {
            ccCardVerifyNum: securityCode
        };
    }

    setCustomerSavedPayment(order, paymentObject, visaPay, JPMCOrbitalConstants.VISA_CHECKOUT, null, paymentMethod);

    if (session.privacy.saveCustomerPaymentCheckbox) {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CSTO
        };
    } else {
        paymentObject.merchantInitiatedTransaction = {
            mitMsgType: JPMCOrbitalConstants.CGEN
        };
    }

    paymentObject.transType = JPMCOrbitalConstants.AuthorizationAndCapture;

    paymentObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    return paymentObject;
};

module.exports = PaymentModel;
