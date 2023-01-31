'use strict';
/**
 * @module CaptureResponseModel
 */
/**
 * Model for Reversal
 * @typedef {CaptureResponseModel} CaptureResponseModel
 * @property {Object} merchant
 * @property {Object} order
 */

/**
 * @description constructor for CaptureResponseModel
 * @constructor CaptureResponseModel
 * @param {Object} captureResponseObject - Plain object that matches the model properties
 */
function CaptureResponseModel(captureResponseObject) {
    this.merchant = captureResponseObject.merchant;
    this.order = captureResponseObject.order;
}

CaptureResponseModel.setCaptureResponseObject = function (responseObject) {
    if (responseObject) {
        var captureResponseObject = {};

        captureResponseObject.merchant = {
            bin: responseObject.merchant.bin,
            terminalID: responseObject.merchant.terminalID
        };

        captureResponseObject.order = {
            orderID: responseObject.order.orderID,
            txRefNum: responseObject.order.txRefNum,
            txRefIdx: responseObject.order.txRefIdx,
            respDateTime: responseObject.order.respDateTime,
            status: responseObject.order.status,
            retryTrace: responseObject.order.retryTrace
        };

        return new CaptureResponseModel(captureResponseObject);
    }
    return null;
};


module.exports = CaptureResponseModel;
