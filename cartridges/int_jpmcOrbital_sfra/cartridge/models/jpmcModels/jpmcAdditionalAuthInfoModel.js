'use strict';

var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 * @desc Additional Auth Info Model
 * @param {*} additionalAuthInfoObject additionalAuthInfoObject
 */
function AdditionalAuthInfoModel(additionalAuthInfoObject) {
    if (additionalAuthInfoObject.cardIndicators) {
        this.cardIndicators = additionalAuthInfoObject.cardIndicators;
    }
}
// Model returns Additional Auth Info Model with Card Type Indicator
AdditionalAuthInfoModel.getCardTypeIndicatorObject = function () {
    var additionalAuthInfoObject = {};

    additionalAuthInfoObject.cardIndicators = JPMCOrbitalConstants.Y;

    return additionalAuthInfoObject;
};

module.exports = AdditionalAuthInfoModel;
