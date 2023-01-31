'use strict';

var JPMCOrbitalConstants = require('../jpmcOConstantsHelperMocks.test');

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
    var JpmcMerchantModel = require('./jpmcMerchantModelMock.test');
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
