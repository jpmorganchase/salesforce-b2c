'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfRefundModel = [
    'version',
    'merchant',
    'order',
    'cardPresent'
];

var proxyquireStubs = {
    orbitalAPIHelperMock: require('../../../../mocks/orbitalAPIHelperMocks.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test'),
    jpmcCardPresentModelMocks: require('../../../../mocks/jpmcModelsMocks/jpmcCardPresentModelMock.test')
};

describe('RefundModel unit test', function () {
    const refundModelPath = '../../../../mocks/jpmcCSCModelsMocks/refundModelMock.test.js';
    const RefundModel = proxyquire(refundModelPath, {
        '*/cartridge/scripts/helpers/orbitalAPIHelper': proxyquireStubs.orbitalAPIHelperMock,
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks,
        '*/cartridge/models/jpmcModels/jpmcCardPresentModel': proxyquireStubs.jpmcCardPresentModelMocks
    });
    describe('RefundModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            merchant: {
                bin: '000001',
                terminalID: '001'
            },
            order: {
                orderID: '123456',
                amount: '100',
                industryType: 'EC',
                comments: 'comments',
                txRefNum: '5F67C6E74C4D53364FA4EB642EB2CE82108D53F7',
                retryTrace: '01010101'
            },
            cardPresent: {
                emvInfo: {
                    vendorID: 'G022',
                    softwareID: 'O023'
                }
            }
        };

        let refundObject = new RefundModel(object);
        it('It should return RefundModel instance as typeof object', function () {
            assert.typeOf(refundObject, 'object');
            assert.instanceOf(refundObject, RefundModel);
        });
        it('It should return RefundModel instance with keys', function () {
            assert.hasAllKeys(refundObject, allKeysOfRefundModel);
        });
        it('It should return RefundModel instance version', function () {
            assert.equal(refundObject.version, object.version);
        });
        it('It should return RefundModel instance merchant', function () {
            assert.equal(refundObject.merchant, object.merchant);
        });
        it('It should return RefundModel instance order', function () {
            assert.equal(refundObject.order, object.order);
        });
        it('It should return RefundModel instance cardPresent', function () {
            assert.equal(refundObject.cardPresent, object.cardPresent);
        });
    });
    describe('getRefundObject method unit test', function () {
        var response = {
            version: '4.5',
            merchant: {
                bin: '000001',
                terminalID: '001'
            },
            order: {
                orderID: '123456',
                amount: '100',
                industryType: 'EC',
                comments: 'comments',
                txRefNum: '5F67C6E74C4D53364FA4EB642EB2CE82108D53F7',
                retryTrace: '01010101'
            },
            cardPresent: {
                emvInfo: {
                    vendorID: 'G022',
                    softwareID: 'O023'
                }
            }
        };
        var amount = 100;
        var transactionID = '5F67C6E74C4D53364FA4EB642EB2CE82108D53F7';
        let refundObject = RefundModel.getRefundObject(response, amount, transactionID);
        it('It should return RefundModel instance as typeof object', function () {
            assert.typeOf(refundObject, 'object');
            assert.instanceOf(refundObject, RefundModel);
        });
        it('It should return RefundModel instance version', function () {
            assert.equal(refundObject.version, '4.5');
        });
        it('It should return RefundModel instance merchant bin', function () {
            assert.equal(refundObject.merchant.bin, '000001');
        });
        it('It should return RefundModel instance merchant terminalID', function () {
            assert.equal(refundObject.merchant.terminalID, '001');
        });
        it('It should return RefundModel instance order orderID', function () {
            assert.equal(refundObject.order.orderID, '123456');
        });
        it('It should return RefundModel instance order txRefNum', function () {
            assert.equal(refundObject.order.txRefNum, '5F67C6E74C4D53364FA4EB642EB2CE82108D53F7');
        });
        it('It should return RefundModel instance cardPresent vendorID', function () {
            assert.equal(refundObject.cardPresent.emvInfo.vendorID, 'G022');
        });
        it('It should return RefundModel instance cardPresent softwareID', function () {
            assert.equal(refundObject.cardPresent.emvInfo.softwareID, 'O023');
        });
    });
});
