const assert = require('assert');
const proxyquire = require('proxyquire').noCallThru();

var card = {
    cardNumber: { value: '5454545454545454' },
    expirationYear: { value: 2025 },
    expirationMonth: { value: 6 },
    securityCode: { value: '123' }
};

var proxyquireStubs = {
    preferenceHelperMock: require('../../../../mocks/preferenceHelperMocks.test')
};

var CardholderVerificationModelPath = '../../../../mocks/jpmcModelsMocks/jpmcCardholderVerificationModelMock.test.js';
const CardholderVerificationModel = proxyquire(CardholderVerificationModelPath, {
    '*/cartridge/scripts/helpers/preferenceHelper': proxyquireStubs.preferenceHelperMock
});

describe('getCardholderVerificationObject', function () {
    it('should return a cardholderVerificationObject with cardholderVerification', function () {
        var result = new CardholderVerificationModel(CardholderVerificationModel.getCardholderVerificationObject(card));
        assert.equal(result.ccCardVerifyNum, '123');
    });
});
