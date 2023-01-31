'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfReversalModel = [
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

describe('ReversalModel unit test', function () {
    const reversalModelPath = '../../../../mocks/jpmcCSCModelsMocks/reversalModelMock.test.js';

    const ReversalModel = proxyquire(reversalModelPath, {
        '*/cartridge/scripts/helpers/orbitalAPIHelper': proxyquireStubs.orbitalAPIHelperMock,
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks,
        '*/cartridge/models/jpmcModels/jpmcCardPresentModel': proxyquireStubs.jpmcCardPresentModelMocks
    });
    describe('ReversalModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            merchant: {
                bin: '000001',
                terminalID: '001'
            },
            order: {
                orderID: '12345',
                txRefNum: '5F4E496C7X9E96352EDFDC19AAC4422E403D53DC',
                retryTrace: '01010101'
            },
            cardPresent: {
                emvInfo: {
                    vendorID: 'G022',
                    softwareID: 'O023'
                }
            }
        };

        let reversalObject = new ReversalModel(object);
        it('It should return ReversalModel instance as typeof object', function () {
            assert.typeOf(reversalObject, 'object');
            assert.instanceOf(reversalObject, ReversalModel);
        });
        it('It should return ReversalModel instance with keys', function () {
            assert.hasAllKeys(reversalObject, allKeysOfReversalModel);
        });
        it('It should return ReversalModel instance version', function () {
            assert.equal(reversalObject.version, object.version);
        });
        it('It should return ReversalModel instance merchant', function () {
            assert.equal(reversalObject.merchant, object.merchant);
        });
        it('It should return ReversalModel instance order', function () {
            assert.equal(reversalObject.order, object.order);
        });
        it('It should return ReversalModel instance cardPresent', function () {
            assert.equal(reversalObject.cardPresent, object.cardPresent);
        });
    });
    describe('getReversalObject method unit test', function () {
        var response = {
            version: '4.5',
            merchant: {
                bin: '000001',
                terminalID: '001'
            },
            order: {
                orderID: '12345',
                txRefNum: '5F4E496C7X9E96352EDFDC19AAC4422E403D53DC',
                retryTrace: '01010101'
            }
        };
        var transactionID = '5F4E496C7X9E96352EDFDC19AAC4422E403D53DC';
        var onlineReversalInd = 'Y';
        let reversalObject = ReversalModel.getReversalObject(response, onlineReversalInd, transactionID);
        it('It should return ReversalModel instance as typeof object', function () {
            assert.typeOf(reversalObject, 'object');
            assert.instanceOf(reversalObject, ReversalModel);
        });
        it('It should return ReversalModel instance version', function () {
            assert.equal(reversalObject.version, '4.5');
        });
        it('It should return ReversalModel instance merchant bin', function () {
            assert.equal(reversalObject.merchant.bin, '000001');
        });
        it('It should return ReversalModel instance merchant terminalID', function () {
            assert.equal(reversalObject.merchant.terminalID, '001');
        });
        it('It should return ReversalModel instance order orderID', function () {
            assert.equal(reversalObject.order.orderID, '12345');
        });
        it('It should return ReversalModel instance order txRefNum', function () {
            assert.equal(reversalObject.order.txRefNum, '5F4E496C7X9E96352EDFDC19AAC4422E403D53DC');
        });
        it('It should return ReversalModel instance cardPresent vendorID', function () {
            assert.equal(reversalObject.cardPresent.emvInfo.vendorID, 'G022');
        });
        it('It should return ReversalModel instance cardPresent softwareID', function () {
            assert.equal(reversalObject.cardPresent.emvInfo.softwareID, 'O023');
        });
    });
});
