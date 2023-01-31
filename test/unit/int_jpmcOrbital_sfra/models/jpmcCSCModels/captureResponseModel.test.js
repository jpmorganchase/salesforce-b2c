'use strict';

const assert = require('chai').assert;

const allKeysOfCaptureResponseModel = [
    'merchant',
    'order'
];

describe('CaptureResponseModel unit test', function () {
    const captureResponseModelPath = '../../../../mocks/jpmcCSCModelsMocks/captureResponseModelMock.test.js';
    const CaptureResponseModel = require(captureResponseModelPath);
    describe('CaptureResponseModel constructor function unit test', function () {
        let object = {
            merchant: {
                bin: '000001',
                terminalID: '001'
            },
            order: {
                orderID: '123456',
                txRefNum: '5F2C93F8E1B3B9E3095D31165071400DC6975441',
                retryTrace: '01010101',
                txRefIdx: '2',
                respDateTime: '20220303032357',
                status: {
                    procStatus: '0'
                }
            }
        };

        let captureResponseObject = new CaptureResponseModel(object);
        it('It should return CaptureResponseModel instance as typeof object', function () {
            assert.typeOf(captureResponseObject, 'object');
            assert.instanceOf(captureResponseObject, CaptureResponseModel);
        });
        it('It should return CaptureResponseModel instance with keys', function () {
            assert.hasAllKeys(captureResponseObject, allKeysOfCaptureResponseModel);
        });
        it('It should return CaptureResponseModel instance merchant', function () {
            assert.equal(captureResponseObject.merchant, object.merchant);
        });
        it('It should return CaptureResponseModel instance order', function () {
            assert.equal(captureResponseObject.order, object.order);
        });
    });
    describe('setCaptureResponseObject method unit test', function () {
        var response = {
            merchant: {
                bin: '000001',
                terminalID: '001'
            },
            order: {
                orderID: '123456',
                txRefNum: '5F2C93F8E1B3B9E3095D31165071400DC6975441',
                retryTrace: '01010101',
                txRefIdx: '2',
                respDateTime: '20220303032357',
                status: {
                    procStatus: '0'
                }
            }
        };
        let captureResponseObject = CaptureResponseModel.setCaptureResponseObject(response);
        it('It should return CaptureResponseModel instance as typeof object', function () {
            assert.typeOf(captureResponseObject, 'object');
            assert.instanceOf(captureResponseObject, CaptureResponseModel);
        });
        it('It should return CaptureResponseModel instance merchant bin', function () {
            assert.equal(captureResponseObject.merchant.bin, '000001');
        });
        it('It should return CaptureResponseModel instance merchant terminalID', function () {
            assert.equal(captureResponseObject.merchant.terminalID, '001');
        });
        it('It should return CaptureResponseModel instance order orderID', function () {
            assert.equal(captureResponseObject.order.orderID, '123456');
        });
        it('It should return CaptureResponseModel instance order txRefNum', function () {
            assert.equal(captureResponseObject.order.txRefNum, '5F2C93F8E1B3B9E3095D31165071400DC6975441');
        });
        it('It should return CaptureResponseModel instance order txRefNum', function () {
            assert.equal(captureResponseObject.order.txRefIdx, '2');
        });
        it('It should return CaptureResponseModel instance order retryTrace', function () {
            assert.equal(captureResponseObject.order.retryTrace, '01010101');
        });
        it('It should return CaptureResponseModel instance order respDateTime', function () {
            assert.equal(captureResponseObject.order.respDateTime, '20220303032357');
        });
        it('It should return CaptureResponseModel instance order status', function () {
            assert.equal(captureResponseObject.order.status.procStatus, '0');
        });
    });
});
