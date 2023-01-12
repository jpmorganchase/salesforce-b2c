'use strict';

var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 *
 *
 * @param {*} cardObject cardObject
 */
function CardModel(cardObject) {
    this.ccAccountNum = cardObject.ccAccountNum;
    this.ccExp = cardObject.ccExp;
    if (cardObject.cardBrand) {
        this.cardBrand = cardObject.cardBrand;
    }
}
// Model gets card object as cardData
CardModel.getCardObjectForCredit = function (card) {
    var cardObject = {};
    var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
    var params = request.httpParameterMap;
    var paymentOption = params.paymentOption.value;

    if (preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken && preferenceHelper.isPageEncryptionEnabled() && paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
        var encryptedCardData = JSON.parse(session.forms.billing.encryptedData.value);

        cardObject.ccAccountNum = (encryptedCardData[0]).replace(/ /g, '');
    } else {
        cardObject.ccAccountNum = (card.cardNumber.value).replace(/ /g, '');
    }
    cardObject.cardBrand = card.cardType.value;
    cardObject.ccExp = card.expirationYear.value.toString() + ((JPMCOrbitalConstants.n_0 + card.expirationMonth.value).slice(-2).toString());

    return cardObject;
};

module.exports = CardModel;
