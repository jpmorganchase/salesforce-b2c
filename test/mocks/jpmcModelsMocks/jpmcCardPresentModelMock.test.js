'use strict';

var JpmcMerchantModel = require('../../mocks/jpmcModelsMocks/jpmcMerchantModelMock.test');
var JPMCOrbitalConstants = require('../jpmcOConstantsHelperMocks.test');

/**
 * @description Card Present Model
 * @param {Object} cardPresentObject cardPresentObject
 */
function CardPresentModel(cardPresentObject) {
    this.vendorID = cardPresentObject.vendorID;
    this.softwareID = cardPresentObject.softwareID;
}

// gets the cardPresent object parameter.
CardPresentModel.getCardPresentObject = function (bin) {
    var cardPresentObject = {};
    var MerchantModel = !bin ? new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject()) : null;
    var MerchantBin = bin || MerchantModel.bin;
    if (MerchantBin === JPMCOrbitalConstants.stratus) {
        cardPresentObject.vendorID = JPMCOrbitalConstants.stratus_vendorID;
        cardPresentObject.softwareID = JPMCOrbitalConstants.stratus_softwareID;
    } else {
        cardPresentObject.vendorID = JPMCOrbitalConstants.tandem_vendorID;
        cardPresentObject.softwareID = JPMCOrbitalConstants.tandem_softwareID;
    }

    return cardPresentObject;
};

module.exports = CardPresentModel;
