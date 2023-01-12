'use strict';

var CardModel = require('*/cartridge/models/jpmcModels/jpmcCardModel');
var ProfileModel = require('*/cartridge/models/jpmcModels/jpmcProfileModel');
var ElectronicCheckModel = require('*/cartridge/models/jpmcModels/jpmcElectronicCheckModel');

/**
 *
 * @param {paymentInstrumentObject} paymentInstrumentObject paymentInstrumentObject
 */
function PaymentInstrumentModel(paymentInstrumentObject) {
    if (paymentInstrumentObject.card) {
        this.card = paymentInstrumentObject.card;
    }
    if (paymentInstrumentObject.useProfile) {
        this.useProfile = paymentInstrumentObject.useProfile;
    }
    if (paymentInstrumentObject.electronicCheck) {
        this.electronicCheck = paymentInstrumentObject.electronicCheck;
    }
}

PaymentInstrumentModel.getPaymentInstrumentObjectForCredit = function (card) {
    var paymentInstrumentObject = {};
    if (card) {
        var cardObject = new CardModel(CardModel.getCardObjectForCredit(card));
        paymentInstrumentObject.card = cardObject;
        paymentInstrumentObject.card.ccExp = Number(paymentInstrumentObject.card.ccExp);
    }

    return paymentInstrumentObject;
};

PaymentInstrumentModel.getPaymentInstrumentObjectForProfile = function (customerRefNum) {
    var paymentInstrumentObject = {};
    if (customerRefNum) {
        var profileObject = new ProfileModel(ProfileModel.getInstrumentProfileObject(customerRefNum));
        paymentInstrumentObject.useProfile = profileObject;
    }

    return paymentInstrumentObject;
};


PaymentInstrumentModel.getPaymentInstrumentObjectForElectronicCheck = function (eCheck) {
    var paymentInstrumentObject = {};
    if (eCheck) {
        var eCheckObject = ElectronicCheckModel.getElectronicCheckObject(eCheck);
        var electronicCheckObject = new ElectronicCheckModel(eCheckObject);
        paymentInstrumentObject.electronicCheck = electronicCheckObject;
    }

    return paymentInstrumentObject;
};

module.exports = PaymentInstrumentModel;
