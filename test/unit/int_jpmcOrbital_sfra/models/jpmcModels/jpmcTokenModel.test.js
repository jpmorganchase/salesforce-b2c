'use strict';

const assert = require('chai').assert;

const proxyquire = require('proxyquire').noCallThru();

const allKeysOfTokenModel = [
    'version',
    'merchant',
    'order',
    'paymentInstrument',
    'token'
];

var proxyquireStubs = {
    CardModel: require('../../../../mocks/jpmcModelsMocks/jpmcCardModelMock.test'),
    MerchantModel: require('../../../../mocks/jpmcModelsMocks/jpmcMerchantModelMock.test'),
    orbitalAPIHelperMock: require('../../../../mocks/orbitalAPIHelperMocks.test'),
    preferenceHelperMock: require('../../../../mocks/preferenceHelperMocks.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test'),
    OrderMgr: {
        createOrderNo: function () {
            return '12345';
        }
    }
};
global.session = {
    currency: {
        currencyCode: ''
    },
    setCurrency: function (newCurrency) {
        this.currency.currencyCode = newCurrency;
    }
};
describe('TokenModel unit test', function () {
    const TokenModelPath = '../../../../mocks/jpmcModelsMocks/jpmcTokenModelMock.test.js';

    const TokenModel = proxyquire(TokenModelPath, {
        '*/cartridge/models/jpmcModels/jpmcMerchantModel': proxyquireStubs.MerchantModel,
        '*/cartridge/models/jpmcModels/jpmcCardModel': proxyquireStubs.CardModel,
        '*/cartridge/scripts/helpers/orbitalAPIHelper': proxyquireStubs.orbitalAPIHelperMock,
        '*/cartridge/scripts/helpers/preferenceHelper': proxyquireStubs.preferenceHelperMock,
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks,
        'dw/order/OrderMgr': proxyquireStubs.OrderMgr
    });
    describe('TokenModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            token: {
                actionCode: 'TK'
            },
            paymentInstrument: {
                card: {
                    ccExp: '202201',
                    ccAccountNum: '5454545454545454',
                    cardBrand: 'MC'
                }
            },
            order: {
                orderID: '123456',
                industryType: 'EC'
            },
            merchant: {
                terminalID: '001',
                bin: '000001'
            },
            pageEncryption: {}
        };

        let tokenObject = new TokenModel(object);
        it('It should return TokenModel instance as typeof object', function () {
            assert.typeOf(tokenObject, 'object');
            assert.instanceOf(tokenObject, TokenModel);
        });
        it('It should return TokenModel instance with keys', function () {
            assert.hasAllKeys(tokenObject, allKeysOfTokenModel);
        });
        it('It should return TokenModel instance version', function () {
            assert.equal(tokenObject.version, object.version);
        });
        it('It should return TokenModel instance merchant', function () {
            assert.equal(tokenObject.merchant, object.merchant);
        });
        it('It should return TokenModel instance order', function () {
            assert.equal(tokenObject.order, object.order);
        });
        it('It should return TokenModel instance paymentInstrument', function () {
            assert.equal(tokenObject.paymentInstrument, object.paymentInstrument);
        });
        it('It should return TokenModel instance token', function () {
            assert.equal(tokenObject.token, object.token);
        });
    });
    describe('getTokenObject method unit test', function () {
        var paymentObject = {
            paymentInstrument: {
                card: {
                    ccExp: '202201',
                    ccAccountNum: '5454545454545454',
                    cardBrand: 'MC'
                }
            },
            order: {
                orderID: '123456',
                industryType: 'EC'
            },
            merchant: {
                terminalID: '001',
                bin: '000001'
            }
        };
        var paymentInstrument = {
            card: {
                ccExp: '202201',
                ccAccountNum: '5454545454545454',
                cardBrand: 'MC'
            }
        };
        let tokenObject = TokenModel.getTokenObject(paymentObject, paymentInstrument, 'CC');
        it('It should return TokenModel instance as typeof object', function () {
            assert.typeOf(tokenObject, 'object');
            assert.instanceOf(tokenObject, TokenModel);
        });
        it('It should return TokenModel instance version', function () {
            assert.equal(tokenObject.version, '4.5');
        });
        it('It should return TokenModel instance merchant bin', function () {
            assert.equal(tokenObject.merchant.bin, '000001');
        });
        it('It should return TokenModel instance merchant terminalID', function () {
            assert.equal(tokenObject.merchant.terminalID, '001');
        });
        it('It should return TokenModel instance order orderID ', function () {
            assert.equal(tokenObject.order.orderID, '123456');
        });
        it('It should return TokenModel instance order industryType', function () {
            assert.equal(tokenObject.order.industryType, 'EC');
        });
        it('It should return TokenModel instance paymentInstrument card ccAccountNum', function () {
            assert.equal(tokenObject.paymentInstrument.card.ccAccountNum, '5454545454545454');
        });
        it('It should return TokenModel instance paymentInstrument card ccExp', function () {
            assert.equal(tokenObject.paymentInstrument.card.ccExp, '202201');
        });
        it('It should return TokenModel instance paymentInstrument card cardBrand', function () {
            assert.equal(tokenObject.paymentInstrument.card.cardBrand, 'MC');
        });
        it('It should return TokenModel instance token actionCode', function () {
            assert.equal(tokenObject.token.actionCode, 'TK');
        });
    });
    describe('getTokenObjectFromAccount method unit test', function () {
        var form = {
            cardNumber: { value: '5454545454545454' },
            expirationYear: { value: 2025 },
            expirationMonth: { value: 6 },
            securityCode: { value: '123' },
            cardType: { value: 'Master Card' }
        };
        let tokenObject = TokenModel.getTokenObjectFromAccount(form, 'CC');
        it('It should return TokenModel instance as typeof object', function () {
            assert.typeOf(tokenObject, 'object');
            assert.instanceOf(tokenObject, TokenModel);
        });
        it('It should return TokenModel instance version', function () {
            assert.equal(tokenObject.version, '4.5');
        });
        it('It should return TokenModel instance merchant bin', function () {
            assert.equal(tokenObject.merchant.bin, '000001');
        });
        it('It should return TokenModel instance merchant terminalID', function () {
            assert.equal(tokenObject.merchant.terminalID, '001');
        });
        it('It should return TokenModel instance order orderID ', function () {
            assert.equal(tokenObject.order.orderID, '12345');
        });
        it('It should return TokenModel instance paymentInstrument card ccAccountNum', function () {
            assert.equal(tokenObject.paymentInstrument.card.ccAccountNum, '5454545454545454');
        });
        it('It should return TokenModel instance paymentInstrument card ccExp', function () {
            assert.equal(tokenObject.paymentInstrument.card.ccExp, '202506');
        });
        it('It should return TokenModel instance token actionCode', function () {
            assert.equal(tokenObject.token.actionCode, 'TK');
        });
    });
});
