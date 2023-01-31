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
    this.avsState = avsObject.avsState;
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
    avsObject.avsState = order.billingAddress.stateCode;
    avsObject.avsCountryCode = order.billingAddress.countryCode.value;
    avsObject.avsZip = order.billingAddress.postalCode;
    avsObject.avsName = order.billingAddress.fullName;
    avsObject.avsPhone = order.billingAddress.phone;

    return avsObject;
};

module.exports = AVSModel;
