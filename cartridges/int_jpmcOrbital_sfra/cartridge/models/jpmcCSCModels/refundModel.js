'use strict';

var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
var JpmcCardPresentModel = require('*/cartridge/models/jpmcModels/jpmcCardPresentModel');

/**
 * @module RefundModel
 */
/**
 * Model for Reversal
 * @typedef {RefundModel} RefundModel
 * @property {String} version
 * @property {Object} merchant
 * @property {Object} order
 */

/**
 * @description constructor for RefundModel
 * @constructor RefundModel
 * @param {Object} refundObject - Plain object that matches the model properties
 */
function RefundModel(refundObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = refundObject.merchant;
    this.order = refundObject.order;
    this.cardPresent = refundObject.cardPresent;
}

RefundModel.getRefundObject = function (response, amount, transactionID) {
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject(response.merchant.bin));
    var refundObject = {};

    refundObject.merchant = {
        bin: response.merchant.bin,
        terminalID: response.merchant.terminalID
    };

    refundObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    if (amount) {
        refundObject.order = {
            orderID: response.order.orderID,
            amount: amount,
            industryType: response.order.industryType,
            comments: response.order.comments,
            txRefNum: transactionID,
            retryTrace: orbitalAPIHelper.getRetryTrace(response.order.orderID, JPMCOrbitalConstants.getRefundObject)
        };
    } else {
        refundObject.order = {
            orderID: response.order.orderID,
            industryType: response.order.industryType,
            comments: response.order.comments,
            txRefNum: transactionID,
            retryTrace: orbitalAPIHelper.getRetryTrace(response.order.orderID, JPMCOrbitalConstants.getRefundObject)
        };
    }

    return new RefundModel(refundObject);
};


module.exports = RefundModel;
