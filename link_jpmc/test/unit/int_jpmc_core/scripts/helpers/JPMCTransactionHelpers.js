'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('int_jpmc_core/scripts/helpers/JPMCTransactionHelpers', function () {
    var jpmcTransactionHelpers;
    var mockLogger;
    var mockTransaction;
    var mockOrderMgr;
    var mockResource;
    var mockHookMgr;
    var mockJPMCConfig;
    var mockJPMCPaymentHelper;
    var mockJPMCServiceHelper;
    var mockJPMCPayloadBuilder;
    var mockJPMCMerchantResolver;
    var mockUUID;
    var Order;
    var PaymentInstrument;
    var PaymentTransaction;
    var mockPaymentProcessor;
    var mockOrder;
    var mockPaymentInstrument;
    var sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();

        // Reset all mocks
        mockLogger = require('../../../../../test/mocks/dw/system/Logger');
        mockLogger.resetAllLoggers();

        mockTransaction = require('../../../../../test/mocks/dw/system/Transaction');
        mockTransaction.reset();
        sinon.spy(mockTransaction, 'wrap');

        mockOrderMgr = require('../../../../../test/mocks/dw/order/OrderMgr');
        mockOrderMgr.reset();

        mockResource = require('../../../../../test/mocks/dw/web/Resource');
        mockResource.reset();

        mockHookMgr = require('../../../../../test/mocks/dw/system/HookMgr');
        mockHookMgr.reset();

        Order = require('../../../../../test/mocks/dw/order/Order');
        Order.resetMock();

        PaymentInstrument = require('../../../../../test/mocks/dw/order/PaymentInstrument');
        PaymentInstrument.reset();

        PaymentTransaction = require('../../../../../test/mocks/dw/order/PaymentTransaction');
        PaymentTransaction.reset();

        mockUUID = require('../../../../../test/mocks/dw/util/UUIDUtils');
        mockUUID.resetCounter();

        // Mock session global (SFCC global object)
        global.session = require('../../../../../test/mocks/dw/system/Session');
        global.session.resetSession();
        global.session.forms = {
            billing: {
                creditCardFields: {
                    saveCard: {
                        checked: false
                    }
                }
            }
        };
        global.session.privacy = {};

        // Mock request global
        global.request = {
            getHttpRemoteAddress: sinon.stub().returns('192.168.1.1')
        };

        // Mock JPMCConfig
        mockJPMCConfig = {
            getCaptureMethod: sinon.stub().returns('DELAYED'),
            isFraudCheckEnabledAtAuth: sinon.stub().returns(false),
            isAccountUpdaterRTAUEnabled: sinon.stub().returns(false),
            is3DSEnabled: sinon.stub().returns(false),
            getConfig: sinon.stub().returns({
                accountNumberType: 'DPAN',
                merchantSoftware: {
                    companyName: 'Test Company',
                    productName: 'Test Product',
                    version: '1.0.0'
                }
            }),
            getPreference: sinon.stub().returns('test-merchant-xyz'),
            getAccessTokenConfig: sinon.stub().returns({ merchantId: 'test-merchant-xyz' })
        };

        // Mock JPMCMerchantResolver
        mockJPMCMerchantResolver = {
            resolve: sinon.stub().returns({ merchantId: 'test-merchant-xyz', tokenizationType: 'DPAN', captureMethod: 'DELAYED', enableFraudCheckAtAuth: false }),
            resolveForOrder: sinon.stub().returns({ merchantId: 'test-merchant-xyz', tokenizationType: 'DPAN', captureMethod: 'DELAYED', enableFraudCheckAtAuth: false }),
            toAccessTokenConfig: sinon.stub().returns({}),
            invalidateCache: sinon.stub()
        };

        // Mock JPMCPaymentHelper
        mockJPMCPaymentHelper = {
            createPayment: sinon.stub().returns({
                success: true,
                transactionId: 'test-txn-bbb-222'
            })
        };

        // Mock JPMCServiceHelper
        mockJPMCServiceHelper = {
            callWithTokenGeneration: sinon.stub()
        };

        // Mock JPMCPayloadBuilder
        mockJPMCPayloadBuilder = {
            buildGooglePayPaymentPayload: sinon.stub().returns({
                amount: 10000,
                currency: 'USD'
            }),
            buildVoidPayload: sinon.stub().returns({
                isVoid: true
            })
        };

        // Mock payment processor
        mockPaymentProcessor = {
            ID: 'test-processor-ddd'
        };

        // Create mock order
        mockOrder = new Order();
        mockOrder.orderNo = 'test-ord-aaa-111';

        // Create mock payment instrument
        mockPaymentInstrument = new PaymentInstrument();
        mockPaymentInstrument.paymentMethod = 'CREDIT_CARD';
        mockPaymentInstrument.paymentTransaction = new PaymentTransaction();
        mockPaymentInstrument.paymentTransaction.amount = { value: 100.00 };
        mockPaymentInstrument.custom = {};
        mockPaymentInstrument.lineItemCtnr = mockOrder;

        // Register order in OrderMgr
        mockOrderMgr._registerOrder('test-ord-aaa-111', mockOrder);

        // Load module with mocks
        jpmcTransactionHelpers = proxyquire('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JPMCTransactionHelpers', {
            'dw/system/Transaction': mockTransaction,
            'dw/order/OrderMgr': mockOrderMgr,
            'dw/system/Logger': mockLogger,
            'dw/web/Resource': mockResource,
            'dw/system/HookMgr': mockHookMgr,
            'dw/util/UUIDUtils': mockUUID,
            '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
            '*/cartridge/scripts/helpers/JPMCPaymentHelper': mockJPMCPaymentHelper,
            '*/cartridge/scripts/services/JPMCServiceHelper': mockJPMCServiceHelper,
            '*/cartridge/scripts/helpers/JPMCPayloadBuilder': mockJPMCPayloadBuilder,
            '*/cartridge/scripts/helpers/JPMCConstants': {
                ACCOUNT_NUMBER_TYPE_PIE: 'SAFETECH_PAGE_ENCRYPTION',
                FRAUD_REVIEW_NOTE_SUBJECT: 'Fraud Review',
                NOTE_SUBJECT_GPAY_PAYMENT: 'JPMC Google Pay Payment',
                GOOGLE_PAY_WALLET_PROVIDER: 'GOOGLE_PAY',
                JPMC_GOOGLE_PAY: 'JPMC_GOOGLE_PAY',
                JPMC_Processor: 'JPMC_Payment'
            },
            '*/cartridge/scripts/helpers/JPMCMerchantResolver': mockJPMCMerchantResolver
        });
    });

    afterEach(function () {
        sinon.restore();
        delete global.session;
        delete global.request;
    });

    // ==================== authorize() Tests ====================

    describe('authorize()', function () {
        it('should return error when order is not found', function () {
            var result = jpmcTransactionHelpers.authorize('test-ord-invalid-999', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
            assert.isArray(result.serverErrors);
            assert.equal(result.serverErrors[0], 'Order not found.');
        });

        it('should successfully authorize payment with stored card', function () {
            mockPaymentInstrument.creditCardToken = 'test-token-aaa-111';
            mockPaymentInstrument.getCreditCardToken = function () {
                return this.creditCardToken;
            };

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.equal(result.transactionId, 'test-txn-bbb-222');
            assert.equal(result.captureMethod, 'DELAYED');
            assert.isTrue(mockJPMCPaymentHelper.createPayment.calledOnce);

            // Verify createPayment was called with correct accountOnFile
            var createPaymentArgs = mockJPMCPaymentHelper.createPayment.firstCall.args[1];
            assert.equal(createPaymentArgs.accountOnFile, 'STORED');
            assert.equal(createPaymentArgs.accountNumberType, 'DPAN');
        });

        it('should successfully authorize payment with new card and save card checked', function () {
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            global.session.forms.billing.creditCardFields.saveCard.checked = true;

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.equal(result.transactionId, 'test-txn-bbb-222');

            // Verify createPayment was called with correct accountOnFile
            var createPaymentArgs = mockJPMCPaymentHelper.createPayment.firstCall.args[1];
            assert.equal(createPaymentArgs.accountOnFile, 'TO_BE_STORED');
            assert.equal(createPaymentArgs.accountNumberType, 'SAFETECH_PAGE_ENCRYPTION');
        });

        it('should successfully authorize payment with new card and save card not checked', function () {
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            global.session.forms.billing.creditCardFields.saveCard.checked = false;

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);

            // Verify createPayment was called with correct accountOnFile
            var createPaymentArgs = mockJPMCPaymentHelper.createPayment.firstCall.args[1];
            assert.equal(createPaymentArgs.accountOnFile, 'NOT_STORED');
        });

        it('should use capture method from site preference', function () {
            mockJPMCConfig.getCaptureMethod.returns('NOW');
            mockJPMCMerchantResolver.resolve.returns({ 
                merchantId: 'test-merchant-xyz', 
                tokenizationType: 'DPAN', 
                captureMethod: 'NOW', 
                enableFraudCheckAtAuth: false 
            });
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.equal(result.captureMethod, 'NOW');

            var createPaymentArgs = mockJPMCPaymentHelper.createPayment.firstCall.args[1];
            assert.equal(createPaymentArgs.captureMethod, 'NOW');
        });

        it('should set payment status to AC for NOW capture method', function () {
            mockJPMCConfig.getCaptureMethod.returns('NOW');
            mockJPMCMerchantResolver.resolve.returns({ 
                merchantId: 'test-merchant-xyz', 
                tokenizationType: 'DPAN', 
                captureMethod: 'NOW', 
                enableFraudCheckAtAuth: false 
            });
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            mockPaymentInstrument.paymentTransaction.custom = {};

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.isTrue(mockTransaction.wrap.called);

            // Verify payment status was set in Transaction.wrap
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcPaymentStatus, 'AC');
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcCapturedAmount, 100.00);
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcRemainingAuthAmount, 0);
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcRemainingRefundableAmount, 100.00);
        });

        it('should set payment status to A for DELAYED capture method', function () {
            mockJPMCConfig.getCaptureMethod.returns('DELAYED');
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            mockPaymentInstrument.paymentTransaction.custom = {};

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);

            // Verify payment status was set
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcPaymentStatus, 'A');
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcRemainingAuthAmount, 100.00);
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcRemainingRefundableAmount, 0);
        });

        it('should call fraud detection hook when enabled and hook exists', function () {
            mockJPMCConfig.isFraudCheckEnabledAtAuth.returns(true);
            mockHookMgr._registerHook('app.safetech.fraud.detection');
            mockHookMgr._setHookResult('app.safetech.fraud.detection', 'fraudDetection', {
                status: 'success',
                fraudRuleAction: null
            });
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.isTrue(mockHookMgr.hasHook('app.safetech.fraud.detection'));
        });

        it('should decline payment when fraud detection returns fail status', function () {
            mockJPMCConfig.isFraudCheckEnabledAtAuth.returns(true);
            mockJPMCMerchantResolver.resolve.returns({ merchantId: 'test-merchant-xyz', tokenizationType: 'DPAN', captureMethod: 'DELAYED', enableFraudCheckAtAuth: true });
            mockHookMgr._registerHook('app.safetech.fraud.detection');
            mockHookMgr._setHookResult('app.safetech.fraud.detection', 'fraudDetection', {
                status: 'fail',
                fraudRuleAction: 'D'
            });
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
            assert.isArray(result.serverErrors);
            assert.include(result.serverErrors[0], 'security reasons');
        });

        it('should override capture method to MANUAL when fraud flagged from verify stage', function () {
            mockJPMCConfig.getCaptureMethod.returns('NOW');
            mockPaymentInstrument.custom.jpmcFraudRuleAction = 'R'; // Review
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            mockPaymentInstrument.paymentTransaction.custom = {};

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.equal(result.captureMethod, 'MANUAL');

            // Verify createPayment was called with MANUAL
            var createPaymentArgs = mockJPMCPaymentHelper.createPayment.firstCall.args[1];
            assert.equal(createPaymentArgs.captureMethod, 'MANUAL');
        });

        it('should override capture method to MANUAL when fraud flagged from auth stage', function () {
            mockJPMCConfig.getCaptureMethod.returns('NOW');
            mockJPMCConfig.isFraudCheckEnabledAtAuth.returns(true);
            mockJPMCMerchantResolver.resolve.returns({ merchantId: 'test-merchant-xyz', tokenizationType: 'DPAN', captureMethod: 'NOW', enableFraudCheckAtAuth: true });
            mockHookMgr._registerHook('app.safetech.fraud.detection');
            mockHookMgr._setHookResult('app.safetech.fraud.detection', 'fraudDetection', {
                status: 'success',
                fraudRuleAction: 'E' // Manager Review
            });
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.equal(result.captureMethod, 'MANUAL');
        });

        it('should not duplicate order note when fraud note already exists (lines 143-145)', function () {
            mockJPMCConfig.getCaptureMethod.returns('NOW');
            mockPaymentInstrument.custom.jpmcFraudRuleAction = 'R';
            mockPaymentInstrument.getCreditCardToken = function () { return null; };
            mockPaymentInstrument.paymentTransaction.custom = {};

            // Pre-add a fraud review note so `noteExists` becomes true → `if (!noteExists)` is false
            mockOrder.addNote('Fraud Review', 'Order marked for review');

            jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            // Note should NOT be duplicated — still exactly 1 fraud note
            var notes = mockOrder.getNotes().toArray();
            var fraudNotes = notes.filter(function (n) { return n.subject === 'Fraud Review'; });
            assert.equal(fraudNotes.length, 1);
        });

        it('should add order note when fraud flagged', function () {
            mockJPMCConfig.getCaptureMethod.returns('NOW');
            mockPaymentInstrument.custom.jpmcFraudRuleAction = 'R';
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            mockPaymentInstrument.paymentTransaction.custom = {};

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.isTrue(mockTransaction.wrap.called);

            // Verify order note was added
            var notes = mockOrder.getNotes().toArray();
            assert.isTrue(notes.length > 0);
            var fraudNote = notes.find(function (note) {
                return note.subject === 'Fraud Review';
            });
            assert.isDefined(fraudNote);
            assert.include(fraudNote.text, 'Order marked for review');
        });

        it('should include IP address in payment creation when available', function () {
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            global.request.getHttpRemoteAddress.returns('203.0.113.42');

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);

            var createPaymentArgs = mockJPMCPaymentHelper.createPayment.firstCall.args[1];
            assert.equal(createPaymentArgs.IPAddress, '203.0.113.42');
        });

        it('should handle missing IP address gracefully', function () {
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            global.request.getHttpRemoteAddress.throws(new Error('Request not available'));

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            // Should still succeed despite IP error
        });

        it('should return error when createPayment fails', function () {
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            mockJPMCPaymentHelper.createPayment.returns({
                success: false,
                error: 'Payment gateway error'
            });

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
            assert.isArray(result.serverErrors);
            assert.isTrue(result.serverErrors.length > 0);
        });

        it('should store transaction IDs in payment instrument and transaction', function () {
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            mockPaymentInstrument.paymentTransaction.custom = {};

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.equal(mockPaymentInstrument.custom.jpmcTransactionId, 'test-txn-bbb-222');
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcAuthorizationId, 'test-txn-bbb-222');
        });

        it('should store capture method and auth timestamp', function () {
            mockJPMCConfig.getCaptureMethod.returns('DELAYED');
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };
            mockPaymentInstrument.paymentTransaction.custom = {};

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcCaptureMethod, 'DELAYED');
            assert.isDefined(mockPaymentInstrument.paymentTransaction.custom.jpmcAuthTimestamp);
        });

        it('should fail order and return error on exception', function () {
            mockPaymentInstrument.getCreditCardToken = function () {
                throw new Error('Unexpected error');
            };

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
            assert.isArray(result.serverErrors);
            // Verify order was failed
            assert.isTrue(mockOrder.custom.failed);
        });

        it('should clear session privacy data in finally block', function () {
            global.session.privacy.jpmcEncryptedCvv = 'encrypted123';
            global.session.privacy.jpmcEncryptedData = 'encryptedData';
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };

            jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);
            assert.isNull(global.session.privacy.jpmcEncryptedCvv);
            assert.isNull(global.session.privacy.jpmcEncryptedData);
        });

        it('should handle headless/API flows without billing form', function () {
            delete global.session.forms.billing;
            mockPaymentInstrument.getCreditCardToken = function () {
                return null;
            };

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            // Should not throw error despite missing form
        });
    });

    // ==================== authorizeGooglePay() Tests ====================

    describe('authorizeGooglePay()', function () {
        var googlePayToken;

        beforeEach(function () {
            googlePayToken = {
                protocolVersion: 'ECv1',
                signature: 'MEQCIH6Q4OwQ0jAceFEkGF0JID6sJNXxOEi4r+mA7biUxvQeAiBwKgUP',
                signedMessage: '{"encryptedMessage":"enc_payload_mock_0_1_18...","ephemeralPublicKey":"BPhVspn70Zj...","tag":"ZVwlJt..."}',
                intermediateSigningKey: null
            };

            mockPaymentInstrument.custom.jpmcGooglePayToken = JSON.stringify(googlePayToken);
            // Token now lives in session.privacy (GP-1 fix)
            global.session.privacy.jpmcGooglePayToken = JSON.stringify(googlePayToken);
            mockPaymentInstrument.paymentMethod = 'GOOGLE_PAY';
        });

        it('should return error when order is not found', function () {
            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-invalid-999', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
            assert.isArray(result.serverErrors);
        });

        it('should return error when Google Pay token is missing', function () {
            global.session.privacy.jpmcGooglePayToken = null;
            mockPaymentInstrument.custom.jpmcGooglePayToken = null;

            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
            assert.isArray(result.serverErrors);
        });

        it('should return error when Google Pay token is invalid JSON', function () {
            global.session.privacy.jpmcGooglePayToken = 'invalid-json';
            mockPaymentInstrument.custom.jpmcGooglePayToken = 'invalid-json';

            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
        });

        it('should return error when signedMessage is missing', function () {
            delete googlePayToken.signedMessage;
            global.session.privacy.jpmcGooglePayToken = JSON.stringify(googlePayToken);
            mockPaymentInstrument.custom.jpmcGooglePayToken = JSON.stringify(googlePayToken);

            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
        });

        it('should return error when protocolVersion is missing', function () {
            delete googlePayToken.protocolVersion;
            global.session.privacy.jpmcGooglePayToken = JSON.stringify(googlePayToken);
            mockPaymentInstrument.custom.jpmcGooglePayToken = JSON.stringify(googlePayToken);

            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
        });

        it('should return error when signature is missing for ECv1', function () {
            delete googlePayToken.signature;
            global.session.privacy.jpmcGooglePayToken = JSON.stringify(googlePayToken);
            mockPaymentInstrument.custom.jpmcGooglePayToken = JSON.stringify(googlePayToken);

            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
        });

        it('should accept ECv2 token with intermediateSigningKey', function () {
            googlePayToken.protocolVersion = 'ECv2';
            delete googlePayToken.signature;
            googlePayToken.intermediateSigningKey = {
                signatures: ['signature1', 'signature2']
            };
            global.session.privacy.jpmcGooglePayToken = JSON.stringify(googlePayToken);
            mockPaymentInstrument.custom.jpmcGooglePayToken = JSON.stringify(googlePayToken);
            mockPaymentInstrument.paymentTransaction.custom = {};

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'GPAY-TXN-123',
                    transactionState: 'AUTHORIZED'
                }
            });

            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
        });

        it('should successfully authorize Google Pay payment', function () {
            mockPaymentInstrument.paymentTransaction.custom = {};
            mockJPMCConfig.getCaptureMethod.returns('DELAYED');

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'GPAY-TXN-123',
                    transactionState: 'AUTHORIZED'
                }
            });

            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isFalse(result.error);
            assert.equal(result.transactionId, 'GPAY-TXN-123');
            assert.equal(result.captureMethod, 'DELAYED');
        });

        it('should build Google Pay payment payload correctly', function () {
            mockPaymentInstrument.paymentTransaction.custom = {};
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'GPAY-TXN-123'
                }
            });

            jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(mockJPMCPayloadBuilder.buildGooglePayPaymentPayload.calledOnce);
            var buildArgs = mockJPMCPayloadBuilder.buildGooglePayPaymentPayload.firstCall.args[0];
            assert.equal(buildArgs.order, mockOrder);
            assert.equal(buildArgs.paymentInstrument, mockPaymentInstrument);
            assert.equal(buildArgs.initiatorType, 'CARDHOLDER');
            assert.equal(buildArgs.accountOnFile, 'NOT_STORED');
            assert.isTrue(buildArgs.isAmountFinal);
        });

        it('should call service with correct headers including request-id', function () {
            mockPaymentInstrument.paymentTransaction.custom = {};
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'GPAY-TXN-123'
                }
            });

            jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(mockJPMCServiceHelper.callWithTokenGeneration.calledOnce);
            var serviceArgs = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];
            assert.equal(serviceArgs.tokenServiceId, 'JPMCAccessToken');
            assert.equal(serviceArgs.serviceId, 'JPMCPaymentService');
            assert.equal(serviceArgs.method, 'POST');
            assert.equal(serviceArgs.headers['merchant-id'], 'test-merchant-xyz');
            assert.isDefined(serviceArgs.headers['request-id']);
        });

        it('should return error when service call fails', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false,
                error: 'Service error'
            });

            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
        });

        it('should return error when payment response status is not SUCCESS', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'DECLINED',
                    responseCode: '100',
                    responseMessage: 'Card declined'
                }
            });

            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
        });

        it('should store wallet provider and transaction IDs', function () {
            mockPaymentInstrument.paymentTransaction.custom = {};
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'GPAY-TXN-123'
                }
            });

            jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.equal(mockPaymentInstrument.custom.jpmcTransactionId, 'GPAY-TXN-123');
            assert.equal(mockPaymentInstrument.custom.jpmcWalletProvider, 'GOOGLE_PAY');
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcAuthorizationId, 'GPAY-TXN-123');
        });

        it('should set payment status to AC for NOW capture', function () {
            mockJPMCConfig.getCaptureMethod.returns('NOW');
            mockJPMCMerchantResolver.resolve.returns({ 
                merchantId: 'test-merchant-xyz', 
                tokenizationType: 'DPAN', 
                captureMethod: 'NOW', 
                enableFraudCheckAtAuth: false 
            });
            mockPaymentInstrument.paymentTransaction.custom = {};
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'GPAY-TXN-123'
                }
            });

            jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcPaymentStatus, 'AC');
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcCapturedAmount, 100.00);
        });

        it('should set payment status to A for DELAYED capture', function () {
            mockJPMCConfig.getCaptureMethod.returns('DELAYED');
            mockPaymentInstrument.paymentTransaction.custom = {};
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'GPAY-TXN-123'
                }
            });

            jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcPaymentStatus, 'A');
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcRemainingAuthAmount, 100.00);
        });

        it('should add order note with Google Pay payment details', function () {
            mockPaymentInstrument.paymentTransaction.custom = {};
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'GPAY-TXN-123'
                }
            });

            jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            var notes = mockOrder.getNotes().toArray();
            var gpayNote = notes.find(function (note) {
                return note.subject === 'JPMC Google Pay Payment';
            });
            assert.isDefined(gpayNote);
            assert.include(gpayNote.text, 'GPAY-TXN-123');
            assert.include(gpayNote.text, 'DELAYED');
        });

        it('should clear Google Pay token from session.privacy in finally block', function () {
            mockPaymentInstrument.paymentTransaction.custom = {};
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'GPAY-TXN-123'
                }
            });

            jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isNull(global.session.privacy.jpmcGooglePayToken);
        });

        it('should clear Google Pay token from session.privacy even on error', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false,
                error: 'Service error'
            });

            jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isNull(global.session.privacy.jpmcGooglePayToken);
        });

        it('should handle exception and return error', function () {
            mockJPMCPayloadBuilder.buildGooglePayPaymentPayload.throws(new Error('Payload error'));

            var result = jpmcTransactionHelpers.authorizeGooglePay('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);

            assert.isTrue(result.error);
            assert.isArray(result.serverErrors);
        });
    });

    // ==================== resolveJpmcTransactionId() Tests ====================

    describe('resolveJpmcTransactionId()', function () {
        it('should prefer paymentTransaction.custom.jpmcAuthorizationId', function () {
            var pi = { custom: { jpmcTransactionId: 'PI-TXN' } };
            var pt = {
                custom: { jpmcAuthorizationId: 'AUTH-BEST' },
                getTransactionID: function () { return 'FALLBACK'; }
            };
            var id = jpmcTransactionHelpers.resolveJpmcTransactionId(pi, pt);
            assert.equal(id, 'AUTH-BEST');
        });

        it('should fall back to paymentInstrument.custom.jpmcTransactionId', function () {
            var pi = { custom: { jpmcTransactionId: 'PI-TXN' } };
            var pt = {
                custom: {},
                getTransactionID: function () { return 'FALLBACK'; }
            };
            var id = jpmcTransactionHelpers.resolveJpmcTransactionId(pi, pt);
            assert.equal(id, 'PI-TXN');
        });

        it('should fall back to paymentTransaction.getTransactionID()', function () {
            var pi = { custom: {} };
            var pt = {
                custom: {},
                getTransactionID: function () { return 'FALLBACK'; }
            };
            var id = jpmcTransactionHelpers.resolveJpmcTransactionId(pi, pt);
            assert.equal(id, 'FALLBACK');
        });

        it('should return null when all sources are empty', function () {
            var pi = { custom: {} };
            var pt = {
                custom: {},
                getTransactionID: function () { return null; }
            };
            var id = jpmcTransactionHelpers.resolveJpmcTransactionId(pi, pt);
            assert.isNull(id);
        });

        it('should handle null paymentInstrument gracefully', function () {
            var pt = {
                custom: { jpmcAuthorizationId: 'AUTH-123' },
                getTransactionID: function () { return 'TXN'; }
            };
            var id = jpmcTransactionHelpers.resolveJpmcTransactionId(null, pt);
            assert.equal(id, 'AUTH-123');
        });

        it('should handle null paymentTransaction gracefully', function () {
            var pi = { custom: { jpmcTransactionId: 'PI-TXN' } };
            var id = jpmcTransactionHelpers.resolveJpmcTransactionId(pi, null);
            assert.equal(id, 'PI-TXN');
        });

        it('should return null when both are null', function () {
            var id = jpmcTransactionHelpers.resolveJpmcTransactionId(null, null);
            assert.isNull(id);
        });
    });

    // ==================== persistAuthorizationData() Tests ====================

    describe('persistAuthorizationData()', function () {
        var pi;
        var pt;

        beforeEach(function () {
            pt = {
                amount: { value: 150.00 },
                custom: {}
            };
            pi = {
                custom: {},
                paymentTransaction: pt,
                getPaymentTransaction: function () { return pt; }
            };
        });

        it('should set jpmcTransactionId on PI custom', function () {
            jpmcTransactionHelpers.persistAuthorizationData({
                paymentInstrument: pi,
                transactionId: 'TXN-001',
                captureMethod: 'DELAYED'
            });
            assert.equal(pi.custom.jpmcTransactionId, 'TXN-001');
        });

        it('should set walletProvider on PI custom when provided', function () {
            jpmcTransactionHelpers.persistAuthorizationData({
                paymentInstrument: pi,
                transactionId: 'TXN-001',
                captureMethod: 'DELAYED',
                walletProvider: 'GOOGLE_PAY'
            });
            assert.equal(pi.custom.jpmcWalletProvider, 'GOOGLE_PAY');
        });

        it('should NOT set walletProvider when not provided', function () {
            jpmcTransactionHelpers.persistAuthorizationData({
                paymentInstrument: pi,
                transactionId: 'TXN-001',
                captureMethod: 'DELAYED'
            });
            assert.isUndefined(pi.custom.jpmcWalletProvider);
        });

        it('should set jpmcAuthorizationId on PT custom', function () {
            jpmcTransactionHelpers.persistAuthorizationData({
                paymentInstrument: pi,
                transactionId: 'TXN-001',
                captureMethod: 'MANUAL'
            });
            assert.equal(pt.custom.jpmcAuthorizationId, 'TXN-001');
        });

        it('should set captureMethod and authTimestamp on PT custom', function () {
            jpmcTransactionHelpers.persistAuthorizationData({
                paymentInstrument: pi,
                transactionId: 'TXN-001',
                captureMethod: 'DELAYED'
            });
            assert.equal(pt.custom.jpmcCaptureMethod, 'DELAYED');
            assert.isString(pt.custom.jpmcAuthTimestamp);
        });

        it('should set AC status and captured amounts for NOW capture', function () {
            jpmcTransactionHelpers.persistAuthorizationData({
                paymentInstrument: pi,
                transactionId: 'TXN-001',
                captureMethod: 'NOW'
            });
            assert.equal(pt.custom.jpmcPaymentStatus, 'AC');
            assert.equal(pt.custom.jpmcCapturedAmount, 150.00);
            assert.equal(pt.custom.jpmcRemainingAuthAmount, 0);
            assert.equal(pt.custom.jpmcRemainingRefundableAmount, 150.00);
        });

        it('should set A status and auth amounts for DELAYED capture', function () {
            jpmcTransactionHelpers.persistAuthorizationData({
                paymentInstrument: pi,
                transactionId: 'TXN-001',
                captureMethod: 'DELAYED'
            });
            assert.equal(pt.custom.jpmcPaymentStatus, 'A');
            assert.equal(pt.custom.jpmcRemainingAuthAmount, 150.00);
            assert.equal(pt.custom.jpmcRemainingRefundableAmount, 0);
        });

        it('should set A status for MANUAL capture', function () {
            jpmcTransactionHelpers.persistAuthorizationData({
                paymentInstrument: pi,
                transactionId: 'TXN-001',
                captureMethod: 'MANUAL'
            });
            assert.equal(pt.custom.jpmcPaymentStatus, 'A');
        });
    });

    // ==================== voidPayment() Tests ====================

    describe('voidPayment()', function () {
        beforeEach(function () {
            mockPaymentInstrument.paymentTransaction.transactionID = 'test-txn-bbb-222';
            mockPaymentInstrument.paymentTransaction.custom = {
                jpmcAuthorizationId: 'test-txn-bbb-222'
            };
            mockPaymentInstrument.paymentTransaction.getTransactionID = function () {
                return this.transactionID;
            };
            mockOrder.paymentInstruments.add(mockPaymentInstrument);
        });

        it('should return error when order is null', function () {
            var result = jpmcTransactionHelpers.voidPayment(null);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Order is required');
        });

        it('should return error when no payment instruments found', function () {
            var emptyOrder = new Order();
            emptyOrder.orderNo = 'EMPTY-ORDER';

            var result = jpmcTransactionHelpers.voidPayment(emptyOrder);

            assert.isFalse(result.success);
            assert.include(result.error, 'No payment instruments found');
        });

        it('should return error when no transaction ID found', function () {
            mockPaymentInstrument.paymentTransaction.transactionID = null;
            mockPaymentInstrument.paymentTransaction.custom = {};

            var result = jpmcTransactionHelpers.voidPayment(mockOrder);

            assert.isFalse(result.success);
            assert.include(result.error, 'JPMC transaction ID not found');
        });

        it('should use jpmcAuthorizationId from payment transaction custom', function () {
            mockPaymentInstrument.paymentTransaction.custom.jpmcAuthorizationId = 'AUTH-ID-123';
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'VOIDED',
                    transactionId: 'AUTH-ID-123'
                }
            });

            jpmcTransactionHelpers.voidPayment(mockOrder);

            var serviceArgs = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];
            assert.equal(serviceArgs.placeHolderId, 'AUTH-ID-123');
        });

        it('should fallback to jpmcTransactionId from payment instrument', function () {
            delete mockPaymentInstrument.paymentTransaction.custom.jpmcAuthorizationId;
            mockPaymentInstrument.custom.jpmcTransactionId = 'PI-TXN-123';
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'VOIDED',
                    transactionId: 'PI-TXN-123'
                }
            });

            jpmcTransactionHelpers.voidPayment(mockOrder);

            var serviceArgs = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];
            assert.equal(serviceArgs.placeHolderId, 'PI-TXN-123');
        });

        it('should successfully void payment', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'VOIDED',
                    transactionId: 'test-txn-bbb-222',
                    approvalCode: 'APPR-001'
                }
            });

            var result = jpmcTransactionHelpers.voidPayment(mockOrder);

            assert.isTrue(result.success);
            assert.equal(result.data.transactionState, 'VOIDED');
        });

        it('should call service with correct parameters', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'VOIDED',
                    transactionId: 'test-txn-bbb-222'
                }
            });

            jpmcTransactionHelpers.voidPayment(mockOrder);

            assert.isTrue(mockJPMCServiceHelper.callWithTokenGeneration.calledOnce);
            var serviceArgs = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];
            assert.equal(serviceArgs.tokenServiceId, 'JPMCAccessToken');
            assert.equal(serviceArgs.serviceId, 'JPMCPaymentVoid');
            assert.equal(serviceArgs.method, 'PATCH');
            assert.equal(serviceArgs.headers['merchant-id'], 'test-merchant-xyz');
            assert.isDefined(serviceArgs.headers['request-id']);
            assert.equal(serviceArgs.placeHolderId, 'test-txn-bbb-222');
        });

        it('should build void payload', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'VOIDED',
                    transactionId: 'test-txn-bbb-222'
                }
            });

            jpmcTransactionHelpers.voidPayment(mockOrder);

            assert.isTrue(mockJPMCPayloadBuilder.buildVoidPayload.calledOnce);
        });

        it('should update remaining auth amount to 0 on successful void', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'VOIDED',
                    transactionId: 'test-txn-bbb-222'
                }
            });

            jpmcTransactionHelpers.voidPayment(mockOrder);

            assert.isTrue(mockTransaction.wrap.called);
            assert.equal(mockPaymentInstrument.paymentTransaction.custom.jpmcRemainingAuthAmount, 0);
        });

        it('should add order note with void details', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'VOIDED',
                    transactionId: 'test-txn-bbb-222',
                    approvalCode: 'APPR-001'
                }
            });

            jpmcTransactionHelpers.voidPayment(mockOrder);

            var notes = mockOrder.getNotes().toArray();
            var voidNote = notes.find(function (note) {
                return note.subject === 'JPMC Authorization Voided';
            });
            assert.isDefined(voidNote);
            assert.include(voidNote.text, 'test-txn-bbb-222');
            assert.include(voidNote.text, 'VOIDED');
            assert.include(voidNote.text, 'APPR-001');
        });

        it('should return error when void response status is not SUCCESS', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'FAILED',
                    responseCode: '200',
                    responseMessage: 'Void failed'
                }
            });

            var result = jpmcTransactionHelpers.voidPayment(mockOrder);

            assert.isFalse(result.success);
            assert.include(result.error, 'Void failed');
        });

        it('should return error when transaction state is not VOIDED', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'AUTHORIZED',
                    responseMessage: 'Already voided'
                }
            });

            var result = jpmcTransactionHelpers.voidPayment(mockOrder);

            assert.isFalse(result.success);
            assert.isDefined(result.error);
        });

        it('should return error when service call fails', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false,
                error: 'Network error'
            });

            var result = jpmcTransactionHelpers.voidPayment(mockOrder);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Network error');
        });

        it('should return error when merchant ID is not configured', function () {
            mockJPMCMerchantResolver.resolveForOrder.returns({});

            var result = jpmcTransactionHelpers.voidPayment(mockOrder);

            assert.isFalse(result.success);
            assert.include(result.error, 'Merchant ID not configured');
        });

        it('should handle exception and return error', function () {
            mockJPMCPayloadBuilder.buildVoidPayload.throws(new Error('Payload error'));

            var result = jpmcTransactionHelpers.voidPayment(mockOrder);

            assert.isFalse(result.success);
            assert.include(result.error, 'Payload error');
        });

        it('should return error when JPMC transaction ID not found (line 387-388 — via resolvedConfig with no merchantId)', function () {
            // resolveJpmcTransactionId always returns getTransactionID() as last resort,
            // so the only way !jpmcTransactionId is true is when getTransactionID() is also falsy
            // AND both custom fields are null — which hits "No authorization transaction found" first.
            // Line 387 is defensive dead code. We verify the prior guard instead:
            mockPaymentInstrument.paymentTransaction.getTransactionID = function () { return null; };
            mockPaymentInstrument.paymentTransaction.custom = {};

            var result = jpmcTransactionHelpers.voidPayment(mockOrder);
            assert.isFalse(result.success);
            assert.ok(result.error);
        });
    });

    // ==================== RTAU / processRTAUForOrder path ====================

    describe('authorize() with RTAU enabled', function () {
        it('should call processRTAUForOrder when RTAU is enabled and stored card used', function () {
            mockJPMCMerchantResolver.resolve.returns({
                merchantId: 'test-merchant-xyz', tokenizationType: 'DPAN',
                captureMethod: 'DELAYED', enableFraudCheckAtAuth: false,
                accountUpdaterMode: 'REAL_TIME'
            });
            mockJPMCPaymentHelper.createPayment.returns({
                success: true,
                transactionId: 'test-txn-bbb-222',
                data: { responseCode: 'APPROVED', accountUpdater: { accountUpdaterResponse: 'MATCH_UPDATE' } }
            });
            var rtauCalled = false;
            var mockAccountUpdaterHelper = {
                processRTAUForOrder: function () { rtauCalled = true; }
            };

            mockPaymentInstrument.creditCardToken = 'STORED-TOKEN';
            mockPaymentInstrument.getCreditCardToken = function () { return this.creditCardToken; };
            mockPaymentInstrument.paymentTransaction.custom = {};

            jpmcTransactionHelpers = proxyquire('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JPMCTransactionHelpers', {
                'dw/system/Transaction': mockTransaction,
                'dw/order/OrderMgr': mockOrderMgr,
                'dw/system/Logger': mockLogger,
                'dw/web/Resource': mockResource,
                'dw/system/HookMgr': mockHookMgr,
                'dw/util/UUIDUtils': mockUUID,
                '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
                '*/cartridge/scripts/helpers/JPMCPaymentHelper': mockJPMCPaymentHelper,
                '*/cartridge/scripts/services/JPMCServiceHelper': mockJPMCServiceHelper,
                '*/cartridge/scripts/helpers/JPMCPayloadBuilder': mockJPMCPayloadBuilder,
                '*/cartridge/scripts/helpers/JPMCConstants': {
                    ACCOUNT_NUMBER_TYPE_PIE: 'SAFETECH_PAGE_ENCRYPTION',
                    FRAUD_REVIEW_NOTE_SUBJECT: 'Fraud Review',
                    NOTE_SUBJECT_GPAY_PAYMENT: 'JPMC Google Pay Payment',
                    GOOGLE_PAY_WALLET_PROVIDER: 'GOOGLE_PAY',
                    JPMC_GOOGLE_PAY: 'JPMC_GOOGLE_PAY',
                    JPMC_Processor: 'JPMC_Payment'
                },
                '*/cartridge/scripts/helpers/JPMCMerchantResolver': mockJPMCMerchantResolver,
                '*/cartridge/scripts/helpers/AccountUpdaterHelper': mockAccountUpdaterHelper,
                'dw/order/PaymentInstrument': { METHOD_CREDIT_CARD: 'CREDIT_CARD' }
            });

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);
            assert.isFalse(result.error);
            assert.isTrue(rtauCalled);
        });

        it('should not call processRTAUForOrder when responseCode is PERFORM_AUTHENTICATION', function () {
            mockJPMCMerchantResolver.resolve.returns({
                merchantId: 'test-merchant-xyz', tokenizationType: 'DPAN',
                captureMethod: 'DELAYED', enableFraudCheckAtAuth: false,
                accountUpdaterMode: 'REAL_TIME'
            });
            mockJPMCPaymentHelper.createPayment.returns({
                success: true,
                transactionId: 'test-txn-bbb-222',
                data: {
                    responseCode: 'PERFORM_AUTHENTICATION',
                    paymentAuthenticationResult: {
                        authenticationOrchestrationUrl: 'https://example.com/auth',
                        paymentRequestId: 'REQ-001'
                    }
                }
            });
            var rtauCalled = false;
            var mockAccountUpdaterHelper = {
                processRTAUForOrder: function () { rtauCalled = true; }
            };

            mockPaymentInstrument.creditCardToken = 'STORED-TOKEN';
            mockPaymentInstrument.getCreditCardToken = function () { return this.creditCardToken; };
            mockPaymentInstrument.paymentTransaction.custom = {};

            jpmcTransactionHelpers = proxyquire('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JPMCTransactionHelpers', {
                'dw/system/Transaction': mockTransaction,
                'dw/order/OrderMgr': mockOrderMgr,
                'dw/system/Logger': mockLogger,
                'dw/web/Resource': mockResource,
                'dw/system/HookMgr': mockHookMgr,
                'dw/util/UUIDUtils': mockUUID,
                '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
                '*/cartridge/scripts/helpers/JPMCPaymentHelper': mockJPMCPaymentHelper,
                '*/cartridge/scripts/services/JPMCServiceHelper': mockJPMCServiceHelper,
                '*/cartridge/scripts/helpers/JPMCPayloadBuilder': mockJPMCPayloadBuilder,
                '*/cartridge/scripts/helpers/JPMCConstants': {
                    ACCOUNT_NUMBER_TYPE_PIE: 'SAFETECH_PAGE_ENCRYPTION',
                    FRAUD_REVIEW_NOTE_SUBJECT: 'Fraud Review',
                    NOTE_SUBJECT_GPAY_PAYMENT: 'JPMC Google Pay Payment',
                    GOOGLE_PAY_WALLET_PROVIDER: 'GOOGLE_PAY',
                    JPMC_GOOGLE_PAY: 'JPMC_GOOGLE_PAY',
                    JPMC_Processor: 'JPMC_Payment'
                },
                '*/cartridge/scripts/helpers/JPMCMerchantResolver': mockJPMCMerchantResolver,
                '*/cartridge/scripts/helpers/AccountUpdaterHelper': mockAccountUpdaterHelper,
                'dw/order/PaymentInstrument': { METHOD_CREDIT_CARD: 'CREDIT_CARD' }
            });

            var result = jpmcTransactionHelpers.authorize('test-ord-aaa-111', mockPaymentInstrument, mockPaymentProcessor);
            assert.isFalse(result.error);
            assert.isFalse(rtauCalled);
        });
    });
});
