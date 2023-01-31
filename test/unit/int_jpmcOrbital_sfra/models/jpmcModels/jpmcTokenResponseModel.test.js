'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfTokenResponseModel = [
    'version',
    'merchant',
    'order',
    'paymentInstrument',
    'token'
];

var proxyquireStubs = {
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

describe('TokenResponseModel unit test', function () {
    const TokenResponseModelPath = '../../../../mocks/jpmcModelsMocks/jpmcTokenResponseModelMock.test.js';
    const TokenResponseModel = proxyquire(TokenResponseModelPath, {
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks
    });
    describe('TokenResponseModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            token: {
                actionCode: 'TK'
            },
            paymentInstrument: {
                card: {
                    ccAccountNum: '5454548196285454',
                    cardBrand: 'MC'
                }
            },
            order: {
                status: {
                    procStatusMessage: 'No reason to decline',
                    procStatus: '0',
                    hostRespCode: '104'
                },
                orderID: '123456'
            },
            merchant: {
                bin: '000001'
            }
        };

        let tokenObject = new TokenResponseModel(object);
        it('It should return TokenResponseModel instance as typeof object', function () {
            assert.typeOf(tokenObject, 'object');
            assert.instanceOf(tokenObject, TokenResponseModel);
        });
        it('It should return TokenResponseModel instance with keys', function () {
            assert.hasAllKeys(tokenObject, allKeysOfTokenResponseModel);
        });
        it('It should return TokenResponseModel instance version', function () {
            assert.equal(tokenObject.version, object.version);
        });
        it('It should return TokenResponseModel instance merchant', function () {
            assert.equal(tokenObject.merchant, object.merchant);
        });
        it('It should return TokenResponseModel instance order', function () {
            assert.equal(tokenObject.order, object.order);
        });
        it('It should return TokenResponseModel instance paymentInstrument', function () {
            assert.equal(tokenObject.paymentInstrument, object.paymentInstrument);
        });
        it('It should return TokenResponseModel instance token', function () {
            assert.equal(tokenObject.token, object.token);
        });
    });
    describe('setTokenResponseObject method unit test', function () {
        let responseObject = {
            version: '4.5',
            token: {
                actionCode: 'TK'
            },
            paymentInstrument: {
                card: {
                    ccAccountNum: '5454548196285454',
                    cardBrand: 'MC'
                }
            },
            order: {
                status: {
                    procStatusMessage: 'No reason to decline',
                    procStatus: '0',
                    hostRespCode: '104'
                },
                orderID: '123456'
            },
            merchant: {
                bin: '000001'
            }
        };
        let tokenObject = TokenResponseModel.setTokenResponseObject(responseObject);
        it('It should return TokenResponseModel instance as typeof object', function () {
            assert.typeOf(tokenObject, 'object');
            assert.instanceOf(tokenObject, TokenResponseModel);
        });
        it('It should return TokenResponseModel instance version', function () {
            assert.equal(tokenObject.version, '4.5');
        });
        it('It should return TokenResponseModel instance merchant bin', function () {
            assert.equal(tokenObject.merchant.bin, '000001');
        });
        it('It should return TokenResponseModel instance order status procStatusMessage ', function () {
            assert.equal(tokenObject.order.status.procStatusMessage, 'No reason to decline');
        });
        it('It should return TokenResponseModel instance order status procStatus ', function () {
            assert.equal(tokenObject.order.status.procStatus, '0');
        });
        it('It should return TokenResponseModel instance order status hostRespCode ', function () {
            assert.equal(tokenObject.order.status.hostRespCode, '104');
        });
        it('It should return TokenResponseModel instance order orderID', function () {
            assert.equal(tokenObject.order.orderID, '123456');
        });
        it('It should return TokenResponseModel instance paymentInstrument card ccAccountNum', function () {
            assert.equal(tokenObject.paymentInstrument.card.ccAccountNum, '5454548196285454');
        });
        it('It should return TokenResponseModel instance paymentInstrument card cardBrand', function () {
            assert.equal(tokenObject.paymentInstrument.card.cardBrand, 'MC');
        });

        it('It should return TokenResponseModel instance token actionCode', function () {
            assert.equal(tokenObject.token.actionCode, 'TK');
        });
    });
});
