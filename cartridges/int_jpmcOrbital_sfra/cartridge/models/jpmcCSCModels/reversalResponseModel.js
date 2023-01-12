'use strict';

var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 *  Property of OSF Global Services, Inc., d/b/a OSF Digital. OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
/**
 * @module ReversalResponseModel
 */
/**
 * Model for Reversal
 * @typedef {reversalResponseModel} reversalResponseModel
 * @property {String} version
 * @property {Object} merchant
 * @property {Object} order
 */

/**
 * @description constructor for reversalResponseModel
 * @constructor reversalResponseModel
 * @param {Object} reversalResponseObject - Plain object that matches the model properties
 */
function ReversalResponseModel(reversalResponseObject) {
    this.version = JPMCOrbitalConstants.version;
    this.merchant = reversalResponseObject.merchant;
    this.order = reversalResponseObject.order;
}

ReversalResponseModel.setReversalResponseObject = function (responseObject) {
    if (responseObject) {
        var reversalResponseObject = {};

        reversalResponseObject.merchant = {
            bin: responseObject.merchant.bin,
            merchantID: responseObject.merchant.merchantID,
            terminalID: responseObject.merchant.terminalID
        };

        reversalResponseObject.order = {
            orderID: responseObject.order.orderID,
            outstandingAmt: responseObject.order.outstandingAmt,
            txRefNum: responseObject.order.txRefNum,
            txRefIdx: responseObject.order.txRefIdx,
            respDateTime: responseObject.order.respDateTime,
            status: responseObject.order.status,
            retryTrace: responseObject.order.retryTrace
        };

        return new ReversalResponseModel(reversalResponseObject);
    }
    return null;
};


module.exports = ReversalResponseModel;
