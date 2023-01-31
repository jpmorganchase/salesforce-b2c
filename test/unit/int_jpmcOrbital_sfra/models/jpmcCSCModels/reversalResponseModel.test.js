'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfReversalResponseModel = [
    'version',
    'merchant',
    'order'
];

var proxyquireStubs = {
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

describe('ReversalResponseModel unit test', function () {
    const reversalResponseModelPath = '../../../../mocks/jpmcCSCModelsMocks/reversalResponseModelMock.test.js';
    const ReversalResponseModel = proxyquire(reversalResponseModelPath, {
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks
    });
    describe('ReversalResponseModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            merchant: {
                bin: '000001',
                merchantID: '441760',
                terminalID: '001'
            },
            order: {
                orderID: '23466',
                outstandingAmt: '0',
                retryTrace: '745354533',
                txRefNum: '62207ADCE94BDE675FCF4762DDF2A2E38FAA5409',
                txRefIdx: '4',
                respDateTime: '20220303032455',
                status: {
                    procStatus: '0',
                    approvalStatus: '1'
                }
            }
        };

        let reversalResponseObject = new ReversalResponseModel(object);
        it('It should return ReversalResponseModel instance as typeof object', function () {
            assert.typeOf(reversalResponseObject, 'object');
            assert.instanceOf(reversalResponseObject, ReversalResponseModel);
        });
        it('It should return ReversalResponseModel instance with keys', function () {
            assert.hasAllKeys(reversalResponseObject, allKeysOfReversalResponseModel);
        });
        it('It should return ReversalResponseModel instance version', function () {
            assert.equal(reversalResponseObject.version, object.version);
        });
        it('It should return ReversalResponseModel instance merchant', function () {
            assert.equal(reversalResponseObject.merchant, object.merchant);
        });
        it('It should return ReversalResponseModel instance order', function () {
            assert.equal(reversalResponseObject.order, object.order);
        });
    });
    describe('setReversalResponseObject method unit test', function () {
        var response = {
            version: '4.5',
            merchant: {
                bin: '000001',
                merchantID: '441760',
                terminalID: '001'
            },
            order: {
                orderID: '23466',
                outstandingAmt: '0',
                retryTrace: '745354533',
                txRefNum: '62207ADCE94BDE675FCF4762DDF2A2E38FAA5409',
                txRefIdx: '4',
                respDateTime: '20220303032455',
                status: {
                    procStatus: '0',
                    approvalStatus: '1'
                }
            }
        };
        let reversalResponseObject = ReversalResponseModel.setReversalResponseObject(response);
        it('It should return ReversalResponseModel instance as typeof object', function () {
            assert.typeOf(reversalResponseObject, 'object');
            assert.instanceOf(reversalResponseObject, ReversalResponseModel);
        });
        it('It should return ReversalResponseModel instance version', function () {
            assert.equal(reversalResponseObject.version, '4.5');
        });
        it('It should return ReversalResponseModel instance merchant bin', function () {
            assert.equal(reversalResponseObject.merchant.bin, '000001');
        });
        it('It should return ReversalResponseModel instance merchant merchantID', function () {
            assert.equal(reversalResponseObject.merchant.merchantID, '441760');
        });
        it('It should return ReversalResponseModel instance merchant terminalID', function () {
            assert.equal(reversalResponseObject.merchant.terminalID, '001');
        });
        it('It should return ReversalResponseModel instance order orderID', function () {
            assert.equal(reversalResponseObject.order.orderID, '23466');
        });
        it('It should return ReversalResponseModel instance order txRefNum', function () {
            assert.equal(reversalResponseObject.order.txRefNum, '62207ADCE94BDE675FCF4762DDF2A2E38FAA5409');
        });
        it('It should return ReversalResponseModel instance order txRefIdx', function () {
            assert.equal(reversalResponseObject.order.txRefIdx, '4');
        });
        it('It should return ReversalResponseModel instance order retryTrace', function () {
            assert.equal(reversalResponseObject.order.retryTrace, '745354533');
        });
        it('It should return ReversalResponseModel instance order respDateTime', function () {
            assert.equal(reversalResponseObject.order.respDateTime, '20220303032455');
        });
        it('It should return ReversalResponseModel instance order status', function () {
            assert.equal(reversalResponseObject.order.status.procStatus, '0');
        });
        it('It should return ReversalResponseModel instance order status', function () {
            assert.equal(reversalResponseObject.order.status.approvalStatus, '1');
        });
        it('It should return ReversalResponseModel instance order outstandingAmt', function () {
            assert.equal(reversalResponseObject.order.outstandingAmt, '0');
        });
    });
});
