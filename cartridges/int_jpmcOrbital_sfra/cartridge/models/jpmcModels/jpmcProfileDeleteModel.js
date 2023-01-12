'use strict';

var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 *
 * @param {profileObject} profileObject profileObject
 */
function ProfileDeleteModel(profileObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = profileObject.merchant;
    this.profile = profileObject.profile;
}

ProfileDeleteModel.getProfileDeleteObject = function (customerRefNum) {
    var JpmcMerchantModel = require('*/cartridge/models/jpmcModels/jpmcMerchantModel');
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var profileObject = {};
    profileObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };
    profileObject.profile = {
        customerRefNum: customerRefNum
    };
    return new ProfileDeleteModel(profileObject);
};
module.exports = ProfileDeleteModel;
