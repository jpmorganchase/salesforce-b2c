'use strict';

/**
 * @description Cardholder Verification Model
 * @param {Object} cardholderVerificationObject cardholderVerificationObject
 */
function CardholderVerificationModel(cardholderVerificationObject) {
    this.ccCardVerifyNum = cardholderVerificationObject.cardholderVerification;
}
// gets the card object parameter.
CardholderVerificationModel.getCardholderVerificationObject = function (card) {
    var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
    var cardholderVerificationObject = {};
    if (card.securityCode) {
        cardholderVerificationObject.cardholderVerification = card.securityCode.value;
    }
    if (preferenceHelper.isPageEncryptionEnabled()) {
        var encryptedData = session.forms.billing.encryptedData.value ? JSON.parse(session.forms.billing.encryptedData.value) : null;
        if (encryptedData) {
            cardholderVerificationObject.cardholderVerification = encryptedData[1];
        } else if (card.securityCode) {
            cardholderVerificationObject.cardholderVerification = card.securityCode.value;
        }
    }
    return cardholderVerificationObject;
};

module.exports = CardholderVerificationModel;
