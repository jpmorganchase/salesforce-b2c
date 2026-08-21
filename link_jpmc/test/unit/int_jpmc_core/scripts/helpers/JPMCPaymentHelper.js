'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('int_jpmc_core/scripts/helpers/JPMCPaymentHelper', function () {
    var JPMCPaymentHelper;
    var mockLogger;
    var mockTransaction;
    var mockPaymentTransaction;
    var mockUUID;
    var mockJPMCConfig;
    var mockJPMCServiceHelper;
    var mockJPMCPayloadBuilder;
    var mockJPMCPaymentOperations;
    var mockJpmcTransactionHelpers;
    var mockJPMCMerchantResolver;
    var Order;

    beforeEach(function () {
        // Reset all mocks
        mockLogger = require('../../../../../test/mocks/dw/system/Logger');
        mockLogger.resetAllLoggers();

        mockTransaction = require('../../../../../test/mocks/dw/system/Transaction');
        mockTransaction.reset();
        // Spy on Transaction.wrap to track calls
        sinon.spy(mockTransaction, 'wrap');

        mockPaymentTransaction = require('../../../../../test/mocks/dw/order/PaymentTransaction');

        mockUUID = require('../../../../../test/mocks/dw/util/UUIDUtils');
        mockUUID.resetCounter();

        Order = require('../../../../../test/mocks/dw/order/Order');
        Order.resetMock();

        // Mock session global (SFCC global object)
        global.session = require('../../../../../test/mocks/dw/system/Session');
        global.session.resetSession();

        // Mock JPMCConfig
        mockJPMCConfig = {
            getPreference: sinon.stub().returns('TEST_MERCHANT_ID'),
            getAccessTokenConfig: sinon.stub().returns({ merchantId: 'TEST_MERCHANT_ID' }),
            getConfig: sinon.stub().returns({
                merchantSoftware: {
                    companyName: 'Test Company',
                    productName: 'Test Product',
                    version: '1.0.0'
                }
            })
        };

        // Mock JPMCServiceHelper
        mockJPMCServiceHelper = {
            callWithTokenGeneration: sinon.stub()
        };

        // Mock JPMCPayloadBuilder
        mockJPMCPayloadBuilder = {
            buildCreatePaymentPayload: sinon.stub().returns({
                amount: 10000,
                currency: 'USD'
            }),
            buildCapturePayload: sinon.stub().returns({
                amount: 10000,
                currency: 'USD'
            }),
            buildRefundPayload: sinon.stub().returns({
                transactionReferenceId: 'TXN123',
                amount: 10000,
                currency: 'USD'
            })
        };

        // Mock JPMCPaymentOperations
        mockJPMCPaymentOperations = {
            performFraudCheck: sinon.stub(),
            performFraudCheckForCardSave: sinon.stub(),
            verifyPaymentInstrument: sinon.stub()
        };

        // Mock jpmcTransactionHelpers
        mockJpmcTransactionHelpers = {
            voidPayment: sinon.stub(),
            resolveJpmcTransactionId: sinon.stub().returns('AUTH123456')
        };

        // Mock JPMCMerchantResolver
        mockJPMCMerchantResolver = {
            resolve: sinon.stub().returns({ merchantId: 'TEST_MERCHANT_ID' }),
            resolveForOrder: sinon.stub().returns({ merchantId: 'TEST_MERCHANT_ID' }),
            toAccessTokenConfig: sinon.stub().returns({}),
            invalidateCache: sinon.stub()
        };

        // Load module with mocks
        JPMCPaymentHelper = proxyquire('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JPMCPaymentHelper', {
            'dw/system/Logger': mockLogger,
            'dw/system/Transaction': mockTransaction,
            'dw/order/PaymentTransaction': mockPaymentTransaction,
            'dw/util/UUIDUtils': mockUUID,
            '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
            '*/cartridge/scripts/services/JPMCServiceHelper': mockJPMCServiceHelper,
            '*/cartridge/scripts/helpers/JPMCPayloadBuilder': mockJPMCPayloadBuilder,
            '*/cartridge/scripts/helpers/JPMCPaymentOperations': mockJPMCPaymentOperations,
            '*/cartridge/scripts/helpers/JPMCTransactionHelpers': mockJpmcTransactionHelpers,
            '*/cartridge/scripts/helpers/JPMCMerchantResolver': mockJPMCMerchantResolver
        });
    });

    afterEach(function () {
        // Restore sinon spies
        if (mockTransaction && mockTransaction.wrap && mockTransaction.wrap.restore) {
            mockTransaction.wrap.restore();
        }
    });

    describe('createPayment', function () {
        var mockOrder;
        var mockPaymentInstrument;

        beforeEach(function () {
            mockOrder = new Order();
            mockPaymentInstrument = mockOrder.createPaymentInstrument('CREDIT_CARD', 100.00);
            mockPaymentInstrument.custom = {};
        });

        it('should return error when order is not provided', function () {
            var result = JPMCPaymentHelper.createPayment(null, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Order is not Present');
            assert.isNull(result.transactionId);
        });

        it('should return error when options or paymentInstrument is missing', function () {
            var result = JPMCPaymentHelper.createPayment(mockOrder, null);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Payment instrument is required');

            result = JPMCPaymentHelper.createPayment(mockOrder, {});
            assert.isFalse(result.success);
            assert.equal(result.error, 'Payment instrument is required');
        });

        it('should successfully create payment with valid inputs', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'TXN123456',
                    paymentId: 'PAY123456',
                    approvalCode: 'APP001',
                    transactionState: 'AUTHORIZED',
                    captureId: null
                }
            });

            var options = {
                paymentInstrument: mockPaymentInstrument,
                captureMethod: 'MANUAL',
                initiatorType: 'CUSTOMER',
                accountOnFile: false,
                isAmountFinal: true,
                accountNumberType: 'CARD',
                IPAddress: '127.0.0.1'
            };

            var result = JPMCPaymentHelper.createPayment(mockOrder, options);

            assert.isTrue(result.success);
            assert.equal(result.transactionId, 'TXN123456');
            assert.equal(result.paymentId, 'PAY123456');
            assert.equal(result.authorizationCode, 'APP001');
            assert.equal(result.transactionState, 'AUTHORIZED');
            assert.equal(result.captureMethod, 'MANUAL');
            assert.isNull(result.error);

            // Verify payload builder was called with correct params
            assert.isTrue(mockJPMCPayloadBuilder.buildCreatePaymentPayload.calledOnce);
            var buildArgs = mockJPMCPayloadBuilder.buildCreatePaymentPayload.firstCall.args[0];
            assert.equal(buildArgs.order, mockOrder);
            assert.equal(buildArgs.paymentInstrument, mockPaymentInstrument);
            assert.equal(buildArgs.captureMethod, 'MANUAL');

            // Verify service was called
            assert.isTrue(mockJPMCServiceHelper.callWithTokenGeneration.calledOnce);
            var serviceArgs = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];
            assert.equal(serviceArgs.serviceId, 'JPMCPaymentService');
            assert.equal(serviceArgs.method, 'POST');
            assert.isDefined(serviceArgs.headers['merchant-id']);
            assert.isDefined(serviceArgs.headers['request-id']);
        });

        it('should add order note when payment succeeds', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'TXN123456',
                    paymentId: 'PAY123456',
                    transactionState: 'AUTHORIZED',
                    approvalCode: 'APP001'
                }
            });

            var options = {
                paymentInstrument: mockPaymentInstrument,
                captureMethod: 'AUTO'
            };

            var result = JPMCPaymentHelper.createPayment(mockOrder, options);

            assert.isTrue(result.success);
            // Verify transaction.wrap was called
            assert.isTrue(mockTransaction.wrap.called);
            // Note: Order.addNote is called within Transaction.wrap callback
        });

        it('should handle payment failure response', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'DECLINED',
                    responseCode: 'INSUFFICIENT_FUNDS',
                    responseMessage: 'Insufficient funds'
                }
            });

            var options = {
                paymentInstrument: mockPaymentInstrument,
                captureMethod: 'MANUAL'
            };

            var result = JPMCPaymentHelper.createPayment(mockOrder, options);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Insufficient funds');
            assert.isDefined(result.data);
        });

        it('should handle service call failure', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false,
                error: 'Network timeout'
            });

            var options = {
                paymentInstrument: mockPaymentInstrument,
                captureMethod: 'MANUAL'
            };

            var result = JPMCPaymentHelper.createPayment(mockOrder, options);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Network timeout');
        });

        it('should handle exceptions gracefully', function () {
            mockJPMCPayloadBuilder.buildCreatePaymentPayload.throws(new Error('Invalid payload'));

            var options = {
                paymentInstrument: mockPaymentInstrument,
                captureMethod: 'MANUAL'
            };

            var result = JPMCPaymentHelper.createPayment(mockOrder, options);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Invalid payload');
        });
    });

    describe('capturePayment', function () {
        var mockOrder;
        var mockPaymentInstrument;
        var mockPaymentTxn;

        beforeEach(function () {
            mockOrder = new Order();
            mockPaymentInstrument = mockOrder.createPaymentInstrument('CREDIT_CARD', 100.00);
            mockPaymentTxn = mockPaymentInstrument.paymentTransaction;
            mockPaymentTxn.transactionID = 'TXN123456';
            mockPaymentTxn.custom = {
                jpmcAuthorizationId: 'AUTH123456'
            };
        });

        it('should return error when order is not provided', function () {
            var result = JPMCPaymentHelper.capturePayment(null, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Order is required');
        });

        it('should return error when no payment instruments found', function () {
            var emptyOrder = new Order();
            var result = JPMCPaymentHelper.capturePayment(emptyOrder, {});

            assert.isFalse(result.success);
            assert.include(result.error, 'No payment instruments found');
        });

        it('should return error when transaction context cannot be resolved for capture', function () {
            mockPaymentInstrument.paymentTransaction = null;
            mockJpmcTransactionHelpers.resolveJpmcTransactionId.returns(null);

            var result = JPMCPaymentHelper.capturePayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'JPMC transaction ID not found');
        });

        it('should return error when JPMC transaction ID not found (lines 177-179)', function () {
            mockJpmcTransactionHelpers.resolveJpmcTransactionId.returns(null);

            var result = JPMCPaymentHelper.capturePayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'JPMC transaction ID not found');
        });

        it('should return error when merchant ID not configured for capture (lines 197-199)', function () {
            mockJPMCMerchantResolver.resolveForOrder.returns({ merchantId: null });

            var result = JPMCPaymentHelper.capturePayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Merchant ID not configured');
        });

        it('should set PAYMENT_STATUS_PARTPAID when partial capture (line 261)', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'CLOSED',
                    transactionId: 'CAP-PARTIAL'
                }
            });

            // Capture less than total (100.00); pass 50.00
            var result = JPMCPaymentHelper.capturePayment(mockOrder, { amount: 50.00 });

            assert.isTrue(result.success);
            assert.equal(mockOrder.paymentStatus, mockOrder.PAYMENT_STATUS_PARTPAID);
        });

        it('should log warn when jpmcCaptureHistory is invalid JSON (line 261)', function () {
            mockPaymentTxn.custom.jpmcCaptureHistory = 'INVALID_JSON{{{';

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'CLOSED',
                    transactionId: 'CAP-BADHIST'
                }
            });

            var result = JPMCPaymentHelper.capturePayment(mockOrder, {});

            assert.isTrue(result.success);
            var logger = mockLogger.getLogger('JPMC', 'payment');
            var warned = logger.warnMessages.some(function (args) {
                return args.join(' ').indexOf('jpmcCaptureHistory') > -1;
            });
            assert.isTrue(warned, 'Should have warned about bad captureHistory');
        });

        it('should successfully capture payment with default amount', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'CLOSED',
                    transactionId: 'CAP123456',
                    approvalCode: 'APP001',
                    remainingAuthAmount: 0,
                    remainingRefundableAmount: 10000
                }
            });

            var result = JPMCPaymentHelper.capturePayment(mockOrder, {});

            // If test fails, show the error
            if (!result.success) {
                console.error('❌ Capture failed with error:', result.error);
            }

            assert.isTrue(result.success, 'Expected success but got error: ' + result.error);
            assert.equal(result.captureId, 'CAP123456');
            assert.equal(result.amount, 100.00);

            // Verify payload builder was called
            assert.isTrue(mockJPMCPayloadBuilder.buildCapturePayload.calledOnce);

            // Verify service was called with correct params
            assert.isTrue(mockJPMCServiceHelper.callWithTokenGeneration.calledOnce);
            var serviceArgs = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];
            assert.equal(serviceArgs.serviceId, 'JPMCPaymentCapture');
            assert.equal(serviceArgs.method, 'POST');
            assert.equal(serviceArgs.placeHolderId, 'AUTH123456');
        });

        it('should capture payment with custom amount', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'CLOSED',
                    transactionId: 'CAP123456'
                }
            });

            var result = JPMCPaymentHelper.capturePayment(mockOrder, { amount: 50.00 });

            assert.isTrue(result.success);
            assert.equal(result.amount, 50.00);

            // Verify payload builder received custom amount
            var buildArgs = mockJPMCPayloadBuilder.buildCapturePayload.firstCall.args[0];
            assert.equal(buildArgs.amount, 50.00);
        });

        it('should update payment transaction and order status on success', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'CLOSED',
                    transactionId: 'CAP123456',
                    remainingAuthAmount: 0,
                    remainingRefundableAmount: 10000
                }
            });

            var result = JPMCPaymentHelper.capturePayment(mockOrder, {});

            assert.isTrue(result.success);
            // Verify transaction.wrap was called
            assert.isTrue(mockTransaction.wrap.called);
        });

        it('should handle multi-capture scenario with capture history', function () {
            mockPaymentTxn.custom.jpmcCapturedAmount = 50.00;
            mockPaymentTxn.custom.jpmcCaptureHistory = JSON.stringify([
                {
                    transactionId: 'CAP001',
                    amount: 5000,
                    amountDisplay: '50.00',
                    currency: 'USD',
                    timestamp: '2024-01-01T00:00:00Z',
                    status: 'CLOSED'
                }
            ]);

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionState: 'CLOSED',
                    transactionId: 'CAP123456',
                    captures: [
                        { captureId: 'CAP001', transactionStatusCode: 'CLOSED' },
                        { captureId: 'CAP123456', transactionStatusCode: 'CLOSED' }
                    ]
                }
            });

            var result = JPMCPaymentHelper.capturePayment(mockOrder, { amount: 25.00 });

            assert.isTrue(result.success);
        });

        it('should handle capture failure response', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'FAILED',
                    responseCode: 'INVALID_AMOUNT',
                    responseMessage: 'Capture amount exceeds authorized amount'
                }
            });

            var result = JPMCPaymentHelper.capturePayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Capture amount exceeds authorized amount');
        });

        it('should handle service call failure', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false,
                error: 'Service unavailable'
            });

            var result = JPMCPaymentHelper.capturePayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Service unavailable');
        });

        it('should handle exceptions gracefully', function () {
            mockJPMCPayloadBuilder.buildCapturePayload.throws(new Error('Payload error'));

            var result = JPMCPaymentHelper.capturePayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Payload error');
        });
    });

    describe('refundPayment', function () {
        var mockOrder;
        var mockPaymentInstrument;
        var mockPaymentTxn;

        beforeEach(function () {
            mockOrder = new Order();
            mockPaymentInstrument = mockOrder.createPaymentInstrument('CREDIT_CARD', 100.00);
            mockPaymentTxn = mockPaymentInstrument.paymentTransaction;
            mockPaymentTxn.transactionID = 'TXN123456';
            mockPaymentTxn.custom = {
                jpmcAuthorizationId: 'AUTH123456',
                jpmcCapturedAmount: 100.00,
                jpmcRefundedAmount: 0,
                jpmcRemainingRefundableAmount: 100.00
            };
        });

        it('should return error when order is not provided', function () {
            var result = JPMCPaymentHelper.refundPayment(null, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Order is required');
        });

        it('should return error when amount is invalid', function () {
            var result = JPMCPaymentHelper.refundPayment(mockOrder, { amount: 0 });

            assert.isFalse(result.success);
            assert.equal(result.error, 'Refund amount must be greater than zero');

            result = JPMCPaymentHelper.refundPayment(mockOrder, { amount: -10 });
            assert.isFalse(result.success);
            assert.equal(result.error, 'Refund amount must be greater than zero');
        });

        it('should return error when no payment instruments found', function () {
            var emptyOrder = new Order();
            var result = JPMCPaymentHelper.refundPayment(emptyOrder, {});

            assert.isFalse(result.success);
            assert.include(result.error, 'No payment instruments found');
        });

        it('should return error when transaction context cannot be resolved for refund', function () {
            // Make getTransactionID return null so the !paymentTransaction.getTransactionID() check fires
            mockPaymentTxn.getTransactionID = sinon.stub().returns(null);
            mockJpmcTransactionHelpers.resolveJpmcTransactionId.returns(null);

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'JPMC transaction ID not found');
        });

        it('should return error when jpmcTransactionId is null (lines 365-367)', function () {
            mockJpmcTransactionHelpers.resolveJpmcTransactionId.returns(null);

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'JPMC transaction ID not found');
        });

        it('should return error when merchantId not configured for refund (lines 374-376)', function () {
            mockJPMCMerchantResolver.resolveForOrder.returns({ merchantId: null });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Merchant ID not configured');
        });

        it('should handle multi-capture with refundHistory per-capture tracking (lines 392-402)', function () {
            mockPaymentTxn.custom.jpmcCaptureHistory = JSON.stringify([
                { transactionId: 'CAP001', amount: 5000 },
                { transactionId: 'CAP002', amount: 5000 }
            ]);
            // Invalid JSON for refundHistory → hits catch at line 402
            mockPaymentTxn.custom.jpmcRefundHistory = 'INVALID_JSON{{{';

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF-MC-001',
                    transactionState: 'CLOSED',
                    amount: 3000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, { amount: 30.00 });

            assert.isTrue(result.success);
        });

        it('should handle single-capture history using captureHistory[0].transactionId (line 402)', function () {
            mockPaymentTxn.custom.jpmcCaptureHistory = JSON.stringify([
                { transactionId: 'CAP-ONLY-ONE', amount: 10000 }
            ]);

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF-SINGLE',
                    transactionState: 'CLOSED',
                    amount: 10000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isTrue(result.success);
            var buildArgs = mockJPMCPayloadBuilder.buildRefundPayload.firstCall.args[0];
            assert.equal(buildArgs.transactionReferenceId, 'CAP-ONLY-ONE');
        });

        it('should warn and fall back when jpmcCaptureHistory is invalid JSON (line 425)', function () {
            mockPaymentTxn.custom.jpmcCaptureHistory = 'BAD_JSON{{';

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF-BADCAP',
                    transactionState: 'CLOSED',
                    amount: 10000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isTrue(result.success);
        });

        it('should warn when existing jpmcRefundHistory is invalid JSON (line 517)', function () {
            // Set existing invalid refundHistory to trigger the catch when writing
            mockPaymentTxn.custom.jpmcRefundHistory = 'BAD_REFUND_JSON{{';

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF-BADHIST',
                    transactionState: 'CLOSED',
                    amount: 10000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isTrue(result.success);
        });

        it('should handle cents conversion and reject refund exceeding remaining (lines 421-425,441)', function () {
            // capturedDollarsForValidation=15000 > authDollars*2 (50*2=100 < 15000) → /100 = 150
            // refundedDollarsForValidation=2000 > 100 → /100 = 20
            // remainingRefundable = 150-20 = 130
            // refundAmount=200 > 130 → reject
            mockPaymentTxn.custom.jpmcCapturedAmount = 15000;
            mockPaymentTxn.custom.jpmcRefundedAmount = 2000;
            mockPaymentTxn.amount = { value: 50.00 };

            var result = JPMCPaymentHelper.refundPayment(mockOrder, { amount: 200.00 });

            assert.isFalse(result.success);
            assert.include(result.error, 'exceeds remaining refundable amount');
        });

        it('should return error when refund response is not SUCCESS (lines 514-517)', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'DECLINED',
                    responseMessage: 'Card declined'
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.include(result.error, 'Card declined');
        });

        it('should append reason to refund note (line 544)', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF-REASON',
                    transactionState: 'CLOSED',
                    amount: 10000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, { reason: 'Customer requested' });

            assert.isTrue(result.success);
        });

        it('should append remainingRefundableAmount to note (line 548)', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF-REMAIN',
                    transactionState: 'CLOSED',
                    amount: 5000,
                    remainingRefundableAmount: 5000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, { amount: 50.00 });

            assert.isTrue(result.success);
        });

        it('should set PAYMENT_STATUS_PARTPAID when partial refund (line 458-460)', function () {
            mockPaymentTxn.custom.jpmcCapturedAmount = 100.00;
            mockPaymentTxn.custom.jpmcRefundedAmount = 0;

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF-PART',
                    transactionState: 'CLOSED',
                    amount: 5000
                }
            });

            // After this refund: jpmcRefundedAmount = 0 + 50 = 50, capturedAmount=100 → partial
            var result = JPMCPaymentHelper.refundPayment(mockOrder, { amount: 50.00 });

            assert.isTrue(result.success);
            assert.equal(mockOrder.paymentStatus, mockOrder.PAYMENT_STATUS_PARTPAID);
        });

        it('should successfully refund full payment', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF123456',
                    transactionState: 'CLOSED',
                    amount: 10000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isTrue(result.success);
            assert.equal(result.refundId, 'REF123456');

            // Verify payload builder was called without amount (full refund)
            var buildArgs = mockJPMCPayloadBuilder.buildRefundPayload.firstCall.args[0];
            assert.equal(buildArgs.transactionReferenceId, 'AUTH123456');
            assert.isUndefined(buildArgs.amount);
        });

        it('should successfully refund partial payment', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF123456',
                    transactionState: 'CLOSED',
                    amount: 5000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, { amount: 50.00 });

            assert.isTrue(result.success);
            assert.equal(result.refundId, 'REF123456');
            assert.equal(result.amount, 50.00);
        });

        it('should reject refund when amount exceeds refundable', function () {
            mockPaymentTxn.custom.jpmcCapturedAmount = 100.00;
            mockPaymentTxn.custom.jpmcRefundedAmount = 80.00;
            mockPaymentTxn.amount = { value: 100.00 };

            var result = JPMCPaymentHelper.refundPayment(mockOrder, { amount: 30.00 });

            assert.isFalse(result.success);
            assert.include(result.error, 'exceeds remaining refundable amount');
        });

        it('should use explicit captureId when provided', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF123456',
                    transactionState: 'CLOSED',
                    amount: 5000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {
                amount: 50.00,
                captureId: 'CAP_SPECIFIC'
            });

            assert.isTrue(result.success);

            // Verify captureId was used as reference
            var buildArgs = mockJPMCPayloadBuilder.buildRefundPayload.firstCall.args[0];
            assert.equal(buildArgs.transactionReferenceId, 'CAP_SPECIFIC');
        });

        it('should handle multi-capture refund scenario', function () {
            mockPaymentTxn.custom.jpmcCaptureHistory = JSON.stringify([
                {
                    transactionId: 'CAP001',
                    amount: 5000,
                    amountDisplay: '50.00',
                    currency: 'USD'
                },
                {
                    transactionId: 'CAP002',
                    amount: 5000,
                    amountDisplay: '50.00',
                    currency: 'USD'
                }
            ]);

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF123456',
                    transactionState: 'CLOSED',
                    amount: 3000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, { amount: 30.00 });

            assert.isTrue(result.success);
        });

        it('should update payment transaction and order status on success', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'REF123456',
                    transactionState: 'CLOSED',
                    amount: 10000
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isTrue(result.success);
            // Verify transaction.wrap was called
            assert.isTrue(mockTransaction.wrap.called);
        });

        it('should handle refund failure response', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'FAILED',
                    responseCode: 'INVALID_TRANSACTION',
                    responseMessage: 'Transaction cannot be refunded'
                }
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Transaction cannot be refunded');
        });

        it('should handle service call failure', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false,
                error: 'Connection timeout'
            });

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Connection timeout');
        });

        it('should handle exceptions gracefully', function () {
            mockJPMCMerchantResolver.resolveForOrder.throws(new Error('Config error'));

            var result = JPMCPaymentHelper.refundPayment(mockOrder, {});

            assert.isFalse(result.success);
            assert.equal(result.error, 'Config error');
        });
    });

    describe('module exports', function () {
        it('should export all required functions', function () {
            assert.isFunction(JPMCPaymentHelper.createPayment);
            assert.isFunction(JPMCPaymentHelper.capturePayment);
            assert.isFunction(JPMCPaymentHelper.refundPayment);
            assert.isFunction(JPMCPaymentHelper.voidPayment);
            assert.isFunction(JPMCPaymentHelper.performFraudCheck);
            assert.isFunction(JPMCPaymentHelper.performFraudCheckForCardSave);
            assert.isFunction(JPMCPaymentHelper.verifyPaymentInstrument);
        });

        it('should re-export voidPayment from jpmcTransactionHelpers', function () {
            assert.equal(JPMCPaymentHelper.voidPayment, mockJpmcTransactionHelpers.voidPayment);
        });

        it('should re-export fraud check functions from JPMCPaymentOperations', function () {
            assert.equal(JPMCPaymentHelper.performFraudCheck, mockJPMCPaymentOperations.performFraudCheck);
            assert.equal(JPMCPaymentHelper.performFraudCheckForCardSave, mockJPMCPaymentOperations.performFraudCheckForCardSave);
            assert.equal(JPMCPaymentHelper.verifyPaymentInstrument, mockJPMCPaymentOperations.verifyPaymentInstrument);
        });
    });
});
