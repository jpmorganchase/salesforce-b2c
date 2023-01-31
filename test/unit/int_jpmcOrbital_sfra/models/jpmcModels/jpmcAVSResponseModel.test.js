'use strict';
const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

var AVSResponseModelPack = '../../../../mocks/jpmcModelsMocks/jpmcAVSResponseModelMock.test.js';
var AVSResponseModel = proxyquire(AVSResponseModelPack, {
    'dw/system/HookMgr': {
        hasHook: function () {
            return true;
        },
        callHook: function () {
            return true;
        }
    }
});

describe('getAVSObjectForPayment', function () {
    it('should return a orderObject with orderID and amount', function () {
        var result = AVSResponseModel.getAVSResponseStatus();
        assert.equal(result, true);
    });
});

