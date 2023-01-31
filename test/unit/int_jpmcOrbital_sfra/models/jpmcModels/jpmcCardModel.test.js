'use strict';
const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

var card = {
    cardNumber: { value: '5454545454545454' },
    expirationYear: { value: 2025 },
    expirationMonth: { value: 6 },
    securityCode: { value: '123' },
    cardType: { value: 'Master Card' }
};

var proxyquireStubs = {
    preferenceHelperMock: require('../../../../mocks/preferenceHelperMocks.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};
global.request = {
    getLocale: function () {
        return 'en_US';
    },
    httpParameterMap: {
        paymentOption: { value: 'JPMC_ORBITAL_CC_METHOD' } }
};
const CardModelPath = '../../../../mocks/jpmcModelsMocks/jpmcCardModelMock.test.js';
const CardModel = proxyquire(CardModelPath, {
    '*/cartridge/scripts/helpers/preferenceHelper': proxyquireStubs.preferenceHelperMock,
    '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks
});
describe('getCardObjectForCredit', function () {
    it('should return a cardObject with ccAccountNum and ccExp', function () {
        var result = new CardModel(CardModel.getCardObjectForCredit(card));
        assert.equal(result.ccAccountNum, '5454545454545454');
        assert.equal(result.ccExp, '202506');
    });
});

