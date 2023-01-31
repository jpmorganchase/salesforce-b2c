'use strict';

var HookMgr = require('dw/system/HookMgr');
// var Resource = require('dw/web/Resource');

/**
 * @desc Payment Response Model
 * @param {Object} paymentResponseObject paymentResponseObject
 */
function AVSPaymentResponseModel(paymentResponseObject) {
    if (paymentResponseObject.avsBilling) {
        this.avsRespCode = paymentResponseObject.avsBilling.avsRespCode.trim();
        this.hostAVSRespCode = paymentResponseObject.avsBilling.hostAVSRespCode;
    }
}
AVSPaymentResponseModel.getAVSResponseStatus = function () {
    if (HookMgr.hasHook('app.orbital.avs')) {
        return HookMgr.callHook('app.orbital.avs', 'status', this.avsRespCode);
    }
    return null;
};


module.exports = AVSPaymentResponseModel;
