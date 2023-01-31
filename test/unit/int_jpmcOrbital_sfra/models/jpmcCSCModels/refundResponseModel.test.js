'use strict';

const assert = require('chai').assert;

const allKeysOfRefundResponseModel = [
    'transType',
    'merchant',
    'order',
    'paymentInstrument',
    'avsBilling',
    'cardholderVerification'
];

describe('RefundResponseModel unit test', function () {
    const refundResponseModelPath = '../../../../mocks/jpmcCSCModelsMocks/refundResponseModelMock.test.js';
    const RefundResponseModel = require(refundResponseModelPath);
    describe('RefundResponseModel constructor function unit test', function () {
        let object = {
            transType: 'FR',
            merchant: {
                bin: '000001',
                merchantID: '441760',
                terminalID: '001'
            },
            paymentInstrument: {
                card: {
                    cardBrand: 'MC'
                }
            },
            order: {
                orderID: '23433',
                industryType: 'EC',
                retryTrace: '32904924',
                txRefNum: '6220C4D850338CF742D6B35BBB43C7E4B2695462',
                txRefIdx: '2',
                respDateTime: '20220303083832',
                status: {
                    procStatus: '0',
                    procStatusMessage: 'Approved',
                    hostRespCode: '100',
                    respCode: '00',
                    approvalStatus: '1',
                    authorizationCode: 'tst486',
                    pymtBrandAuthResponseCode: '000',
                    pymtBrandResponseCodeCategory: 'X'
                }
            },
            avsBilling: {
                avsRespCode: '3 '
            },
            cardholderVerification: {
                cvvRespCode: ' ',
                hostCVVRespCode: '  '
            }
        };

        let refundResponseObject = new RefundResponseModel(object);
        it('It should return RefundResponseModel instance as typeof object', function () {
            assert.typeOf(refundResponseObject, 'object');
            assert.instanceOf(refundResponseObject, RefundResponseModel);
        });
        it('It should return RefundResponseModel instance with keys', function () {
            assert.hasAllKeys(refundResponseObject, allKeysOfRefundResponseModel);
        });
        it('It should return RefundResponseModel instance transType', function () {
            assert.equal(refundResponseObject.transType, object.transType);
        });
        it('It should return RefundResponseModel instance merchant', function () {
            assert.equal(refundResponseObject.merchant, object.merchant);
        });
        it('It should return RefundResponseModel instance order', function () {
            assert.equal(refundResponseObject.order, object.order);
        });
        it('It should return RefundResponseModel instance paymentInstrument', function () {
            assert.equal(refundResponseObject.paymentInstrument, object.paymentInstrument);
        });
        it('It should return RefundResponseModel instance avsBilling', function () {
            assert.equal(refundResponseObject.avsBilling, object.avsBilling);
        });
        it('It should return RefundResponseModel instance cardholderVerification', function () {
            assert.equal(refundResponseObject.cardholderVerification, object.cardholderVerification);
        });
    });
    describe('setRefundResponseObject method unit test', function () {
        var response = {
            transType: 'FR',
            merchant: {
                bin: '000001',
                merchantID: '441760',
                terminalID: '001'
            },
            paymentInstrument: {
                card: {
                    cardBrand: 'MC'
                }
            },
            order: {
                orderID: '23433',
                industryType: 'EC',
                retryTrace: '32904924',
                txRefNum: '6220C4D850338CF742D6B35BBB43C7E4B2695462',
                txRefIdx: '2',
                respDateTime: '20220303083832',
                status: {
                    procStatus: '0',
                    procStatusMessage: 'Approved',
                    hostRespCode: '100',
                    respCode: '00',
                    approvalStatus: '1',
                    authorizationCode: 'tst486',
                    pymtBrandAuthResponseCode: '000',
                    pymtBrandResponseCodeCategory: 'X'
                }
            },
            avsBilling: {
                avsRespCode: '3'
            },
            cardholderVerification: {
                cvvRespCode: ' ',
                hostCVVRespCode: '  '
            }
        };
        let refundResponseObject = RefundResponseModel.setRefundResponseObject(response);
        it('It should return RefundResponseModel instance as typeof object', function () {
            assert.typeOf(refundResponseObject, 'object');
            assert.instanceOf(refundResponseObject, RefundResponseModel);
        });
        it('It should return RefundResponseModel instance transType', function () {
            assert.equal(refundResponseObject.transType, 'FR');
        });
        it('It should return RefundResponseModel instance merchant bin', function () {
            assert.equal(refundResponseObject.merchant.bin, '000001');
        });
        it('It should return RefundResponseModel instance merchant merchantID', function () {
            assert.equal(refundResponseObject.merchant.merchantID, '441760');
        });
        it('It should return RefundResponseModel instance merchant terminalID', function () {
            assert.equal(refundResponseObject.merchant.terminalID, '001');
        });
        it('It should return RefundResponseModel instance order orderID', function () {
            assert.equal(refundResponseObject.order.orderID, '23433');
        });
        it('It should return RefundResponseModel instance order industryType', function () {
            assert.equal(refundResponseObject.order.industryType, 'EC');
        });
        it('It should return RefundResponseModel instance order txRefNum', function () {
            assert.equal(refundResponseObject.order.txRefNum, '6220C4D850338CF742D6B35BBB43C7E4B2695462');
        });
        it('It should return RefundResponseModel instance order txRefIdx', function () {
            assert.equal(refundResponseObject.order.txRefIdx, '2');
        });
        it('It should return RefundResponseModel instance order retryTrace', function () {
            assert.equal(refundResponseObject.order.retryTrace, '32904924');
        });
        it('It should return RefundResponseModel instance order respDateTime', function () {
            assert.equal(refundResponseObject.order.respDateTime, '20220303083832');
        });
        it('It should return RefundResponseModel instance order status', function () {
            assert.equal(refundResponseObject.order.status.procStatus, '0');
        });
        it('It should return RefundResponseModel instance order status', function () {
            assert.equal(refundResponseObject.order.status.approvalStatus, '1');
        });
        it('It should return RefundResponseModel instance order status', function () {
            assert.equal(refundResponseObject.order.status.hostRespCode, '100');
        });
        it('It should return RefundResponseModel instance order status', function () {
            assert.equal(refundResponseObject.order.status.respCode, '00');
        });
        it('It should return RefundResponseModel instance order status', function () {
            assert.equal(refundResponseObject.order.status.authorizationCode, 'tst486');
        });
        it('It should return RefundResponseModel instance order status', function () {
            assert.equal(refundResponseObject.order.status.procStatusMessage, 'Approved');
        });
        it('It should return RefundResponseModel instance order status', function () {
            assert.equal(refundResponseObject.order.status.pymtBrandAuthResponseCode, '000');
        });
        it('It should return RefundResponseModel instance order status', function () {
            assert.equal(refundResponseObject.order.status.pymtBrandResponseCodeCategory, 'X');
        });
        it('It should return RefundResponseModel instance order paymentInstrument', function () {
            assert.equal(refundResponseObject.paymentInstrument.card.cardBrand, 'MC');
        });
        it('It should return RefundResponseModel instance order avsBilling', function () {
            assert.equal(refundResponseObject.avsBilling.avsRespCode, '3');
        });
    });
});
