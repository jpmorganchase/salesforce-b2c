'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfCaptureModel = [
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

describe('CaptureModel unit test', function () {
    const captureModelPath = '../../../../mocks/jpmcCSCModelsMocks/captureModelMock.test.js';
    const CaptureModel = proxyquire(captureModelPath, {
        '*/cartridge/scripts/helpers/orbitalAPIHelper': proxyquireStubs.orbitalAPIHelperMock,
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks,
        '*/cartridge/models/jpmcModels/jpmcCardPresentModel': proxyquireStubs.jpmcCardPresentModelMocks
    });
    describe('CaptureModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            merchant: {
                bin: '000001',
                terminalID: '001'
            },
            order: {
                orderID: '123456',
                txRefNum: '5F2C93F8E1B3B9E3095D31165071400DC6975441',
                retryTrace: '01010101'
            },
            cardPresent: {
                emvInfo: {
                    vendorID: 'G022',
                    softwareID: 'O023'
                }
            }
        };

        let captureObject = new CaptureModel(object);
        it('It should return CaptureModel instance as typeof object', function () {
            assert.typeOf(captureObject, 'object');
            assert.instanceOf(captureObject, CaptureModel);
        });
        it('It should return CaptureModel instance with keys', function () {
            assert.hasAllKeys(captureObject, allKeysOfCaptureModel);
        });
        it('It should return CaptureModel instance version', function () {
            assert.equal(captureObject.version, object.version);
        });
        it('It should return CaptureModel instance merchant', function () {
            assert.equal(captureObject.merchant, object.merchant);
        });
        it('It should return CaptureModel instance order', function () {
            assert.equal(captureObject.order, object.order);
        });
        it('It should return CaptureModel instance cardPresent', function () {
            assert.equal(captureObject.cardPresent, object.cardPresent);
        });
    });
    describe('getCaptureObject method unit test', function () {
        var response = {
            version: '4.5',
            merchant: {
                bin: '000001',
                terminalID: '001'
            },
            order: {
                orderID: '123456',
                txRefNum: '5F2C93F8E1B3B9E3095D31165071400DC6975441',
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
        var transactionID = '5F2C93F8E1B3B9E3095D31165071400DC6975441';
        let captureObject = CaptureModel.getCaptureObject(response, amount, transactionID);
        it('It should return CaptureModel instance as typeof object', function () {
            assert.typeOf(captureObject, 'object');
            assert.instanceOf(captureObject, CaptureModel);
        });
        it('It should return CaptureModel instance version', function () {
            assert.equal(captureObject.version, '4.5');
        });
        it('It should return CaptureModel instance merchant bin', function () {
            assert.equal(captureObject.merchant.bin, '000001');
        });
        it('It should return CaptureModel instance merchant terminalID', function () {
            assert.equal(captureObject.merchant.terminalID, '001');
        });
        it('It should return CaptureModel instance order orderID', function () {
            assert.equal(captureObject.order.orderID, '123456');
        });
        it('It should return CaptureModel instance order txRefNum', function () {
            assert.equal(captureObject.order.txRefNum, '5F2C93F8E1B3B9E3095D31165071400DC6975441');
        });
        it('It should return CaptureModel instance cardPresent vendorID', function () {
            assert.equal(captureObject.cardPresent.emvInfo.vendorID, 'G022');
        });
        it('It should return CaptureModel instance cardPresent softwareID', function () {
            assert.equal(captureObject.cardPresent.emvInfo.softwareID, 'O023');
        });
    });
});
