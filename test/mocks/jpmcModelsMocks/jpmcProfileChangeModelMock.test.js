'use strict';

var JPMCOrbitalConstants = require('../jpmcOConstantsHelperMocks.test');
var JpmcCardPresentModel = require('../jpmcModelsMocks/jpmcCardPresentModelMock.test');

/**
 *
 * @param {profileObject} profileObject profileObject
 */
function ProfileChangeModel(profileObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = profileObject.merchant;
    this.paymentInstrument = profileObject.paymentInstrument;
    this.profile = profileObject.profile;
    this.cardPresent = profileObject.cardPresent;
}

ProfileChangeModel.getProfileChangeObject = function (ccAccountNum, ccNum, profile, token, type, ecp) {
    var JpmcMerchantModel = require('./jpmcMerchantModelMock.test');
    var MerchantModel = new JpmcMerchantModel(JpmcMerchantModel.getMerchantObject());
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject());

    var profileObject = {};
    profileObject.merchant = {
        bin: MerchantModel.bin,
        terminalID: MerchantModel.terminalID
    };
    if (profile.addressBook.addresses.length > 0) {
        profileObject.profile = {
            customerRefNum: token,
            customerName: profile.addressBook.addresses[0].fullName,
            customerAddress1: profile.addressBook.addresses[0].address1,
            accountUpdaterEligibility: JPMCOrbitalConstants.Y,
            status: JPMCOrbitalConstants.Authorization
        };
    } else {
        profileObject.profile = {
            customerRefNum: token,
            customerName: profile.firstName + ' ' + profile.lastName,
            accountUpdaterEligibility: JPMCOrbitalConstants.Y,
            status: JPMCOrbitalConstants.Authorization
        };
    }
    if (type === JPMCOrbitalConstants.CC || type === JPMCOrbitalConstants.GOOGLE || type === JPMCOrbitalConstants.VISA_CHECKOUT || type === JPMCOrbitalConstants.APPLE) {
        profileObject.paymentInstrument = {
            customerAccountType: JPMCOrbitalConstants.CC,
            card: {
                ccAccountNum: ccAccountNum,
                ccExp: ccNum
            }
        };
    } else {
        profileObject.paymentInstrument = {
            customerAccountType: JPMCOrbitalConstants.EC,
            card: {
                cardBrand: JPMCOrbitalConstants.EC
            },
            ecp: ecp
        };
    }
    profileObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };
    return new ProfileChangeModel(profileObject);
};
module.exports = ProfileChangeModel;
