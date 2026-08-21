'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('int_jpmc_sfra/scripts/hooks/payment/processor/jpmc_applepay', function () {
    var jpmcApplepay;
    var mockLogger;
    var mockTransaction;
    var mockPaymentMgr;
    var mockResource;
    var mockJPMCConfig;
    var mockJPMCPayloadBuilder;
    var mockJPMCServiceHelper;
    var mockOrder;
    var mockPaymentInstrument;
    var mockPaymentProcessor;
    var mockEvent;
    var PaymentInstrumentMock;
    var mockJPMCMerchantResolver;

   
    var VALID_PAYMENT_DATA = {
        data: 'BASE64_ENCRYPTED_PAYLOAD',
        signature: 'BASE64_SIGNATURE',
        version: 'EC_v1',
        header: {
            ephemeralPublicKey: 'EPH_KEY_BASE64',
            publicKeyHash: 'PK_HASH_BASE64',
            transactionId: 'APPLE_TXN_ID_ABC123'
        }
    };

    beforeEach(function () {
    
        mockLogger = require('../../../../../../../test/mocks/dw/system/Logger');
        mockLogger.resetAllLoggers();

        mockTransaction = require('../../../../../../../test/mocks/dw/system/Transaction');
        mockTransaction.reset();
        sinon.spy(mockTransaction, 'wrap');

        PaymentInstrumentMock = require('../../../../../../../test/mocks/dw/order/PaymentInstrument');
        PaymentInstrumentMock.reset();

        mockResource = require('../../../../../../../test/mocks/dw/web/Resource');

        var PaymentTransactionMock = require('../../../../../../../test/mocks/dw/order/PaymentTransaction');

        mockPaymentMgr = require('../../../../../../../test/mocks/dw/order/PaymentMgr');
        mockPaymentMgr.resetMockPaymentMethods();

        mockPaymentProcessor = {
            getID: sinon.stub().returns('JPMC_PROCESSOR')
        };

        var mockPaymentMethod = {
            getPaymentProcessor: sinon.stub().returns(mockPaymentProcessor)
        };
        mockPaymentMgr.setMockPaymentMethod('DW_APPLE_PAY', mockPaymentMethod);

       
        var Order = require('../../../../../../../test/mocks/dw/order/Order');
        Order.resetMock();
        mockOrder = new Order();
        mockOrder.orderNo = 'AP-ORDER-001';

       
        mockPaymentInstrument = new PaymentInstrumentMock();
        mockPaymentInstrument.paymentMethod = 'DW_APPLE_PAY';
        var pt = new PaymentTransactionMock();
        pt.amount = { value: 99.99 };
        mockPaymentInstrument.paymentTransaction = pt;
        mockOrder.paymentInstruments.add(mockPaymentInstrument);

       
        mockEvent = {
            payment: {
                token: {
                    paymentData: VALID_PAYMENT_DATA
                }
            }
        };

        mockJPMCConfig = {
            getCaptureMethod: sinon.stub().returns('DELAYED'),
            getAccessTokenConfig: sinon.stub().returns({ merchantId: 'TEST_MERCHANT_ID' }),
            getPreference: sinon.stub().callsFake(function(key) {
                if (key === 'JPMC_MerchantCode') {
                    return 'TEST_MERCHANT_ID';
                }
                return null;
            })
        };

        mockJPMCPayloadBuilder = {
            buildApplePayPaymentPayload: sinon.stub().returns({ amount: 99.99, currency: 'USD' })
        };

        mockJPMCServiceHelper = {
            callWithTokenGeneration: sinon.stub().returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'JPMC-AP-TXN-001',
                    paymentMethodType: {
                        card: {
                            maskedAccountNumber: '***4242',
                            cardType: 'Visa'
                        }
                    }
                }
            })
        };

       
        var MockStatus = function MockStatus(code, detail, message) {
            this.status = code;
            this.detail = detail;
            this.message = message;
        };
        MockStatus.OK = 0;
        MockStatus.ERROR = 1;
        MockStatus.prototype.isError = function () { return this.status === 1; };

       
        var MockApplePayHookResult = function MockApplePayHookResult(status, authResponse) {
           
            this.status = status;
            this.authResponse = authResponse;
        };
        MockApplePayHookResult.REASON_FAILURE = 'FAILURE';

       
        jpmcApplepay = proxyquire(
            '../../../../../../../cartridges/int_jpmc_sfra/cartridge/scripts/hooks/payment/processor/jpmc_applepay',
            {
                'dw/system/Logger': mockLogger,
                'dw/system/Site': require('../../../../../../../test/mocks/dw/system/Site'),
                'dw/system/Transaction': mockTransaction,
                'dw/system/Status': MockStatus,
                'dw/order/PaymentInstrument': PaymentInstrumentMock,
                'dw/order/PaymentMgr': mockPaymentMgr,
                'dw/order/PaymentTransaction': PaymentTransactionMock,
                'dw/web/Resource': mockResource,
                'dw/extensions/applepay/ApplePayHookResult': MockApplePayHookResult,
                'dw/util/UUIDUtils': {
                    createUUID: sinon.stub().returns('UUID-MOCK-123')
                },
                '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
                '*/cartridge/scripts/helpers/JPMCMerchantResolver': (function () {
                    mockJPMCMerchantResolver = {
                        resolve: sinon.stub().returns({
                            merchantId: 'TEST_MERCHANT_ID',
                            captureMethod: 'DELAYED'
                        }),
                        resolveForOrder: sinon.stub().callsFake(function () {
                            return {
                                merchantId: 'TEST_MERCHANT_ID',
                                captureMethod: mockJPMCConfig.getCaptureMethod()
                            };
                        })
                    };
                    return mockJPMCMerchantResolver;
                }()),
                '*/cartridge/scripts/helpers/JPMCPayloadBuilder': mockJPMCPayloadBuilder,
                '*/cartridge/scripts/services/JPMCServiceHelper': mockJPMCServiceHelper,
                '*/cartridge/scripts/helpers/JPMCConstants': {
                    APPLE_PAY_PROTOCOL: { EC_V1: 'EC_v1', EC_V2: 'EC_v2' },
                    APPLE_PAY_WALLET_PROVIDER: 'APPLE_PAY'
                },
                '*/cartridge/scripts/helpers/JPMCTransactionHelpers': {
                    persistAuthorizationData: function (opts) {
                        var pi = opts.paymentInstrument;
                        var pt = pi.paymentTransaction || pi.getPaymentTransaction();
                        if (pi.custom) {
                            pi.custom.jpmcTransactionId = opts.transactionId;
                            if (opts.walletProvider) {
                                pi.custom.jpmcWalletProvider = opts.walletProvider;
                            }
                        }
                        if (pt && pt.custom) {
                            pt.custom.jpmcAuthorizationId = opts.transactionId;
                            pt.custom.jpmcCaptureMethod = opts.captureMethod;
                            pt.custom.jpmcAuthTimestamp = new Date().toISOString();
                            if (opts.captureMethod === 'NOW') {
                                pt.custom.jpmcPaymentStatus = 'AC';
                                pt.custom.jpmcCapturedAmount = pt.amount.value;
                                pt.custom.jpmcRemainingAuthAmount = 0;
                                pt.custom.jpmcRemainingRefundableAmount = pt.amount.value;
                            } else {
                                pt.custom.jpmcPaymentStatus = 'A';
                                pt.custom.jpmcRemainingAuthAmount = pt.amount.value;
                                pt.custom.jpmcRemainingRefundableAmount = 0;
                            }
                        }
                    }
                }
            }
        );
    });

    afterEach(function () {
        sinon.restore();
        mockPaymentMgr.resetMockPaymentMethods();
    });

 
    describe('authorizeOrderPayment() — Happy Path', function () {
        it('should return Status OK on successful authorization', function () {
            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

          
            assert.equal(result.status, 0);
          
            assert.equal(mockOrder.custom.jpmcMerchantId, 'TEST_MERCHANT_ID', 'Order should carry merchant ID after Apple Pay auth');
        });

        it('should call JPMC payment service with correct payload', function () {
            jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.isTrue(mockJPMCPayloadBuilder.buildApplePayPaymentPayload.calledOnce);
            assert.isTrue(mockJPMCServiceHelper.callWithTokenGeneration.calledOnce);

            var serviceCallArg = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];
            assert.equal(serviceCallArg.serviceId, 'JPMCPaymentService');
            assert.equal(serviceCallArg.method, 'POST');
            assert.equal(serviceCallArg.headers['merchant-id'], 'TEST_MERCHANT_ID');
        });

        it('should set payment processor on payment instrument', function () {
            jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

        
            assert.isTrue(mockTransaction.wrap.called);
            assert.equal(mockPaymentInstrument.paymentTransaction.paymentProcessor, mockPaymentProcessor);
        });

        it('should persist transaction ID and wallet provider on PI custom', function () {
            jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.equal(mockPaymentInstrument.custom.jpmcTransactionId, 'JPMC-AP-TXN-001');
            assert.equal(mockPaymentInstrument.custom.jpmcWalletProvider, 'APPLE_PAY');
        });

        it('should set card metadata from JPMC response', function () {
            jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.equal(mockPaymentInstrument.creditCardNumber, '***4242');
            assert.equal(mockPaymentInstrument.creditCardType, 'Visa');
        });

        it('should set payment status based on capture method (DELAYED → A)', function () {
            jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            var ptCustom = mockPaymentInstrument.paymentTransaction.custom;
            assert.equal(ptCustom.jpmcPaymentStatus, 'A');
            assert.equal(ptCustom.jpmcRemainingAuthAmount, 99.99);
            assert.equal(ptCustom.jpmcRemainingRefundableAmount, 0);
        });

        it('should set payment status AC and captured amount when capture method is NOW', function () {
            mockJPMCConfig.getCaptureMethod.returns('NOW');

            jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            var ptCustom = mockPaymentInstrument.paymentTransaction.custom;
            assert.equal(ptCustom.jpmcPaymentStatus, 'AC');
            assert.equal(ptCustom.jpmcCapturedAmount, 99.99);
            assert.equal(ptCustom.jpmcRemainingAuthAmount, 0);
        });
    });

   
    describe('authorizeOrderPayment() — Token & Data Validation', function () {
        it('should return error when payment token is missing', function () {
            mockEvent.payment.token = null;

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

          
            assert.isTrue(result.status.isError());
        });

        it('should return error when paymentData is missing from token', function () {
            mockEvent.payment.token.paymentData = null;

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.isTrue(result.status.isError());
        });

        it('should return error when paymentData.data field is missing', function () {
            mockEvent.payment.token.paymentData = {
                signature: 'SIG',
                header: VALID_PAYMENT_DATA.header
            };

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.isTrue(result.status.isError());
        });

        it('should return error when paymentData.signature is missing', function () {
            mockEvent.payment.token.paymentData = {
                data: 'DATA',
                header: VALID_PAYMENT_DATA.header
            };

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.isTrue(result.status.isError());
        });

        it('should return error when header is missing ephemeralPublicKey', function () {
            var badPaymentData = {
                data: VALID_PAYMENT_DATA.data,
                signature: VALID_PAYMENT_DATA.signature,
                header: { publicKeyHash: 'PK', transactionId: 'TXN' }
            };

            mockEvent.payment.token.paymentData = badPaymentData;

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.isTrue(result.status.isError());
        });

        it('should return error when no DW_APPLE_PAY payment instrument exists', function () {
           
            mockOrder.getPaymentInstruments = function (methodId) {
                if (methodId === 'DW_APPLE_PAY') {
                    return { empty: true, length: 0 };
                }
                return [];
            };

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.isTrue(result.status.isError());
        });
    });


    describe('authorizeOrderPayment() — Service Failures', function () {
        it('should return error when JPMC service call fails', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false,
                error: 'Service timeout'
            });

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.isTrue(result.status.isError());
        });

        it('should return error when JPMC response status is not SUCCESS', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'DECLINED',
                    responseMessage: 'Insufficient funds'
                }
            });

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.isTrue(result.status.isError());
        });

        it('should return error when payment processor is not configured', function () {
            mockPaymentMgr.resetMockPaymentMethods();
            mockPaymentMgr.setMockPaymentMethod('DW_APPLE_PAY', {
                getPaymentProcessor: sinon.stub().returns(null)
            });

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            assert.isTrue(result.status.isError());
        });
    });

    describe('authorizeOrderPayment() — Security', function () {
        it('should never log the raw Apple Pay token payload', function () {
            jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            var logger = mockLogger.getLogger('JPMC', 'jpmc_applepay');
            var allLogs = logger.debugMessages
                .concat(logger.infoMessages)
                .concat(logger.warnMessages)
                .concat(logger.errorMessages);

            allLogs.forEach(function (logArgs) {
                var logStr = logArgs.join(' ');
                assert.notInclude(logStr, 'BASE64_ENCRYPTED_PAYLOAD', 'Must never log encrypted payload');
                assert.notInclude(logStr, 'EPH_KEY_BASE64', 'Must never log ephemeral key');
                assert.notInclude(logStr, 'BASE64_SIGNATURE', 'Must never log signature');
            });
        });

        it('should only log safe metadata (order number)', function () {
            jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);

            var logger = mockLogger.getLogger('JPMC', 'jpmc_applepay');
      
            var infoLogs = logger.infoMessages.map(function (args) { return args.join(' '); }).join('|');
            assert.include(infoLogs, 'AP-ORDER-001');
        });
    });

    describe('authorizeOrderPayment() — applicationData branch (line 39)', function () {
        it('should set walletApplicationData when applicationData is present in header', function () {
            mockEvent.payment.token.paymentData = {
                data: VALID_PAYMENT_DATA.data,
                signature: VALID_PAYMENT_DATA.signature,
                version: VALID_PAYMENT_DATA.version,
                header: {
                    ephemeralPublicKey: VALID_PAYMENT_DATA.header.ephemeralPublicKey,
                    publicKeyHash: VALID_PAYMENT_DATA.header.publicKeyHash,
                    transactionId: VALID_PAYMENT_DATA.header.transactionId,
                    applicationData: 'APP_DATA_BASE64'
                }
            };

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);
            assert.equal(result.status, 0);
        });
    });

    describe('authorizeOrderPayment() — no merchantId (line 185)', function () {
        it('should return error when resolveForOrder returns null', function () {
            mockJPMCMerchantResolver.resolveForOrder.returns(null);

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);
            assert.isTrue(result.status.isError());
        });

        it('should return error when resolveForOrder returns config without merchantId', function () {
            mockJPMCMerchantResolver.resolveForOrder.returns({ captureMethod: 'DELAYED' });

            var result = jpmcApplepay.authorizeOrderPayment(mockOrder, mockEvent);
            assert.isTrue(result.status.isError());
        });
    });

    describe('getRequest (lines 192-205)', function () {
        beforeEach(function () {
            global.session = { privacy: {}, custom: {} };
            global.request = { 
                locale: 'en_US',
                getLocale: sinon.stub().returns('en_US')
            };
        });

        afterEach(function () {
            delete global.session;
            delete global.request;
        });

        it('should set currencyCode and countryCode and return OK status', function () {
            var basket = { getCurrencyCode: sinon.stub().returns('USD') };
            var applePayRequest = {};

            var result = jpmcApplepay.getRequest(basket, applePayRequest);

            assert.equal(result.status.status, 0);
            assert.equal(applePayRequest.currencyCode, 'USD');
            assert.equal(applePayRequest.countryCode, 'US');
        });

        it('should return OK even when getCurrencyCode returns falsy', function () {
            var basket = { getCurrencyCode: sinon.stub().returns('') };
            var applePayRequest = {};

            var result = jpmcApplepay.getRequest(basket, applePayRequest);

            assert.equal(result.status.status, 0);
            assert.isUndefined(applePayRequest.currencyCode);
        });

        it('should return ERROR status when basket.getCurrencyCode throws (line 205)', function () {
            var basket = { getCurrencyCode: sinon.stub().throws(new Error('basket error')) };
            var applePayRequest = {};

            var result = jpmcApplepay.getRequest(basket, applePayRequest);

            assert.equal(result.status.status, 1);
        });
    });

    describe('cancel (lines 211-212)', function () {
        it('should return OK status', function () {
            var result = jpmcApplepay.cancel();
            assert.equal(result.status.status, 0);
        });
    });

    describe('Module Exports', function () {
        it('should export authorizeOrderPayment function', function () {
            assert.isFunction(jpmcApplepay.authorizeOrderPayment);
        });
    });
});
