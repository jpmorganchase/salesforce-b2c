'use strict';

var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var JpmcMerchantModel = require('*/cartridge/models/jpmcModels/jpmcMerchantModel');
var CardModel = require('*/cartridge/models/jpmcModels/jpmcCardModel');
var OrderMgr = require('dw/order/OrderMgr');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 *
 * @param {tokenObject} tokenObject tokenObject
 */
function TokenModel(tokenObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = tokenObject.merchant;
    this.order = tokenObject.order;
    this.paymentInstrument = tokenObject.paymentInstrument;
    this.token = tokenObject.token;
}

TokenModel.getTokenObject = function (paymentObject, type, form) {
    var OrbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var currencyCodeMapping = preferenceHelper.getCurrencyCodeMapping();
    var tokenObject = paymentObject;
    var debundlePaymentObject;
    var debundlePaymentInfo;
    var data;
    if (type === JPMCOrbitalConstants.GOOGLE) {
        debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForGooglePay(form);
        debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForGooglePay(debundlePaymentObject);
        data = {
            ccExp: debundlePaymentInfo.TokenData.expirationYear.toString() + ((JPMCOrbitalConstants.n_0 + debundlePaymentInfo.TokenData.expirationMonth).slice(-2).toString()),
            ccAccountNum: debundlePaymentInfo.TokenData.pan,
            cardBrand: OrbitalAPIHelper.creditCardType(debundlePaymentInfo.TokenData.pan)
        };
        tokenObject.paymentInstrument = {
            card: data,
            customerAccountType: JPMCOrbitalConstants.CC
        };
    } else if (type === JPMCOrbitalConstants.VISA_CHECKOUT) {
        debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForVisaPay(form);
        debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForVisaPay(debundlePaymentObject);
        data = {
            ccExp: debundlePaymentInfo.TokenData.expirationYear.toString() + ((JPMCOrbitalConstants.n_0 + debundlePaymentInfo.TokenData.expirationMonth).slice(-2).toString()),
            ccAccountNum: debundlePaymentInfo.TokenData.accountNumber,
            cardBrand: OrbitalAPIHelper.creditCardType(debundlePaymentInfo.TokenData.accountNumber)
        };
        tokenObject.paymentInstrument = {
            card: data,
            customerAccountType: JPMCOrbitalConstants.CC
        };
    } else if (type === JPMCOrbitalConstants.APPLE) {
        debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForApplePay(form);
        debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForApplePay(debundlePaymentObject);
        data = {
            ccExp: JPMCOrbitalConstants.n_20 + debundlePaymentInfo.TokenData.applicationExpirationDate.slice(0, 4),
            ccAccountNum: debundlePaymentInfo.TokenData.applicationPrimaryAccountNumber,
            cardBrand: OrbitalAPIHelper.creditCardType(debundlePaymentInfo.TokenData.applicationPrimaryAccountNumber)
        };
        tokenObject.paymentInstrument = {
            card: data,
            customerAccountType: JPMCOrbitalConstants.CC
        };
    }

    tokenObject.order.currencyCode = currencyCodeMapping[session.currency.currencyCode];
    tokenObject.order.industryType = JPMCOrbitalConstants.EC;
    tokenObject.token = {
        actionCode: JPMCOrbitalConstants.TK
    };
    return new TokenModel(tokenObject);
};

TokenModel.getTokenObjectFromAccount = function (form, type) {
    var currencyCodeMapping = preferenceHelper.getCurrencyCodeMapping();

    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());

    var tokenObject = {};
    tokenObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };
    tokenObject.order = {
        orderID: OrderMgr.createOrderNo(),
        currencyCode: currencyCodeMapping[session.currency.currencyCode],
        industryType: JPMCOrbitalConstants.EC
    };
    tokenObject.paymentInstrument = {
        card: new CardModel(CardModel.getCardObjectForCredit(form)),
        customerAccountType: type
    };
    tokenObject.token = {
        actionCode: JPMCOrbitalConstants.TK
    };
    return new TokenModel(tokenObject);
};

TokenModel.getTokenObjectFromAccountGooglePay = function (form) {
    var OrbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var currencyCodeMapping = preferenceHelper.getCurrencyCodeMapping();
    var tokenObject = {};

    var debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForGooglePay(form);
    var debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForGooglePay(debundlePaymentObject);
    var data = {
        ccExp: debundlePaymentInfo.TokenData.expirationYear.toString() + ((JPMCOrbitalConstants.n_0 + debundlePaymentInfo.TokenData.expirationMonth).slice(-2).toString()),
        ccAccountNum: debundlePaymentInfo.TokenData.pan,
        cardBrand: OrbitalAPIHelper.creditCardType(debundlePaymentInfo.TokenData.pan)
    };
    tokenObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };
    tokenObject.order = {
        orderID: OrderMgr.createOrderNo(),
        currencyCode: currencyCodeMapping[session.currency.currencyCode],
        industryType: JPMCOrbitalConstants.EC
    };
    tokenObject.paymentInstrument = {
        card: data,
        customerAccountType: JPMCOrbitalConstants.CC
    };
    tokenObject.token = {
        actionCode: JPMCOrbitalConstants.TK
    };
    return new TokenModel(tokenObject);
};

TokenModel.getTokenObjectFromAccountVisaPay = function (form) {
    var OrbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var currencyCodeMapping = preferenceHelper.getCurrencyCodeMapping();
    var tokenObject = {};

    var debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForVisaPay(form);
    var debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForVisaPay(debundlePaymentObject);
    var data = {
        ccExp: debundlePaymentInfo.TokenData.expirationYear.toString() + ((JPMCOrbitalConstants.n_0 + debundlePaymentInfo.TokenData.expirationMonth).slice(-2).toString()),
        ccAccountNum: debundlePaymentInfo.TokenData.accountNumber,
        cardBrand: OrbitalAPIHelper.creditCardType(debundlePaymentInfo.TokenData.accountNumber)
    };
    tokenObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };
    tokenObject.order = {
        orderID: OrderMgr.createOrderNo(),
        currencyCode: currencyCodeMapping[session.currency.currencyCode],
        industryType: JPMCOrbitalConstants.EC
    };
    tokenObject.paymentInstrument = {
        card: data,
        customerAccountType: JPMCOrbitalConstants.CC
    };
    tokenObject.token = {
        actionCode: JPMCOrbitalConstants.TK
    };
    return new TokenModel(tokenObject);
};

TokenModel.getTokenObjectFromAccountApplePay = function (form) {
    var OrbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var currencyCodeMapping = preferenceHelper.getCurrencyCodeMapping();
    var tokenObject = {};

    var debundlePaymentObject = OrbitalAPIHelper.prepareDebundlePaymentObjectForApplePay(form);
    var debundlePaymentInfo = OrbitalAPIHelper.debundlePaymentInfoForApplePay(debundlePaymentObject);
    var data = {
        ccExp: debundlePaymentInfo.TokenData.applicationExpirationDate.slice(0, 4),
        ccAccountNum: debundlePaymentInfo.TokenData.applicationPrimaryAccountNumber,
        cardBrand: OrbitalAPIHelper.creditCardType(debundlePaymentInfo.TokenData.applicationPrimaryAccountNumber)
    };
    tokenObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };
    tokenObject.order = {
        orderID: OrderMgr.createOrderNo(),
        currencyCode: currencyCodeMapping[session.currency.currencyCode],
        industryType: JPMCOrbitalConstants.EC
    };
    tokenObject.paymentInstrument = {
        card: data,
        customerAccountType: JPMCOrbitalConstants.CC
    };
    tokenObject.token = {
        actionCode: JPMCOrbitalConstants.TK
    };
    return new TokenModel(tokenObject);
};

module.exports = TokenModel;
