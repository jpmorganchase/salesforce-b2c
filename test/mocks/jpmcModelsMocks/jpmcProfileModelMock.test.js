'use strict';

var preferenceHelper = require('../../mocks/preferenceHelperMocks.test');
var JPMCOrbitalConstants = require('../jpmcOConstantsHelperMocks.test');

/**
 *
 * @param {profileObject} profileObject profileObject
 */
function ProfileModel(profileObject) {
    if (profileObject.customerRefNum) {
        this.customerRefNum = profileObject.customerRefNum;
        this.addProfileFromOrder = JPMCOrbitalConstants.S;
        this.profileOrderOverideInd = JPMCOrbitalConstants.NO;
    }
    if (profileObject.addProfileFromOrder) {
        this.addProfileFromOrder = profileObject.addProfileFromOrder;
    }
    if (profileObject.profileOrderOverideInd) {
        this.profileOrderOverideInd = profileObject.profileOrderOverideInd;
    }
    if (profileObject.useCustomerRefNum) {
        this.useCustomerRefNum = profileObject.useCustomerRefNum;
    }
    this.customerName = profileObject.customerName;
    this.customerAddress1 = profileObject.customerAddress1;
    this.customerCity = profileObject.customerCity;
    this.customerState = profileObject.customerState;
    this.customerZIP = profileObject.customerZIP;
    this.customerEmail = profileObject.customerEmail;
    this.customerPhone = profileObject.customerPhone;
    this.customerCountryCode = profileObject.customerCountryCode;
    if (profileObject.accountUpdaterEligibility) {
        this.accountUpdaterEligibility = profileObject.accountUpdaterEligibility;
    }
}

ProfileModel.getProfileObjectFromOrder = function (order) {
    var profileObject = {};
    profileObject.customerName = order.customerName;
    profileObject.customerAddress1 = order.billingAddress.address1;
    profileObject.customerCity = order.billingAddress.city;
    profileObject.customerState = order.billingAddress.stateCode;
    profileObject.customerZIP = order.billingAddress.postalCode;
    profileObject.customerEmail = order.customerEmail;
    profileObject.customerPhone = order.billingAddress.phone;
    profileObject.customerCountryCode = order.billingAddress.countryCode.value;
    if (!preferenceHelper.isPageEncryptionEnabled() && preferenceHelper.isUpdateProfileEnabled()) {
        profileObject.accountUpdaterEligibility = JPMCOrbitalConstants.Y;
    } else {
        profileObject.accountUpdaterEligibility = JPMCOrbitalConstants.N;
    }
    return new ProfileModel(profileObject);
};
ProfileModel.getProfileObjectFromAccount = function (customer) {
    var profileObject = {};
    if (customer.addressBook.addresses.length > 0) {
        profileObject.customerName = customer.addressBook.addresses[0].fullName;
        profileObject.customerAddress1 = customer.addressBook.addresses[0].address1;
        profileObject.customerCity = customer.addressBook.addresses[0].city;
        profileObject.customerState = customer.addressBook.addresses[0].stateCode;
        profileObject.customerZIP = customer.addressBook.addresses[0].postalCode;
        profileObject.customerCountryCode = customer.addressBook.addresses[0].countryCode.value;
    } else {
        profileObject.customerName = customer.firstName + ' ' + customer.lastName;
    }
    if (!preferenceHelper.isPageEncryptionEnabled() && preferenceHelper.isUpdateProfileEnabled()) {
        profileObject.accountUpdaterEligibility = JPMCOrbitalConstants.Y;
    } else {
        profileObject.accountUpdaterEligibility = JPMCOrbitalConstants.N;
    }
    profileObject.customerEmail = customer.email;
    profileObject.customerPhone = customer.phoneHome;
    return new ProfileModel(profileObject);
};
ProfileModel.getInstrumentProfileObject = function (useCustomerRefNum) {
    var profileObject = {};
    if (useCustomerRefNum) {
        profileObject.useCustomerRefNum = useCustomerRefNum;
    }
    return profileObject;
};


module.exports = ProfileModel;
