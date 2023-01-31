'use strict';

var JPMCOrbitalConstants = require('../jpmcOConstantsHelperMocks.test');

/**
 * @module InquiryResponseModel
 */
/**
 * Model for Reversal
 * @typedef {InquiryResponseModel} InquiryResponseModel
 * @property {String} version
 * @property {Object} merchant
 * @property {Object} order
 * @property {String} transType
 * @property {Object} paymentInstrument
 * @property {Object} avsBilling
 * @property {Object} cardholderVerification
 * @property {Object} profile
 */

/**
 * @description constructor for InquiryResponseModel
 * @constructor InquiryResponseModel
 * @param {Object} inquiryResponseObject - Plain object that matches the model properties
 */
function InquiryResponseModel(inquiryResponseObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = inquiryResponseObject.merchant;
    this.order = inquiryResponseObject.order;
    this.transType = inquiryResponseObject.transType;
    this.paymentInstrument = inquiryResponseObject.paymentInstrument;
    this.avsBilling = inquiryResponseObject.avsBilling;
    this.cardholderVerification = inquiryResponseObject.cardholderVerification;
    this.profile = inquiryResponseObject.profile;
}

InquiryResponseModel.setInquiryResponseObject = function (responseObject) {
    if (responseObject) {
        var inquiryResponseObject = {};

        inquiryResponseObject.merchant = {
            bin: responseObject.merchant.bin,
            merchantID: responseObject.merchant.merchantID,
            terminalID: responseObject.merchant.terminalID
        };

        inquiryResponseObject.transType = responseObject.transType;

        inquiryResponseObject.order = {
            orderID: responseObject.order.orderID,
            txRefNum: responseObject.order.txRefNum,
            txRefIdx: responseObject.order.txRefIdx,
            respDateTime: responseObject.order.respDateTime,
            status: responseObject.order.status
        };

        inquiryResponseObject.paymentInstrument = {
            card: responseObject.paymentInstrument.card
        };

        inquiryResponseObject.avsBilling = responseObject.avsBilling;
        inquiryResponseObject.cardholderVerification = responseObject.cardholderVerification;
        inquiryResponseObject.profile = responseObject.profile;

        return new InquiryResponseModel(inquiryResponseObject);
    }
    return null;
};

module.exports = InquiryResponseModel;
