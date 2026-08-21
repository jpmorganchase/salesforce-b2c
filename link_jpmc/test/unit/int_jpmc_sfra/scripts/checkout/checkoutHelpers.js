'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('int_jpmc_sfra/scripts/checkout/checkoutHelpers', function () {
    var checkoutHelpers;
    var mockLogger;
    var mockTransaction;
    var mockPaymentInstrument;
    var mockCustomer;
    var mockProfile;
    var mockWallet;
    var mockStoredPaymentInstrument;
    var mockBasket;
    var billingData;

    beforeEach(function () {
        mockLogger = require('../../../../../test/mocks/dw/system/Logger');
        mockLogger.resetAllLoggers();

       
        mockTransaction = require('../../../../../test/mocks/dw/system/Transaction');
        mockTransaction.reset();
        sinon.spy(mockTransaction, 'wrap');

     
        global.session = {
            privacy: {
                jpmcCardSafeTechToken: 'SAFETECH-TOKEN-12345'
            }
        };

        
        var PaymentInstrumentMock = require('../../../../../test/mocks/dw/order/PaymentInstrument');
        mockStoredPaymentInstrument = new PaymentInstrumentMock();

       
        mockWallet = {
            createPaymentInstrument: sinon.stub().returns(mockStoredPaymentInstrument)
        };

       
        mockProfile = {
            getWallet: sinon.stub().returns(mockWallet)
        };

  
        mockCustomer = {
            getProfile: sinon.stub().returns(mockProfile)
        };

    
        var Order = require('../../../../../test/mocks/dw/order/Order');
        mockBasket = new Order();
        
        var OrderAddress = require('../../../../../test/mocks/dw/order/OrderAddress');
        mockBasket.billingAddress = new OrderAddress();

       
        billingData = {
            paymentInformation: {
                cardNumber: { value: '************1111' },
                cardType: { value: 'Visa' },
                expirationMonth: { value: 12 },
                expirationYear: { value: 2028 }
            }
        };

       
        var baseMock = {
            someOtherMethod: function () {
                return 'base method';
            }
        };

       
        checkoutHelpers = proxyquire('../../../../../cartridges/int_jpmc_sfra/cartridge/scripts/checkout/checkoutHelpers', {
            'dw/system/Transaction': mockTransaction,
            'dw/order/PaymentInstrument': require('../../../../../test/mocks/dw/order/PaymentInstrument'),
            '*/cartridge/scripts/checkout/checkoutHelpers': baseMock,
            '*/cartridge/scripts/helpers/JPMCConfig': {
                isAccountUpdaterRTAUEnabled: function () { return false; }
            },
            '*/cartridge/scripts/helpers/JPMCMerchantResolver': {
                resolve: sinon.stub().returns({ merchantId: 'TEST_MERCHANT_ID' }),
                resolveForOrder: sinon.stub().returns({ merchantId: 'TEST_MERCHANT_ID' }),
                toAccessTokenConfig: sinon.stub().returns({}),
                invalidateCache: sinon.stub()
            }
        });
    });

    afterEach(function () {
        sinon.restore();
        delete global.session;
    });


    describe('savePaymentInstrumentToWallet()', function () {
        it('should create payment instrument in customer wallet', function () {
            var result = checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.isTrue(mockCustomer.getProfile.calledOnce);
            assert.isTrue(mockProfile.getWallet.calledOnce);
            assert.isTrue(mockWallet.createPaymentInstrument.calledOnce);
            
    
            var createArgs = mockWallet.createPaymentInstrument.firstCall.args;
            assert.equal(createArgs[0], 'CREDIT_CARD');
        });

        it('should wrap payment instrument creation in Transaction', function () {
            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.isTrue(mockTransaction.wrap.calledOnce);
        });

        it('should set credit card number from billing data', function () {
            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardNumber, '************1111');
        });

        it('should set credit card type from billing data', function () {
            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardType, 'Visa');
        });

        it('should set expiration month from billing data', function () {
            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardExpirationMonth, 12);
        });

        it('should set expiration year from billing data', function () {
            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardExpirationYear, 2028);
        });

        it('should set credit card token from session privacy', function () {
            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardToken, 'SAFETECH-TOKEN-12345');
        });

        it('should delete SAFETECH token from session after saving', function () {
            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.isUndefined(global.session.privacy.jpmcCardSafeTechToken);
        });

        it('should return the stored payment instrument', function () {
            var result = checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(result, mockStoredPaymentInstrument);
            assert.equal(result.creditCardToken, 'SAFETECH-TOKEN-12345');
        });

        it('should handle MasterCard card type', function () {
            billingData.paymentInformation.cardType.value = 'MasterCard';

            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardType, 'MasterCard');
        });

        it('should handle American Express card type', function () {
            billingData.paymentInformation.cardType.value = 'Amex';

            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardType, 'Amex');
        });

        it('should handle Discover card type', function () {
            billingData.paymentInformation.cardType.value = 'Discover';

            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardType, 'Discover');
        });

        it('should handle masked card numbers with different lengths', function () {
            billingData.paymentInformation.cardNumber.value = '**********4242';

            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardNumber, '**********4242');
        });

        it('should handle far future expiration dates', function () {
            billingData.paymentInformation.expirationMonth.value = 6;
            billingData.paymentInformation.expirationYear.value = 2035;

            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardExpirationMonth, 6);
            assert.equal(mockStoredPaymentInstrument.creditCardExpirationYear, 2035);
        });

        it('should handle January expiration month', function () {
            billingData.paymentInformation.expirationMonth.value = 1;

            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardExpirationMonth, 1);
        });

        it('should handle December expiration month', function () {
            billingData.paymentInformation.expirationMonth.value = 12;

            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardExpirationMonth, 12);
        });

        it('should handle missing SAFETECH token in session', function () {
            delete global.session.privacy.jpmcCardSafeTechToken;

            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

          
            assert.isUndefined(mockStoredPaymentInstrument.creditCardToken);
        });

        it('should handle null SAFETECH token in session', function () {
            global.session.privacy.jpmcCardSafeTechToken = null;

            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.isNull(mockStoredPaymentInstrument.creditCardToken);
        });

        it('should handle empty string SAFETECH token', function () {
            global.session.privacy.jpmcCardSafeTechToken = '';

            checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );

            assert.equal(mockStoredPaymentInstrument.creditCardToken, '');
        });
    });

    

    describe('Module Structure', function () {
        it('should export savePaymentInstrumentToWallet function', function () {
            assert.isFunction(checkoutHelpers.savePaymentInstrumentToWallet);
        });

        it('should extend base checkout helpers', function () {
          
            assert.isFunction(checkoutHelpers.someOtherMethod);
            assert.equal(checkoutHelpers.someOtherMethod(), 'base method');
        });

        it('should override savePaymentInstrumentToWallet from base module', function () {
           
            assert.isFunction(checkoutHelpers.savePaymentInstrumentToWallet);
            
            var result = checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                mockCustomer
            );
            
            assert.isDefined(result);
        });
    });

  

    describe('Integration Scenarios', function () {
        it('should successfully save complete payment information', function () {
            var fullBillingData = {
                paymentInformation: {
                    cardNumber: { value: '************5454' },
                    cardType: { value: 'Visa' },
                    expirationMonth: { value: 3 },
                    expirationYear: { value: 2030 }
                }
            };

            global.session.privacy.jpmcCardSafeTechToken = 'SAFETECH-FULL-TOKEN';

            var result = checkoutHelpers.savePaymentInstrumentToWallet(
                fullBillingData,
                mockBasket,
                mockCustomer
            );

          
            assert.equal(result.creditCardNumber, '************5454');
            assert.equal(result.creditCardType, 'Visa');
            assert.equal(result.creditCardExpirationMonth, 3);
            assert.equal(result.creditCardExpirationYear, 2030);
            assert.equal(result.creditCardToken, 'SAFETECH-FULL-TOKEN');
            
     
            assert.isUndefined(global.session.privacy.jpmcCardSafeTechToken);
        });

        it('should handle wallet creation for new customer', function () {
          
            var newCustomer = {
                getProfile: sinon.stub().returns(mockProfile)
            };

            var result = checkoutHelpers.savePaymentInstrumentToWallet(
                billingData,
                mockBasket,
                newCustomer
            );

            assert.isTrue(newCustomer.getProfile.calledOnce);
            assert.isDefined(result);
        });

        it('should handle multiple card types in succession', function () {
            var cardTypes = ['Visa', 'MasterCard', 'Amex', 'Discover'];

            cardTypes.forEach(function (cardType) {
                billingData.paymentInformation.cardType.value = cardType;
                
                var result = checkoutHelpers.savePaymentInstrumentToWallet(
                    billingData,
                    mockBasket,
                    mockCustomer
                );

                assert.equal(result.creditCardType, cardType);
            });
        });
    });

    describe('handlePayments()', function () {
        var mockOrderMgr;
        var mockPaymentMgr;
        var mockHookMgr;
        var mockResource;
        var mockLoggerWithInfo;

        function loadHandlePaymentsModule() {
            return proxyquire('../../../../../cartridges/int_jpmc_sfra/cartridge/scripts/checkout/checkoutHelpers', {
                'dw/system/Transaction': mockTransaction,
                'dw/order/OrderMgr': mockOrderMgr,
                'dw/order/PaymentMgr': mockPaymentMgr,
                'dw/system/HookMgr': mockHookMgr,
                'dw/web/Resource': mockResource,
                'dw/system/Logger': mockLoggerWithInfo,
                '*/cartridge/scripts/checkout/checkoutHelpers': {}
            });
        }

        beforeEach(function () {
            var PaymentTransaction = require('../../../../../test/mocks/dw/order/PaymentTransaction');

            mockOrderMgr = require('../../../../../test/mocks/dw/order/OrderMgr');
            mockOrderMgr.resetMock();
            sinon.spy(mockOrderMgr, 'failOrder');

            mockPaymentMgr = require('../../../../../test/mocks/dw/order/PaymentMgr');
            mockPaymentMgr.resetMockPaymentMethods();

            mockHookMgr = require('../../../../../test/mocks/dw/system/HookMgr');
            mockHookMgr.resetMock();

            mockResource = require('../../../../../test/mocks/dw/web/Resource');

            mockLoggerWithInfo = {
                info: sinon.spy(),
                getLogger: mockLogger.getLogger,
                reset: mockLogger.reset,
                resetAllLoggers: mockLogger.resetAllLoggers
            };

            global.session = global.session || { privacy: {} };
            global.session.privacy = global.session.privacy || {};

            this.makeInstrument = function (paymentMethod) {
                return {
                    paymentMethod: paymentMethod || 'CREDIT_CARD',
                    paymentTransaction: new PaymentTransaction()
                };
            };
        });

        it('should return empty result when order total net price is zero', function () {
            checkoutHelpers = loadHandlePaymentsModule();

            var order = {
                totalNetPrice: 0,
                paymentInstruments: []
            };

            var result = checkoutHelpers.handlePayments(order, 'ORD-1');
            assert.deepEqual(result, {});
        });

        it('should fail order when no payment instruments are present', function () {
            checkoutHelpers = loadHandlePaymentsModule();

            var order = {
                totalNetPrice: 10,
                paymentInstruments: [],
                custom: {}
            };

            var result = checkoutHelpers.handlePayments(order, 'ORD-2');

            assert.isTrue(result.error);
            assert.isTrue(mockOrderMgr.failOrder.calledOnce);
        });

        it('should set transaction id when payment processor is null', function () {
            checkoutHelpers = loadHandlePaymentsModule();
            var instrument = this.makeInstrument('CREDIT_CARD');

            mockPaymentMgr.setMockPaymentMethod('CREDIT_CARD', {
                paymentProcessor: null
            });

            var order = {
                totalNetPrice: 10,
                paymentInstruments: [instrument]
            };

            var result = checkoutHelpers.handlePayments(order, 'ORDER-TXN-ID');

            assert.isUndefined(result.error);
            assert.equal(instrument.paymentTransaction.transactionID, 'ORDER-TXN-ID');
        });

        it('should use default authorize hook when processor-specific hook does not exist', function () {
            checkoutHelpers = loadHandlePaymentsModule();
            var instrument = this.makeInstrument('CREDIT_CARD');

            mockPaymentMgr.setMockPaymentMethod('CREDIT_CARD', {
                paymentProcessor: { ID: 'JPMC_PAYMENT' }
            });
            mockHookMgr._setHookResult('app.payment.processor.default', 'Authorize', { error: false });

            var result = checkoutHelpers.handlePayments({
                totalNetPrice: 10,
                paymentInstruments: [instrument]
            }, 'ORD-3');

            assert.isUndefined(result.error);
        });

        it('should fail order when authorization returns error', function () {
            checkoutHelpers = loadHandlePaymentsModule();
            var instrument = this.makeInstrument('CREDIT_CARD');

            mockPaymentMgr.setMockPaymentMethod('CREDIT_CARD', {
                paymentProcessor: { ID: 'JPMC_PAYMENT' }
            });
            mockHookMgr._registerHook('app.payment.processor.jpmc_payment');
            mockHookMgr._setHookResult('app.payment.processor.jpmc_payment', 'Authorize', { error: true });

            var order = {
                totalNetPrice: 10,
                paymentInstruments: [instrument],
                custom: {}
            };

            var result = checkoutHelpers.handlePayments(order, 'ORD-4');

            assert.isTrue(result.error);
            assert.isTrue(mockOrderMgr.failOrder.calledOnce);
        });

        it('should return 3DS orchestration payload and persist url in session', function () {
            checkoutHelpers = loadHandlePaymentsModule();
            var instrument = this.makeInstrument('CREDIT_CARD');

            mockPaymentMgr.setMockPaymentMethod('CREDIT_CARD', {
                paymentProcessor: { ID: 'JPMC_PAYMENT' }
            });
            mockHookMgr._registerHook('app.payment.processor.jpmc_payment');
            mockHookMgr._setHookResult('app.payment.processor.jpmc_payment', 'Authorize', {
                error: false,
                requires3DS: true,
                authenticationOrchestrationUrl: 'https://example.com/3ds',
                transactionId: 'txn-3ds-1',
                captureMethod: 'NOW'
            });

            var result = checkoutHelpers.handlePayments({
                totalNetPrice: 10,
                paymentInstruments: [instrument]
            }, 'ORD-5');

            assert.isTrue(result.requires3DS);
            assert.equal(result.authenticationOrchestrationUrl, 'https://example.com/3ds');
            assert.equal(result.transactionId, 'txn-3ds-1');
            assert.equal(result.captureMethod, 'NOW');
            assert.equal(global.session.privacy.jpmc3DSOrchestrationUrl, 'https://example.com/3ds');
        });
    });
});
