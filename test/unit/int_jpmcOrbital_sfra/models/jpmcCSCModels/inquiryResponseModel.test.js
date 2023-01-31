'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfInquiryResponseModel = [
    'version',
    'merchant',
    'order',
    'transType',
    'paymentInstrument',
    'avsBilling',
    'cardholderVerification',
    'profile'
];

var proxyquireStubs = {
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

describe('InquiryResponseModel unit test', function () {
    const inquiryResponseModelPath = '../../../../mocks/jpmcCSCModelsMocks/inquiryResponseModelMock.test.js';
    const InquiryResponseModel = proxyquire(inquiryResponseModelPath, {
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks
    });
    describe('InquiryResponseModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            transType: 'FR',
            merchant: {
                bin: '000001',
                merchantID: '441760',
                terminalID: '001'
            },
            paymentInstrument: {
                card: {
                    cardBrand: 'MC',
                    ccAccountNum: '5454545454545454'
                }
            },
            order: {
                orderID: '23433',
                txRefNum: '6220C4D850338CF742D6B35BBB43C7E4B2695462',
                txRefIdx: '2',
                respDateTime: '20220303083832',
                status: {
                    procStatus: '0',
                    procStatusMessage: 'Approved',
                    hostRespCode: '100',
                    respCode: '00',
                    approvalStatus: '1',
                    authorizationCode: 'tst486'
                }
            },
            avsBilling: {
                avsRespCode: '3 '
            },
            cardholderVerification: {
                cvvRespCode: ' ',
                hostCVVRespCode: '  '
            },
            profile: {}
        };

        let inquiryResponseObject = new InquiryResponseModel(object);
        it('It should return InquiryResponseModel instance as typeof object', function () {
            assert.typeOf(inquiryResponseObject, 'object');
            assert.instanceOf(inquiryResponseObject, InquiryResponseModel);
        });
        it('It should return InquiryResponseModel instance with keys', function () {
            assert.hasAllKeys(inquiryResponseObject, allKeysOfInquiryResponseModel);
        });
        it('It should return InquiryResponseModel instance version', function () {
            assert.equal(inquiryResponseObject.version, object.version);
        });
        it('It should return InquiryResponseModel instance transType', function () {
            assert.equal(inquiryResponseObject.transType, object.transType);
        });
        it('It should return InquiryResponseModel instance merchant', function () {
            assert.equal(inquiryResponseObject.merchant, object.merchant);
        });
        it('It should return InquiryResponseModel instance order', function () {
            assert.equal(inquiryResponseObject.order, object.order);
        });
        it('It should return InquiryResponseModel instance paymentInstrument', function () {
            assert.equal(inquiryResponseObject.paymentInstrument, object.paymentInstrument);
        });
        it('It should return InquiryResponseModel instance avsBilling', function () {
            assert.equal(inquiryResponseObject.avsBilling, object.avsBilling);
        });
        it('It should return InquiryResponseModel instance cardholderVerification', function () {
            assert.equal(inquiryResponseObject.cardholderVerification, object.cardholderVerification);
        });
        it('It should return InquiryResponseModel instance profile', function () {
            assert.equal(inquiryResponseObject.profile, object.profile);
        });
    });
    describe('setInquiryResponseObject method unit test', function () {
        var response = {
            version: '4.5',
            transType: 'FR',
            merchant: {
                bin: '000001',
                merchantID: '441760',
                terminalID: '001'
            },
            paymentInstrument: {
                card: {
                    cardBrand: 'MC',
                    ccAccountNum: '5454545454545454'
                }
            },
            order: {
                orderID: '23433',
                txRefNum: '6220C4D850338CF742D6B35BBB43C7E4B2695462',
                txRefIdx: '2',
                respDateTime: '20220303083832',
                status: {
                    procStatus: '0',
                    procStatusMessage: 'Approved',
                    hostRespCode: '100',
                    respCode: '00',
                    approvalStatus: '1',
                    authorizationCode: 'tst486'
                }
            },
            avsBilling: {
                avsRespCode: '3'
            },
            cardholderVerification: {
                cvvRespCode: ' ',
                hostCVVRespCode: '  '
            },
            profile: {}
        };
        let inquiryResponseObject = InquiryResponseModel.setInquiryResponseObject(response);
        it('It should return InquiryResponseModel instance as typeof object', function () {
            assert.typeOf(inquiryResponseObject, 'object');
            assert.instanceOf(inquiryResponseObject, InquiryResponseModel);
        });
        it('It should return InquiryResponseModel instance version', function () {
            assert.equal(inquiryResponseObject.version, '4.5');
        });
        it('It should return InquiryResponseModel instance transType', function () {
            assert.equal(inquiryResponseObject.transType, 'FR');
        });
        it('It should return InquiryResponseModel instance merchant bin', function () {
            assert.equal(inquiryResponseObject.merchant.bin, '000001');
        });
        it('It should return InquiryResponseModel instance merchant merchantID', function () {
            assert.equal(inquiryResponseObject.merchant.merchantID, '441760');
        });
        it('It should return InquiryResponseModel instance merchant terminalID', function () {
            assert.equal(inquiryResponseObject.merchant.terminalID, '001');
        });
        it('It should return InquiryResponseModel instance order orderID', function () {
            assert.equal(inquiryResponseObject.order.orderID, '23433');
        });
        it('It should return InquiryResponseModel instance order txRefNum', function () {
            assert.equal(inquiryResponseObject.order.txRefNum, '6220C4D850338CF742D6B35BBB43C7E4B2695462');
        });
        it('It should return InquiryResponseModel instance order txRefIdx', function () {
            assert.equal(inquiryResponseObject.order.txRefIdx, '2');
        });
        it('It should return InquiryResponseModel instance order respDateTime', function () {
            assert.equal(inquiryResponseObject.order.respDateTime, '20220303083832');
        });
        it('It should return InquiryResponseModel instance order status', function () {
            assert.equal(inquiryResponseObject.order.status.procStatus, '0');
        });
        it('It should return InquiryResponseModel instance order status', function () {
            assert.equal(inquiryResponseObject.order.status.approvalStatus, '1');
        });
        it('It should return InquiryResponseModel instance order status', function () {
            assert.equal(inquiryResponseObject.order.status.hostRespCode, '100');
        });
        it('It should return InquiryResponseModel instance order status', function () {
            assert.equal(inquiryResponseObject.order.status.respCode, '00');
        });
        it('It should return InquiryResponseModel instance order status', function () {
            assert.equal(inquiryResponseObject.order.status.authorizationCode, 'tst486');
        });
        it('It should return InquiryResponseModel instance order status', function () {
            assert.equal(inquiryResponseObject.order.status.procStatusMessage, 'Approved');
        });
        it('It should return InquiryResponseModel instance order paymentInstrument', function () {
            assert.equal(inquiryResponseObject.paymentInstrument.card.cardBrand, 'MC');
        });
        it('It should return InquiryResponseModel instance order paymentInstrument', function () {
            assert.equal(inquiryResponseObject.paymentInstrument.card.ccAccountNum, '5454545454545454');
        });
        it('It should return InquiryResponseModel instance order avsBilling', function () {
            assert.equal(inquiryResponseObject.avsBilling.avsRespCode, '3');
        });
    });
});
