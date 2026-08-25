'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

// Load mocks
var LoggerMock = require('../../../../mocks/dw/system/Logger');
var TransactionMock = require('../../../../mocks/dw/system/Transaction');
var SiteMock = require('../../../../mocks/dw/system/Site');
var OrderMock = require('../../../../mocks/dw/order/Order');
var PaymentInstrumentMock = require('../../../../mocks/dw/order/PaymentInstrument');

describe('JPMCPaymentOperations', function () {
    var JPMCPaymentOperations;
    var mockUUID;
    var mockJPMCServiceHelper;
    var mockJPMCPayloadBuilder;
    var mockJPMCConfig;
    var mockJPMCMerchantResolver;
    var mockOrder;
    var mockPaymentInstrument;
    var sandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();

        // Reset all mocks
        LoggerMock.reset();
        TransactionMock.reset();
        SiteMock.reset();
        OrderMock.reset();
        PaymentInstrumentMock.reset();

        // Setup UUID mock
        mockUUID = {
            createUUID: sandbox.stub().returns('test-uuid-12345'),
            toString: sandbox.stub().returns('test-uuid-12345')
        };

        // Setup service helper mock
        mockJPMCServiceHelper = {
            callWithTokenGeneration: sandbox.stub()
        };

        // Setup payload builder mock
        mockJPMCPayloadBuilder = {
            buildFraudCheckPayload: sandbox.stub().returns({ fraudCheckData: 'test-payload' }),
            buildFraudCheckForCardSavePayload: sandbox.stub().returns({ cardSaveFraudData: 'test-payload' }),
            buildVerificationPayload: sandbox.stub().returns({ verificationData: 'test-payload' })
        };

        // Setup config mock
        mockJPMCConfig = {
            getConfig: sandbox.stub().returns({
                merchantId: 'test-merchant-id',
                platformId: 'test-platform-id'
            })
        };

        // Setup merchant resolver mock
        mockJPMCMerchantResolver = {
            resolve: sandbox.stub().returns({
                merchantId: 'test-merchant-id',
                platformId: 'test-platform-id'
            }),
            resolveForOrder: sandbox.stub().returns({
                merchantId: 'test-merchant-id',
                platformId: 'test-platform-id'
            }),
            toAccessTokenConfig: sandbox.stub().returns({}),
            invalidateCache: sandbox.stub()
        };

        // Setup mock order and payment instrument
        mockOrder = OrderMock.create();
        mockPaymentInstrument = PaymentInstrumentMock.create();
        sandbox.stub(mockOrder, 'getPaymentInstruments').returns([mockPaymentInstrument]);

        // Stub Transaction.wrap to track calls while still executing callbacks
        sandbox.stub(TransactionMock, 'wrap').callsFake(function (callback) {
            return callback();
        });

        // Load module with mocks
        JPMCPaymentOperations = proxyquire('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JPMCPaymentOperations', {
            'dw/system/Logger': LoggerMock,
            'dw/system/Transaction': TransactionMock,
            'dw/system/Site': SiteMock,
            'dw/util/UUIDUtils': mockUUID,
            '*/cartridge/scripts/services/JPMCServiceHelper': mockJPMCServiceHelper,
            '*/cartridge/scripts/helpers/JPMCPayloadBuilder': mockJPMCPayloadBuilder,
            '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
            '*/cartridge/scripts/helpers/JPMCConstants': {
                FALLBACK_IP_ADDRESS: '0.0.0.0',
                FALLBACK_USER_AGENT: 'Unknown',
                ACCOUNT_NUMBER_TYPE_PIE: 'SAFETECH_PAGE_ENCRYPTION'
            },
            '*/cartridge/scripts/helpers/JPMCMerchantResolver': mockJPMCMerchantResolver
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

    // ========================================================================
    // performFraudCheck() Tests
    // ========================================================================

    describe('performFraudCheck()', function () {
        it('should return error when basketOrOrder is null', function () {
            var result = JPMCPaymentOperations.performFraudCheck(null);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Basket or order is required');
            assert.isNull(result.fraudCheckId);
        });

        it('should return error when basketOrOrder is undefined', function () {
            var result = JPMCPaymentOperations.performFraudCheck(undefined);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Basket or order is required');
        });

        it('should return error when no payment instruments found', function () {
            mockOrder.getPaymentInstruments.returns([]);

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isFalse(result.success);
            assert.equal(result.error, 'No payment instruments found');
        });

        it('should use provided payment instrument from options', function () {
            var customPI = PaymentInstrumentMock.create();
            var options = { paymentInstrument: customPI };

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'fraud-txn-123'
                }
            });

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder, options);

            assert.isTrue(mockJPMCPayloadBuilder.buildFraudCheckPayload.calledOnce);
            var buildCall = mockJPMCPayloadBuilder.buildFraudCheckPayload.firstCall.args[0];
            assert.equal(buildCall.paymentInstrument, customPI);
        });

        it('should return error when merchant ID not configured', function () {
            mockJPMCMerchantResolver.resolve.returns(null);

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Merchant ID not configured');
        });

        it('should return error when config lacks merchantId', function () {
            mockJPMCMerchantResolver.resolve.returns({ platformId: 'test-platform' });

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Merchant ID not configured');
        });

        it('should build fraud check payload with correct parameters', function () {
            var options = {
                deviceIPAddress: '192.168.1.1',
                fraudScore: { sessionId: 'kount-session-123', score: 75 },
                accountNumberType: 'SAFETECH_PAGE_ENCRYPTION'
            };

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS', transactionId: 'fraud-123' }
            });

            JPMCPaymentOperations.performFraudCheck(mockOrder, options);

            assert.isTrue(mockJPMCPayloadBuilder.buildFraudCheckPayload.calledOnce);
            var payload = mockJPMCPayloadBuilder.buildFraudCheckPayload.firstCall.args[0];
            assert.equal(payload.basketOrOrder, mockOrder);
            assert.equal(payload.paymentInstrument, mockPaymentInstrument);
            assert.equal(payload.deviceIPAddress, '192.168.1.1');
            assert.deepEqual(payload.fraudScore, { sessionId: 'kount-session-123', score: 75 });
            assert.equal(payload.accountNumberType, 'SAFETECH_PAGE_ENCRYPTION');
        });

        it('should call service with correct headers including platform-id', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS', transactionId: 'fraud-123' }
            });

            JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isTrue(mockJPMCServiceHelper.callWithTokenGeneration.calledOnce);
            var serviceCall = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];

            assert.equal(serviceCall.tokenServiceId, 'JPMCAccessToken');
            assert.equal(serviceCall.serviceId, 'JPMCFraudCheck');
            assert.equal(serviceCall.method, 'POST');
            assert.equal(serviceCall.headers['merchant-id'], 'test-merchant-id');
            assert.equal(serviceCall.headers['platform-id'], 'test-platform-id');
            assert.match(serviceCall.headers['request-id'], /^fraud-/);
        });

        it('should not include platform-id header when not configured', function () {
            mockJPMCConfig.getConfig.returns({ merchantId: 'test-merchant-id' });
            mockJPMCMerchantResolver.resolve.returns({ merchantId: 'test-merchant-id' });

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS', transactionId: 'fraud-123' }
            });

            JPMCPaymentOperations.performFraudCheck(mockOrder);

            var serviceCall = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];
            assert.isUndefined(serviceCall.headers['platform-id']);
        });

        it('should return success with transaction data when fraud check succeeds', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'fraud-txn-123',
                    riskElement: { score: 10, level: 'LOW' },
                    riskDecision: { action: 'ACCEPT', reason: 'Low risk' }
                }
            });

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isTrue(result.success);
            assert.equal(result.transactionId, 'fraud-txn-123');
            assert.deepEqual(result.riskElement, { score: 10, level: 'LOW' });
            assert.deepEqual(result.riskDecision, { action: 'ACCEPT', reason: 'Low risk' });
            assert.isNull(result.error);
        });

        it('should handle APPROVED status as success', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'APPROVED',
                    transactionId: 'fraud-txn-456',
                    riskElement: { level: 'LOW' }
                }
            });

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isTrue(result.success);
            assert.equal(result.transactionId, 'fraud-txn-456');
        });

        it('should save fraud data to order when orderNo provided and fraud check succeeds', function () {
            var options = {
                orderNo: 'ORDER-12345',
                fraudScore: { sessionId: 'kount-session-789' }
            };

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'fraud-txn-999',
                    riskElement: { level: 'LOW' },
                    riskDecision: { action: 'ACCEPT' }
                }
            });

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder, options);

            assert.isTrue(result.success);
            assert.isTrue(TransactionMock.wrap.calledOnce);

            // Verify the transaction callback was executed
            var transactionCallback = TransactionMock.wrap.firstCall.args[0];
            transactionCallback();

            assert.equal(mockOrder.custom.jpmcFraudTransactionId, 'fraud-txn-999');
            assert.equal(mockOrder.custom.jpmcFraudRiskElement, JSON.stringify({ level: 'LOW' }));
            assert.equal(mockOrder.custom.jpmcFraudRiskDecision, JSON.stringify({ action: 'ACCEPT' }));
            assert.equal(mockOrder.custom.kountSessionId, 'kount-session-789');
            assert.instanceOf(mockOrder.custom.jpmcFraudCheckDate, Date);
        });

        it('should save fraud response to order when orderNo provided', function () {
            var options = { orderNo: 'ORDER-12345' };

            var fraudData = {
                responseStatus: 'SUCCESS',
                transactionId: 'fraud-txn-111',
                riskElement: { level: 'MEDIUM' },
                additionalData: { test: 'value' }
            };

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: fraudData
            });

            JPMCPaymentOperations.performFraudCheck(mockOrder, options);

            var transactionCallback = TransactionMock.wrap.firstCall.args[0];
            transactionCallback();

            assert.equal(mockOrder.custom.jpmcFraudResponse, JSON.stringify(fraudData));
        });

        it('should handle null riskDecision gracefully', function () {
            var options = { orderNo: 'ORDER-12345' };

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'fraud-txn-222',
                    riskElement: { level: 'LOW' },
                    riskDecision: null
                }
            });

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder, options);

            assert.isTrue(result.success);
            assert.isNull(result.riskDecision);

            var transactionCallback = TransactionMock.wrap.firstCall.args[0];
            transactionCallback();

            // When riskDecision is null, it should not be set on the order
            assert.isUndefined(mockOrder.custom.jpmcFraudRiskDecision);
        });

        it('should return error when fraud check is flagged', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'DECLINED',
                    responseCode: 'FRAUD_DETECTED',
                    responseMessage: 'High risk transaction detected',
                    riskLevel: 'HIGH'
                }
            });

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isFalse(result.success);
            assert.equal(result.error, 'High risk transaction detected');
            assert.equal(result.riskLevel, 'HIGH');
            assert.isNotNull(result.data);
        });

        it('should save flagged fraud response to order when orderNo provided', function () {
            var options = { orderNo: 'ORDER-12345' };

            var fraudData = {
                responseStatus: 'REVIEW',
                responseCode: 'MANUAL_REVIEW',
                responseMessage: 'Requires manual review',
                riskLevel: 'MEDIUM'
            };

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: fraudData
            });

            JPMCPaymentOperations.performFraudCheck(mockOrder, options);

            var transactionCallback = TransactionMock.wrap.firstCall.args[0];
            transactionCallback();

            assert.equal(mockOrder.custom.jpmcFraudResponse, JSON.stringify(fraudData));
            assert.instanceOf(mockOrder.custom.jpmcFraudCheckDate, Date);
        });

        it('should default riskLevel to UNKNOWN when not provided', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'FAILED',
                    responseMessage: 'Fraud check failed'
                }
            });

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isFalse(result.success);
            assert.equal(result.riskLevel, 'UNKNOWN');
        });

        it('should return error when service call fails', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false,
                error: 'Network timeout',
                data: { errorDetails: 'Connection failed' }
            });

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Network timeout');
        });

        it('should save service error data to order when orderNo provided', function () {
            var options = { orderNo: 'ORDER-12345' };

            var errorData = { errorDetails: 'Service unavailable', errorCode: 503 };

            var serviceResponse = {
                success: false,
                error: 'Service unavailable',
                data: errorData
            };

            mockJPMCServiceHelper.callWithTokenGeneration.returns(serviceResponse);

            JPMCPaymentOperations.performFraudCheck(mockOrder, options);

            var transactionCallback = TransactionMock.wrap.firstCall.args[0];
            transactionCallback();

            assert.equal(mockOrder.custom.jpmcFraudResponse, JSON.stringify(serviceResponse));
            assert.instanceOf(mockOrder.custom.jpmcFraudCheckDate, Date);
        });

        it('should handle exception during fraud check', function () {
            mockJPMCPayloadBuilder.buildFraudCheckPayload.throws(new Error('Payload build error'));

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Payload build error');
        });

        it('should handle non-Error exception', function () {
            mockJPMCPayloadBuilder.buildFraudCheckPayload.throws('String error');

            var result = JPMCPaymentOperations.performFraudCheck(mockOrder);

            assert.isFalse(result.success);
            // Sinon wraps thrown strings
            assert.include(result.error, 'String error');
        });
    });

    // ========================================================================
    // performFraudCheckForCardSave() Tests
    // ========================================================================

    describe('performFraudCheckForCardSave()', function () {
        var mockCardData;

        beforeEach(function () {
            mockCardData = {
                accountNumber: 'ENC_CARD_123456',
                expirationMonth: '12',
                expirationYear: '2025'
            };

            // Setup global customer and session
            global.customer = {
                authenticated: true,
                profile: {
                    email: 'customer@test.com'
                }
            };

            global.session = {
                currency: {
                    currencyCode: 'USD'
                }
            };

            global.request = {
                getHttpRemoteAddress: sandbox.stub().returns('192.168.1.100'),
                httpUserAgent: 'Mozilla/5.0 Test Browser'
            };
        });

        afterEach(function () {
            delete global.customer;
            delete global.session;
            delete global.request;
        });

        it('should return error when cardData is null', function () {
            var result = JPMCPaymentOperations.performFraudCheckForCardSave(null);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Card data is required for fraud check');
        });

        it('should return error when cardData is undefined', function () {
            var result = JPMCPaymentOperations.performFraudCheckForCardSave(undefined);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Card data is required for fraud check');
        });

        it('should return error when accountNumber is missing', function () {
            var invalidCard = { expirationMonth: '12', expirationYear: '2025' };

            var result = JPMCPaymentOperations.performFraudCheckForCardSave(invalidCard);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Card data is required for fraud check');
        });

        it('should return error when merchant ID not configured', function () {
            mockJPMCMerchantResolver.resolve.returns(null);

            var result = JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Merchant ID not configured');
        });

        it('should build payload with authenticated customer email', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS', riskElement: 'LOW' }
            });

            JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            assert.isTrue(mockJPMCPayloadBuilder.buildFraudCheckForCardSavePayload.calledOnce);
            var payload = mockJPMCPayloadBuilder.buildFraudCheckForCardSavePayload.firstCall.args[0];
            assert.equal(payload.cardData, mockCardData);
            assert.equal(payload.currency, 'USD');
            assert.equal(payload.customerEmail, 'customer@test.com');
            assert.equal(payload.deviceIPAddress, '192.168.1.100');
            assert.equal(payload.browserInformation, 'Mozilla/5.0 Test Browser');
        });

        it('should use default currency when session currency not available', function () {
            delete global.session.currency;
            sandbox.stub(SiteMock.getCurrent(), 'getDefaultCurrency').returns('EUR');

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS' }
            });

            JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            var payload = mockJPMCPayloadBuilder.buildFraudCheckForCardSavePayload.firstCall.args[0];
            assert.equal(payload.currency, 'EUR');
        });

        it('should handle unauthenticated customer', function () {
            global.customer.authenticated = false;

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS' }
            });

            JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            var payload = mockJPMCPayloadBuilder.buildFraudCheckForCardSavePayload.firstCall.args[0];
            assert.isNull(payload.customerEmail);
        });

        it('should use fallback IP address when remote address not available', function () {
            global.request.getHttpRemoteAddress.returns(null);

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS' }
            });

            JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            var payload = mockJPMCPayloadBuilder.buildFraudCheckForCardSavePayload.firstCall.args[0];
            assert.equal(payload.deviceIPAddress, '0.0.0.0');
        });

        it('should use Unknown browser when user agent not available', function () {
            global.request.httpUserAgent = null;

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS' }
            });

            JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            var payload = mockJPMCPayloadBuilder.buildFraudCheckForCardSavePayload.firstCall.args[0];
            assert.equal(payload.browserInformation, 'Unknown');
        });

        it('should include kountSessionId from options', function () {
            var options = {
                kountSessionId: 'kount-session-xyz',
                accountNumberType: 'SAFETECH_PAGE_ENCRYPTION'
            };

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS' }
            });

            JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData, options);

            var payload = mockJPMCPayloadBuilder.buildFraudCheckForCardSavePayload.firstCall.args[0];
            assert.equal(payload.kountSessionId, 'kount-session-xyz');
            assert.equal(payload.accountNumberType, 'SAFETECH_PAGE_ENCRYPTION');
        });

        it('should call service with correct headers', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS' }
            });

            JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            assert.isTrue(mockJPMCServiceHelper.callWithTokenGeneration.calledOnce);
            var serviceCall = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];

            assert.equal(serviceCall.tokenServiceId, 'JPMCAccessToken');
            assert.equal(serviceCall.serviceId, 'JPMCFraudCheck');
            assert.equal(serviceCall.method, 'POST');
            assert.equal(serviceCall.headers['merchant-id'], 'test-merchant-id');
            assert.match(serviceCall.headers['request-id'], /^fraud-/);
        });

        it('should return success when fraud check succeeds', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    riskDecision: { action: 'ACCEPT' },
                    riskElement: 'LOW'
                }
            });

            var result = JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            assert.isTrue(result.success);
            assert.deepEqual(result.riskDecision, { action: 'ACCEPT' });
            assert.equal(result.riskElement, 'LOW');
            assert.isNull(result.error);
        });

        it('should handle APPROVED status as success', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'APPROVED',
                    riskElement: 'LOW'
                }
            });

            var result = JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            assert.isTrue(result.success);
            assert.equal(result.riskElement, 'LOW');
        });

        it('should return error when fraud check is flagged', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'DECLINED',
                    responseCode: 'HIGH_RISK',
                    responseMessage: 'Card flagged for fraud',
                    riskElement: 'HIGH'
                }
            });

            var result = JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Card flagged for fraud');
            assert.equal(result.riskElement, 'HIGH');
        });

        it('should default riskElement to UNKNOWN when not provided in error', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'FAILED',
                    responseMessage: 'Fraud check failed'
                }
            });

            var result = JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.riskElement, 'UNKNOWN');
        });

        it('should return error when service call fails', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false,
                error: 'Service timeout'
            });

            var result = JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Service timeout');
        });

        it('should handle exception during fraud check', function () {
            mockJPMCPayloadBuilder.buildFraudCheckForCardSavePayload.throws(new Error('Build error'));

            var result = JPMCPaymentOperations.performFraudCheckForCardSave(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Build error');
        });
    });

    // ========================================================================
    // verifyPaymentInstrument() Tests
    // ========================================================================

    describe('verifyPaymentInstrument()', function () {
        var mockCardData;

        beforeEach(function () {
            mockCardData = {
                accountNumber: 'ENC_CARD_654321',
                expirationMonth: '06',
                expirationYear: '2026'
            };
        });

        it('should return error when cardData is null', function () {
            var result = JPMCPaymentOperations.verifyPaymentInstrument(null);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Card account number is required');
        });

        it('should return error when accountNumber is missing', function () {
            var invalidCard = { expirationMonth: '06', expirationYear: '2026' };

            var result = JPMCPaymentOperations.verifyPaymentInstrument(invalidCard);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Card account number is required');
        });

        it('should return error when expirationMonth is missing', function () {
            var invalidCard = { accountNumber: 'ENC_CARD_123', expirationYear: '2026' };

            var result = JPMCPaymentOperations.verifyPaymentInstrument(invalidCard);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Card expiration month and year are required');
        });

        it('should return error when expirationYear is missing', function () {
            var invalidCard = { accountNumber: 'ENC_CARD_123', expirationMonth: '06' };

            var result = JPMCPaymentOperations.verifyPaymentInstrument(invalidCard);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Card expiration month and year are required');
        });

        it('should return error when merchant ID not configured', function () {
            mockJPMCMerchantResolver.resolve.returns(null);

            var result = JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Merchant ID not configured');
        });

        it('should build verification payload with default currency', function () {
            sandbox.stub(SiteMock.getCurrent(), 'getDefaultCurrency').returns('GBP');

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS', transactionId: 'verify-123' }
            });

            JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isTrue(mockJPMCPayloadBuilder.buildVerificationPayload.calledOnce);
            var payload = mockJPMCPayloadBuilder.buildVerificationPayload.firstCall.args[0];
            assert.equal(payload.cardData, mockCardData);
            assert.equal(payload.currency, 'GBP');
            assert.equal(payload.accountNumberType, 'SAFETECH_PAGE_ENCRYPTION');
        });

        it('should use currency from options when provided', function () {
            var options = { currency: 'CAD' };

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS' }
            });

            JPMCPaymentOperations.verifyPaymentInstrument(mockCardData, options);

            var payload = mockJPMCPayloadBuilder.buildVerificationPayload.firstCall.args[0];
            assert.equal(payload.currency, 'CAD');
        });

        it('should include all options in payload', function () {
            var options = {
                currency: 'EUR',
                accountNumberType: 'PAN',
                billingAddress: { street: '123 Main St', city: 'Test City' },
                email: 'verify@test.com',
                authentication: { eci: '05', cavv: 'test-cavv' },
                walletProvider: 'APPLE_PAY',
                accountOnFile: true
            };

            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS' }
            });

            JPMCPaymentOperations.verifyPaymentInstrument(mockCardData, options);

            var payload = mockJPMCPayloadBuilder.buildVerificationPayload.firstCall.args[0];
            assert.equal(payload.cardData, mockCardData);
            assert.equal(payload.currency, 'EUR');
            assert.equal(payload.accountNumberType, 'PAN');
            assert.deepEqual(payload.billingAddress, { street: '123 Main St', city: 'Test City' });
            assert.equal(payload.email, 'verify@test.com');
            assert.deepEqual(payload.authentication, { eci: '05', cavv: 'test-cavv' });
            assert.equal(payload.walletProvider, 'APPLE_PAY');
            assert.isTrue(payload.accountOnFile);
        });

        it('should call service with correct headers', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: { responseStatus: 'SUCCESS' }
            });

            JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isTrue(mockJPMCServiceHelper.callWithTokenGeneration.calledOnce);
            var serviceCall = mockJPMCServiceHelper.callWithTokenGeneration.firstCall.args[0];

            assert.equal(serviceCall.tokenServiceId, 'JPMCAccessToken');
            assert.equal(serviceCall.serviceId, 'JPMCVerification');
            assert.equal(serviceCall.method, 'POST');
            assert.equal(serviceCall.headers['merchant-id'], 'test-merchant-id');
            assert.equal(serviceCall.headers['platform-id'], 'test-platform-id');
            assert.match(serviceCall.headers['request-id'], /^verify-/);
        });

        it('should return success when verification succeeds', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS',
                    transactionId: 'verify-txn-789',
                    verificationResult: 'VERIFIED'
                }
            });

            var result = JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isTrue(result.success);
            assert.equal(result.verificationId, 'verify-txn-789');
            assert.equal(result.responseStatus, 'SUCCESS');
            assert.isNull(result.error);
            assert.deepEqual(result.data, {
                responseStatus: 'SUCCESS',
                transactionId: 'verify-txn-789',
                verificationResult: 'VERIFIED'
            });
        });

        it('should handle APPROVED status as success', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'APPROVED',
                    transactionId: 'verify-txn-999'
                }
            });

            var result = JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isTrue(result.success);
            assert.equal(result.verificationId, 'verify-txn-999');
            assert.equal(result.responseStatus, 'APPROVED');
        });

        it('should handle null transactionId gracefully', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'SUCCESS'
                }
            });

            var result = JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isTrue(result.success);
            assert.isNull(result.verificationId);
        });

        it('should return error when verification fails', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'DECLINED',
                    responseCode: 'INVALID_CARD',
                    responseMessage: 'Card verification failed'
                }
            });

            var result = JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Card verification failed');
            assert.equal(result.responseStatus, 'DECLINED');
        });

        it('should use default error message when responseMessage not provided', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: true,
                data: {
                    responseStatus: 'FAILED',
                    responseCode: 'UNKNOWN_ERROR'
                }
            });

            var result = JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Verification failed: FAILED');
        });

        it('should return error when service call fails', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false,
                error: 'Connection timeout'
            });

            var result = JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Connection timeout');
        });

        it('should use default error message when service error not provided', function () {
            mockJPMCServiceHelper.callWithTokenGeneration.returns({
                success: false
            });

            var result = JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Verification service call failed');
        });

        it('should handle exception during verification', function () {
            mockJPMCPayloadBuilder.buildVerificationPayload.throws(new Error('Payload error'));

            var result = JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isFalse(result.success);
            assert.equal(result.error, 'Payload error');
        });

        it('should handle non-Error exception', function () {
            mockJPMCPayloadBuilder.buildVerificationPayload.throws('String exception');

            var result = JPMCPaymentOperations.verifyPaymentInstrument(mockCardData);

            assert.isFalse(result.success);
            // Sinon wraps thrown strings
            assert.include(result.error, 'String exception');
        });
    });
});
