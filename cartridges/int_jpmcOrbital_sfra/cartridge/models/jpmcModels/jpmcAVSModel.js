'use strict';
/**
 * @desc AVSModel
 * @constructor AVSModel
 * @param {*} avsObject avsObject
 */
function AVSModel(avsObject) {
    this.avsAddress1 = avsObject.avsAddress1;
    if (avsObject.avsAddress2) {
        this.avsAddress2 = avsObject.avsAddress2;
    }
    this.avsCity = avsObject.avsCity;
    if (avsObject.avsState) {
        this.avsState = avsObject.avsState;
    }
    this.avsCountryCode = avsObject.avsCountryCode;
    this.avsZip = avsObject.avsZip;
    this.avsName = avsObject.avsName;
    this.avsPhone = avsObject.avsPhone;
}
// Model gets order object and returns AVS object
AVSModel.getAVSObjectForPayment = function (order) {
    var avsObject = {};

    avsObject.avsAddress1 = order.billingAddress.address1;
    if (order.billingAddress.address2) {
        avsObject.avsAddress2 = order.billingAddress.address2;
    }
    avsObject.avsCity = order.billingAddress.city;
    if (order.billingAddress.stateCode) {
        if (order.billingAddress.stateCode.length > 2) {
            avsObject.avsState = (order.billingAddress.stateCode).slice(0, 2);
        } else {
            avsObject.avsState = order.billingAddress.stateCode;
        }
    }
    avsObject.avsCountryCode = order.billingAddress.countryCode.value;
    avsObject.avsZip = order.billingAddress.postalCode;
    avsObject.avsName = order.billingAddress.fullName;
    avsObject.avsPhone = order.billingAddress.phone;

    return avsObject;
};

// Model gets order object and returns AVS object
AVSModel.getAVSObjectForElectronicCheck = function (order) {
    var avsObject = {};

    avsObject.avsAddress1 = order.billingAddress.address1;
    if (order.billingAddress.address2) {
        avsObject.avsAddress2 = order.billingAddress.address2;
    }
    avsObject.avsCity = order.billingAddress.city;
    if (order.billingAddress.stateCode) {
        if (order.billingAddress.stateCode.length > 2) {
            avsObject.avsState = (order.billingAddress.stateCode).slice(0, 2);
        } else {
            avsObject.avsState = order.billingAddress.stateCode;
        }
    }
    avsObject.avsCountryCode = order.billingAddress.countryCode.value;
    avsObject.avsZip = order.billingAddress.postalCode;
    avsObject.avsName = order.billingAddress.fullName;
    avsObject.avsPhone = order.billingAddress.phone;

    avsObject.avsName = order.billingAddress.fullName;

    return avsObject;
};

module.exports = AVSModel;
