'use strict';

var JPMCOrbitalConstants = require('../jpmcOConstantsHelperMocks.test');

/**
 *
 * @param {profileObject} profileObject profileObject
 */
function ProfileResponseModel(profileObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = profileObject.merchant;
    this.order = profileObject.order;
    this.paymentInstrument = profileObject.paymentInstrument;
    this.profile = profileObject.profile;
}

ProfileResponseModel.setProfileResponseObject = function (responseObject) {
    if (responseObject) {
        var profileResponseObject = {};
        profileResponseObject.merchant = {
            bin: responseObject.merchant.bin
        };
        profileResponseObject.order = {
            orderDefaultAmount: responseObject.order.orderDefaultAmount,
            status: responseObject.order.status
        };
        profileResponseObject.paymentInstrument = {
            card: responseObject.paymentInstrument.card,
            ecp: responseObject.paymentInstrument.ecp,
            customerAccountType: responseObject.paymentInstrument.customerAccountType
        };
        profileResponseObject.profile = responseObject.profile;
        return new ProfileResponseModel(profileResponseObject);
    }
    return null;
};
module.exports = ProfileResponseModel;
