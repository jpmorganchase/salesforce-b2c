'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('int_jpmc_sfra/scripts/hooks/payment/processor/jpmc_googlepay', function () {
    var jpmcGooglepay;
    var mockLogger;
    var mockTransaction;
    var mockPaymentMgr;
    var mockResource;
    var collectionsModule;
    var jpmcConstantsModule;
    var mockJPMCTransactionHelpers;
    var mockBasket;
    var mockReq;
    var PaymentInstrumentMock;

    /** Valid ECv2 Google Pay token structure */
    var VALID_GPAY_TOKEN = JSON.stringify({
        signedMessage: 'BASE64_SIGNED_MESSAGE',
        protocolVersion: 'ECv2',
        intermediateSigningKey: {
            signedKey: 'BASE64_SIGNED_KEY',
            signatures: ['SIG_1_BASE64']
        }
    });

    
    var VALID_GPAY_TOKEN_V1 = JSON.stringify({
        signedMessage: 'BASE64_SIGNED_MESSAGE',
        protocolVersion: 'ECv1',
        signature: 'SIG_BASE64'
    });

    beforeEach(function () {
        // Reset mocks
        mockLogger = require('../../../../../../../test/mocks/dw/system/Logger');
        mockLogger.resetAllLoggers();

        mockTransaction = require('../../../../../../../test/mocks/dw/system/Transaction');
        mockTransaction.reset();
        sinon.spy(mockTransaction, 'wrap');

        PaymentInstrumentMock = require('../../../../../../../test/mocks/dw/order/PaymentInstrument');
        PaymentInstrumentMock.reset();

        mockResource = require('../../../../../../../test/mocks/dw/web/Resource');

        mockPaymentMgr = require('../../../../../../../test/mocks/dw/order/PaymentMgr');
        mockPaymentMgr.resetMockPaymentMethods();

        var gpayMethod = {
            isActive: sinon.stub().returns(true)
        };
        mockPaymentMgr.setMockPaymentMethod('JPMC_GOOGLE_PAY', gpayMethod);

        
        global.session = {
            privacy: {
                jpmcGooglePayToken: VALID_GPAY_TOKEN
            }
        };

  
        var Order = require('../../../../../../../test/mocks/dw/order/Order');
        Order.resetMock();
        mockBasket = new Order();

        mockReq = {
            form: {},
            currentCustomer: { raw: { authenticated: false } }
        };

        collectionsModule = {
            forEach: function (collection, callback) {
                var arr = collection;
                if (typeof collection.toArray === 'function') {
                    arr = collection.toArray();
                }
                if (Array.isArray(arr)) {
                    arr.forEach(callback);
                }
            }
        };

        jpmcConstantsModule = {
            JPMC_GOOGLE_PAY: 'JPMC_GOOGLE_PAY',
            JPMC_Processor: 'JPMC_Processor',
            GOOGLE_PAY_WALLET_PROVIDER: 'GOOGLE_PAY'
        };

        mockJPMCTransactionHelpers = {
            authorizeGooglePay: sinon.stub().returns({
                error: false,
                transactionId: 'GPAY-TXN-001',
                captureMethod: 'DELAYED'
            })
        };


        jpmcGooglepay = proxyquire(
            '../../../../../../../cartridges/int_jpmc_sfra/cartridge/scripts/hooks/payment/processor/jpmc_googlepay',
            {
                'dw/system/Logger': mockLogger,
                'dw/system/Transaction': mockTransaction,
                'dw/order/PaymentMgr': mockPaymentMgr,
                'dw/web/Resource': mockResource,
                '*/cartridge/scripts/helpers/JPMCConstants': jpmcConstantsModule,
                '*/cartridge/scripts/util/collections': collectionsModule,
                '*/cartridge/scripts/helpers/JPMCTransactionHelpers': mockJPMCTransactionHelpers,
                '*/cartridge/scripts/helpers/JPMCMerchantResolver': {
                    resolve: sinon.stub().returns({ merchantId: 'TEST_MERCHANT_ID' })
                }
            }
        );
    });

    afterEach(function () {
        sinon.restore();
        delete global.session;
        mockPaymentMgr.resetMockPaymentMethods();
    });

    describe('processForm()', function () {
        it('should extract Google Pay token from session.privacy into viewData', function () {
            var result = jpmcGooglepay.processForm(mockReq, {}, {});

            assert.isFalse(result.error);
            assert.equal(result.viewData.paymentInformation.googlePayToken.value, VALID_GPAY_TOKEN);
            assert.equal(result.viewData.paymentMethod.value, 'JPMC_GOOGLE_PAY');
        });

        it('should return error when Google Pay token is missing from session', function () {
            global.session.privacy.jpmcGooglePayToken = null;

            var result = jpmcGooglepay.processForm(mockReq, {}, {});

            assert.isTrue(result.error);
            assert.isAbove(result.serverErrors.length, 0);
        });
    });


    describe('Handle() — Token Validation', function () {
        it('should accept a valid ECv2 token and create PI on basket', function () {
            var paymentInfo = { googlePayToken: { value: VALID_GPAY_TOKEN } };

            var result = jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            assert.isFalse(result.error);
            var instruments = mockBasket.getPaymentInstruments('JPMC_GOOGLE_PAY');
            assert.isAbove(instruments.length, 0);
        });

        it('should accept a valid ECv1 token (top-level signature)', function () {
            var paymentInfo = { googlePayToken: { value: VALID_GPAY_TOKEN_V1 } };

            var result = jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            assert.isFalse(result.error);
        });

        it('should reject when token is missing', function () {
            var paymentInfo = { googlePayToken: { value: null } };

            var result = jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            assert.isTrue(result.error);
        });

        it('should reject when token is malformed JSON', function () {
            var paymentInfo = { googlePayToken: { value: 'NOT_JSON{{' } };

            var result = jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            assert.isTrue(result.error);
        });

        it('should reject when signedMessage is missing', function () {
            var badToken = JSON.stringify({ protocolVersion: 'ECv2', signature: 'SIG' });
            var paymentInfo = { googlePayToken: { value: badToken } };

            var result = jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            assert.isTrue(result.error);
        });

        it('should reject when protocolVersion is missing', function () {
            var badToken = JSON.stringify({ signedMessage: 'MSG', signature: 'SIG' });
            var paymentInfo = { googlePayToken: { value: badToken } };

            var result = jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            assert.isTrue(result.error);
        });

        it('should reject when no signature is found (neither ECv1 nor ECv2 style)', function () {
            var badToken = JSON.stringify({ signedMessage: 'MSG', protocolVersion: 'ECv2' });
            var paymentInfo = { googlePayToken: { value: badToken } };

            var result = jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            assert.isTrue(result.error);
        });

        it('should reject when Google Pay payment method is inactive', function () {
            mockPaymentMgr.resetMockPaymentMethods();
            mockPaymentMgr.setMockPaymentMethod('JPMC_GOOGLE_PAY', {
                isActive: sinon.stub().returns(false)
            });

            var paymentInfo = { googlePayToken: { value: VALID_GPAY_TOKEN } };
            var result = jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            assert.isTrue(result.error);
        });
    });

    describe('Handle() — Token Lifecycle Security', function () {
        it('should NOT store Google Pay token on PI custom (session-only)', function () {
            var paymentInfo = { googlePayToken: { value: VALID_GPAY_TOKEN } };

            jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            var instruments = mockBasket.getPaymentInstruments('JPMC_GOOGLE_PAY');
            assert.isUndefined(instruments[0].custom.jpmcGooglePayToken,
                'Token must NOT be persisted on PI custom — stays in session.privacy');
        });

        it('should keep Google Pay token in session.privacy for authorizeGooglePay to consume', function () {
            var paymentInfo = { googlePayToken: { value: VALID_GPAY_TOKEN } };

            jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            assert.equal(global.session.privacy.jpmcGooglePayToken, VALID_GPAY_TOKEN,
                'Token must remain in session.privacy for Authorize to read');
        });

        it('should set wallet provider on PI custom', function () {
            var paymentInfo = { googlePayToken: { value: VALID_GPAY_TOKEN } };

            jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            var instruments = mockBasket.getPaymentInstruments('JPMC_GOOGLE_PAY');
            assert.equal(instruments[0].custom.jpmcWalletProvider, 'GOOGLE_PAY');
        });

        it('should stamp jpmcMerchantId on basket PI for multi-MID routing', function () {
            var paymentInfo = { googlePayToken: { value: VALID_GPAY_TOKEN } };

            jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            var instruments = mockBasket.getPaymentInstruments('JPMC_GOOGLE_PAY');
            assert.equal(instruments[0].custom.jpmcMerchantId, 'TEST_MERCHANT_ID');
        });

        it('should remove existing Google Pay and Credit Card PIs before creating new one', function () {
            // Pre-populate basket with an old GPAY instrument
            mockBasket.createPaymentInstrument('JPMC_GOOGLE_PAY', 50.00);
            mockBasket.createPaymentInstrument('CREDIT_CARD', 50.00);

            var paymentInfo = { googlePayToken: { value: VALID_GPAY_TOKEN } };
            jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            // Only one GPAY instrument should remain
            var gpayInstruments = mockBasket.getPaymentInstruments('JPMC_GOOGLE_PAY');
            assert.equal(gpayInstruments.length, 1);
        });
    });


    describe('Authorize()', function () {
        var mockProcessor;

        beforeEach(function () {
            mockProcessor = {
                getID: sinon.stub().returns({
                    equalsIgnoreCase: function (val) { return val === 'JPMC_Processor'; }
                })
            };
        });

        it('should return success for valid Google Pay authorization', function () {
            var pi = new PaymentInstrumentMock();
            pi.paymentMethod = 'JPMC_GOOGLE_PAY';

            var result = jpmcGooglepay.Authorize('ORDER-GP-001', pi, mockProcessor);

            assert.isFalse(result.error);
            assert.isTrue(mockJPMCTransactionHelpers.authorizeGooglePay.calledOnce);
        });

        it('should pass correct arguments to authorizeGooglePay', function () {
            var pi = new PaymentInstrumentMock();
            pi.paymentMethod = 'JPMC_GOOGLE_PAY';

            jpmcGooglepay.Authorize('ORDER-GP-002', pi, mockProcessor);

            var call = mockJPMCTransactionHelpers.authorizeGooglePay.firstCall;
            assert.equal(call.args[0], 'ORDER-GP-002');
            assert.equal(call.args[1], pi);
            assert.equal(call.args[2], mockProcessor);
        });

        it('should return error when processor is unsupported', function () {
            var badProcessor = {
                getID: sinon.stub().returns({
                    equalsIgnoreCase: function () { return false; }
                })
            };
            var pi = new PaymentInstrumentMock();

            var result = jpmcGooglepay.Authorize('ORDER-GP-003', pi, badProcessor);

            assert.isTrue(result.error);
        });

        it('should return error when processor is null', function () {
            var pi = new PaymentInstrumentMock();

            var result = jpmcGooglepay.Authorize('ORDER-GP-004', pi, null);

            assert.isTrue(result.error);
        });

        it('should return error when authorizeGooglePay returns error', function () {
            mockJPMCTransactionHelpers.authorizeGooglePay.returns({ error: true });
            var pi = new PaymentInstrumentMock();
            pi.paymentMethod = 'JPMC_GOOGLE_PAY';

            var result = jpmcGooglepay.Authorize('ORDER-GP-005', pi, mockProcessor);

            assert.isTrue(result.error);
        });

        it('should catch and handle exceptions', function () {
            mockJPMCTransactionHelpers.authorizeGooglePay.throws(new Error('Boom'));
            var pi = new PaymentInstrumentMock();
            pi.paymentMethod = 'JPMC_GOOGLE_PAY';

            var result = jpmcGooglepay.Authorize('ORDER-GP-006', pi, mockProcessor);

            assert.isTrue(result.error);
            assert.isAbove(result.serverErrors.length, 0);
        });
    });

  
    describe('Security — No Token Logging', function () {
        it('should never log the raw Google Pay encrypted token', function () {
            var paymentInfo = { googlePayToken: { value: VALID_GPAY_TOKEN } };
            jpmcGooglepay.Handle(mockBasket, paymentInfo, 'JPMC_GOOGLE_PAY', mockReq);

            var logger = mockLogger.getLogger('JPMC', 'jpmc_googlepay');
            var allLogs = logger.debugMessages
                .concat(logger.infoMessages)
                .concat(logger.warnMessages)
                .concat(logger.errorMessages);

            allLogs.forEach(function (logArgs) {
                var logStr = logArgs.join(' ');
                assert.notInclude(logStr, 'BASE64_SIGNED_MESSAGE', 'Must never log signedMessage');
                assert.notInclude(logStr, 'SIG_1_BASE64', 'Must never log signature');
                assert.notInclude(logStr, VALID_GPAY_TOKEN, 'Must never log full token');
            });
        });
    });


    describe('Module Exports', function () {
        it('should export processForm, Handle, and Authorize', function () {
            assert.isFunction(jpmcGooglepay.processForm);
            assert.isFunction(jpmcGooglepay.Handle);
            assert.isFunction(jpmcGooglepay.Authorize);
        });
    });
});
