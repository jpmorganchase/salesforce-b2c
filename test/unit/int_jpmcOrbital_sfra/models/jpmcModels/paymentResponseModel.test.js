
const assert = require('assert');
const proxyquire = require('proxyquire').noCallThru();

var paymentResponseObject = {
    transType: 'AC',
    merchant: {
        bin: '000001',
        merchantID: '441759',
        terminalID: '001'
    },
    paymentInstrument: {
        card: {
            cardBrand: 'MC'
        }
    },
    order: {
        orderID: '123456',
        industryType: 'EC',
        txRefNum: '621E82ED17947CE7FE30D61A19D3ECE3127654B2',
        txRefIdx: '2',
        respDateTime: '20220301153245',
        status: {
            procStatus: '0',
            procStatusMessage: 'Approved',
            hostRespCode: '100',
            respCode: '00',
            approvalStatus: '1',
            authorizationCode: 'tst569',
            pymtBrandAuthResponseCode: '000',
            pymtBrandResponseCodeCategory: 'X'
        }
    },
    emvInfo: {},
    avsBilling: {
        avsRespCode: 'B ',
        hostAVSRespCode: 'I3'
    },
    cardholderVerification: {
        cvvRespCode: ' ',
        hostCVVRespCode: '  '
    },
    cardTypeIndicator: {},
    earlyWarningSystem: {},
    foreignExchange: {},
    realTimeAccountUpdater: {},
    giftcard: {},
    profile: {
        profileProcStatus: '0',
        profileProcStatusMsg: 'Use Profile Transaction Completed'
    },
    managedBilling: {}
};

var proxyquireStubs = {
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

var PaymentResponseModelPath = '../../../../mocks/jpmcModelsMocks/paymentResponseModel.test.js';
const PaymentResponseModel = proxyquire(PaymentResponseModelPath, {
    '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks
});

describe('JPMC Orbital Payment Response Model Tests', function () {
    describe('getStatus', function () {
        it('should return status of paymentResponseObject', function () {
            var resultObject = new PaymentResponseModel(paymentResponseObject);
            var result = resultObject.getStatus();
            assert.equal(result, true);
        });
    });

    describe('getStatusMessage', function () {
        it('should return status message of paymentResponseObject', function () {
            var resultObject = new PaymentResponseModel(paymentResponseObject);
            var result = resultObject.getStatusMessage();
            assert.equal(result, 'Approved');
        });
    });

    describe('getTxRefNum', function () {
        it('should return transaction number of paymentResponseObject', function () {
            var resultObject = new PaymentResponseModel(paymentResponseObject);
            var result = resultObject.getTxRefNum();
            assert.equal(result, '621E82ED17947CE7FE30D61A19D3ECE3127654B2');
        });
    });

    describe('getResponseDateTime', function () {
        it('should return response date time of paymentResponseObject', function () {
            var resultObject = new PaymentResponseModel(paymentResponseObject);
            var result = resultObject.getResponseDateTime();
            assert.equal(result, '20220301153245');
        });
    });

    describe('getProfileObject', function () {
        it('should return profile object of paymentResponseObject', function () {
            var resultObject = new PaymentResponseModel(paymentResponseObject);
            var result = resultObject.getProfileObject();
            assert.equal(result.profileProcStatus, '0');
            assert.equal(
            result.profileProcStatusMsg,
            'Use Profile Transaction Completed'
        );
        });
    });

    describe('getProfileMessage', function () {
        it('should return profile object of paymentResponseObject', function () {
            var resultObject = new PaymentResponseModel(paymentResponseObject);
            var result = resultObject.getProfileMessage();
            assert.equal(result, 'Use Profile Transaction Completed');
        });
    });
});
