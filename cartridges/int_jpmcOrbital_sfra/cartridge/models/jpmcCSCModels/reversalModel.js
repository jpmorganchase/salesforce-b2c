'use strict';

var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
var JpmcCardPresentModel = require('*/cartridge/models/jpmcModels/jpmcCardPresentModel');

/**
 * @module ReversalModel
 */
/**
 * Model for Reversal
 * @typedef {reversalModel} reversalModel
 * @property {String} version
 * @property {Object} merchant
 * @property {Object} order
 */

/**
 * @description constructor for reversalModel
 * @constructor reversalModel
 * @param {Object} reversalObject - Plain object that matches the model properties
 */
function ReversalModel(reversalObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = reversalObject.merchant;
    this.order = reversalObject.order;
    this.cardPresent = reversalObject.cardPresent;
}

ReversalModel.getReversalObject = function (response, onlineReversalInd, transactionID) {
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject(response.merchant.bin));
    var reversalObject = {};

    reversalObject.merchant = {
        bin: response.merchant.bin,
        terminalID: response.merchant.terminalID
    };

    reversalObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    reversalObject.order = {
        orderID: response.order.orderID,
        txRefNum: transactionID,
        onlineReversalInd: onlineReversalInd,
        retryTrace: orbitalAPIHelper.getRetryTrace(response.order.orderID, JPMCOrbitalConstants.getReversalObject),
        industryType: JPMCOrbitalConstants.EC
    };
    return new ReversalModel(reversalObject);
};


module.exports = ReversalModel;
