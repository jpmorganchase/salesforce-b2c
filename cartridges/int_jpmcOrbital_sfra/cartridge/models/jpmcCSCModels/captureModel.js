'use strict';

var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
var JpmcCardPresentModel = require('*/cartridge/models/jpmcModels/jpmcCardPresentModel');

/**
 * @module CaptureModel
 */
/**
 * Model for Reversal
 * @typedef {CaptureModel} CaptureModel
 * @property {String} version
 * @property {Object} merchant
 * @property {Object} order
 */

/**
 * @description constructor for CaptureModel
 * @constructor CaptureModel
 * @param {Object} captureObject - Plain object that matches the model properties
 */
function CaptureModel(captureObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = captureObject.merchant;
    this.order = captureObject.order;
    this.cardPresent = captureObject.cardPresent;
}

CaptureModel.getCaptureObject = function (response, amount, transactionID) {
    var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var CardPresentModel = new JpmcCardPresentModel(JpmcCardPresentModel.getCardPresentObject(response.merchant.bin));
    var captureObject = {};

    captureObject.merchant = {
        bin: response.merchant.bin,
        terminalID: response.merchant.terminalID
    };

    captureObject.cardPresent = {
        emvInfo: {
            vendorID: CardPresentModel.vendorID,
            softwareID: CardPresentModel.softwareID
        }
    };

    if (amount) {
        captureObject.order = {
            orderID: response.order.orderID,
            amount: amount,
            txRefNum: transactionID,
            retryTrace: orbitalAPIHelper.getRetryTrace(response.order.orderID, JPMCOrbitalConstants.getCaptureObject),
            industryType: JPMCOrbitalConstants.EC
        };
    } else {
        captureObject.order = {
            orderID: response.order.orderID,
            txRefNum: transactionID,
            retryTrace: orbitalAPIHelper.getRetryTrace(response.order.orderID, JPMCOrbitalConstants.getCaptureObject),
            industryType: JPMCOrbitalConstants.EC
        };
    }

    return new CaptureModel(captureObject);
};


module.exports = CaptureModel;
