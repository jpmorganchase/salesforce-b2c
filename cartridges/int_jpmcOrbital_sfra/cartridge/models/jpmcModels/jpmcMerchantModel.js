'use strict';

var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 *
 * @param {merchantObject} merchantObject merchantObject
 */
function MerchantModel(merchantObject) {
    this.merchantID = merchantObject.merchantID;
    this.bin = merchantObject.bin;
    this.terminalID = merchantObject.terminalID;
}

MerchantModel.getMerchantObject = function () {
    var merchantObject = {};
    merchantObject.merchantID = preferenceHelper.getMerchantId();
    merchantObject.bin = preferenceHelper.getPaymentPlatformMode();
    merchantObject.terminalID = JPMCOrbitalConstants.terminalID;

    return merchantObject;
};

module.exports = MerchantModel;
