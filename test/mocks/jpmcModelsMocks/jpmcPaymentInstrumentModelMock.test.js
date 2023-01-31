'use strict';

var CardModel = require('../jpmcModelsMocks/jpmcCardModelMock.test');
var ProfileModel = require('../jpmcModelsMocks/jpmcProfileModelMock.test');
var ElectronicCheckModel = require('../jpmcModelsMocks/jpmcElectronicCheckModelMock.test');

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
    }

    return paymentInstrumentObject;
};

PaymentInstrumentModel.getPaymentInstrumentObjectForDebit = function (card) {
    var paymentInstrumentObject = {};
    if (card) {
        var cardObject = new CardModel(CardModel.getCardObjectForDebit(card));
        paymentInstrumentObject.card = cardObject;
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
