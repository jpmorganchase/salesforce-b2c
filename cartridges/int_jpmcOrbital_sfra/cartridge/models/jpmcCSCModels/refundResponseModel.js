'use strict';
/**
 *  Property of OSF Global Services, Inc., d/b/a OSF Digital. OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
/**
 * @module RefundResponseModel
 */
/**
 * Model for Reversal
 * @typedef {RefundResponseModel} RefundResponseModel
 * @property {String} transType
 * @property {Object} merchant
 * @property {Object} order
 * @property {Object} paymentInstrument
 * @property {Object} avsBilling
 * @property {Object} cardholderVerification
 */

/**
 * @description constructor for RefundResponseModel
 * @constructor RefundResponseModel
 * @param {Object} refundResponseObject - Plain object that matches the model properties
 */
function RefundResponseModel(refundResponseObject) {
    this.transType = refundResponseObject.transType;
    this.merchant = refundResponseObject.merchant;
    this.order = refundResponseObject.order;
    this.paymentInstrument = refundResponseObject.paymentInstrument;
    this.avsBilling = refundResponseObject.avsBilling;
    this.cardholderVerification = refundResponseObject.cardholderVerification;
}

RefundResponseModel.setRefundResponseObject = function (responseObject) {
    if (responseObject) {
        var refundResponseObject = {};

        refundResponseObject.transType = responseObject.transType;

        refundResponseObject.merchant = {
            bin: responseObject.merchant.bin,
            merchantID: responseObject.merchant.merchantID,
            terminalID: responseObject.merchant.terminalID
        };

        refundResponseObject.paymentInstrument = {
            card: responseObject.paymentInstrument.card
        };

        refundResponseObject.order = {
            orderID: responseObject.order.orderID,
            industryType: responseObject.order.industryType,
            txRefNum: responseObject.order.txRefNum,
            txRefIdx: responseObject.order.txRefIdx,
            respDateTime: responseObject.order.respDateTime,
            status: responseObject.order.status,
            retryTrace: responseObject.order.retryTrace
        };

        refundResponseObject.avsBilling = responseObject.avsBilling;

        refundResponseObject.cardholderVerification = responseObject.cardholderVerification;

        return new RefundResponseModel(refundResponseObject);
    }
    return null;
};


module.exports = RefundResponseModel;
