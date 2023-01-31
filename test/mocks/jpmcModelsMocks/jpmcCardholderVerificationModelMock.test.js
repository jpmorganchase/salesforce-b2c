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
    var cardholderVerificationObject = {};
    if (card) {
        cardholderVerificationObject.cardholderVerification = card.securityCode.value;
    }
    return cardholderVerificationObject;
};

module.exports = CardholderVerificationModel;
