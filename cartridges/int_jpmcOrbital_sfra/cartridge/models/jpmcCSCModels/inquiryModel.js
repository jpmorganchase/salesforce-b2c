'use strict';

var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 *  Property of OSF Global Services, Inc., d/b/a OSF Digital. OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
/**
 * @module InquiryModel
 */
/**
 * Model for Reversal
 * @typedef {InquiryModel} InquiryModel
 * @property {String} version
 * @property {Object} merchant
 * @property {Object} order
 */

/**
 * @description constructor for InquiryModel
 * @constructor InquiryModel
 * @param {Object} inquiryObject - Plain object that matches the model properties
 */
function InquiryModel(inquiryObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = inquiryObject.merchant;
    this.order = inquiryObject.order;
}

InquiryModel.getInquiryObject = function (response, retryTrace) {
    var inquiryObject = {};

    inquiryObject.merchant = {
        bin: response.merchant.bin,
        terminalID: response.merchant.terminalID
    };

    inquiryObject.order = {
        orderID: response.order.orderID,
        inquiryRetryNumber: retryTrace
    };

    return new InquiryModel(inquiryObject);
};


module.exports = InquiryModel;
