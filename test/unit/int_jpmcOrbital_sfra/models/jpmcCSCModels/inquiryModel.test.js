'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfInquiryModel = [
    'version',
    'merchant',
    'order'
];

var proxyquireStubs = {
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

describe('InquiryModel unit test', function () {
    const inquiryModelPath = '../../../../mocks/jpmcCSCModelsMocks/inquiryModelMock.test.js';
    const InquiryModel = proxyquire(inquiryModelPath, {
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks
    });
    describe('InquiryModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            merchant: {
                bin: '000001',
                terminalID: '001'
            },
            order: {
                orderID: '123456',
                inquiryRetryNumber: '123901',
                retryTrace: '01010101'
            }
        };
        let inquiryObject = new InquiryModel(object);
        it('It should return InquiryModel instance as typeof object', function () {
            assert.typeOf(inquiryObject, 'object');
            assert.instanceOf(inquiryObject, InquiryModel);
        });
        it('It should return InquiryModel instance with keys', function () {
            assert.hasAllKeys(inquiryObject, allKeysOfInquiryModel);
        });
        it('It should return InquiryModel instance version', function () {
            assert.equal(inquiryObject.version, object.version);
        });
        it('It should return InquiryModel instance merchant', function () {
            assert.equal(inquiryObject.merchant, object.merchant);
        });
        it('It should return InquiryModel instance order', function () {
            assert.equal(inquiryObject.order, object.order);
        });
    });
    describe('getInquiryObject method unit test', function () {
        var response = {
            version: '4.5',
            merchant: {
                bin: '000001',
                terminalID: '001'
            },
            order: {
                orderID: '123456',
                retryTrace: '01010101'
            }
        };
        var retryTrace = '01010101';
        let inquiryObject = InquiryModel.getInquiryObject(response, retryTrace);
        it('It should return InquiryModel instance as typeof object', function () {
            assert.typeOf(inquiryObject, 'object');
            assert.instanceOf(inquiryObject, InquiryModel);
        });
        it('It should return InquiryModel instance version', function () {
            assert.equal(inquiryObject.version, '4.5');
        });
        it('It should return InquiryModel instance merchant bin', function () {
            assert.equal(inquiryObject.merchant.bin, '000001');
        });
        it('It should return InquiryModel instance merchant terminalID', function () {
            assert.equal(inquiryObject.merchant.terminalID, '001');
        });
        it('It should return InquiryModel instance order orderID', function () {
            assert.equal(inquiryObject.order.orderID, '123456');
        });
        it('It should return InquiryModel instance order inquiryRetryNumber', function () {
            assert.equal(inquiryObject.order.inquiryRetryNumber, '01010101');
        });
    });
});
