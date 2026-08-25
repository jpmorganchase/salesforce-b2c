'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('int_jpmc_sfra/scripts/hooks/payment/processor/fraudDetection', function () {
    var fraudDetection;
    var mockLogger;
    var mockTransaction;
    var mockJPMCConfig;
    var mockJPMCPaymentHelper;
    var mockBasket;
    var mockPaymentInstrument;
    var defaultOptions;

    beforeEach(function () {
        // Reset all mocks
        mockLogger = require('../../../../../../../test/mocks/dw/system/Logger');
        mockLogger.resetAllLoggers();

        mockTransaction = require('../../../../../../../test/mocks/dw/system/Transaction');
        mockTransaction.reset();
        sinon.spy(mockTransaction, 'wrap');

        // Mock global request object
        global.request = {
            getHttpRemoteAddress: sinon.stub().returns('192.168.1.1'),
            httpUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        // Create mock basket
        var Order = require('../../../../../../../test/mocks/dw/order/Order');
        Order.resetMock();
        mockBasket = new Order();
        mockBasket.orderNo = 'TEST-ORDER-001';
        mockBasket.custom = {};

        // Create mock payment instrument
        var PaymentInstrument = require('../../../../../../../test/mocks/dw/order/PaymentInstrument');
        PaymentInstrument.reset();
        mockPaymentInstrument = new PaymentInstrument();
        mockPaymentInstrument.custom = {};

        // Default options with enabled fraud check
        defaultOptions = {
            resolvedConfig: {
                enableFraudCheck: true
            }
        };

        // Mock JPMCConfig
        mockJPMCConfig = {
            isFraudCheckEnabled: sinon.stub().returns(true)
        };

        // Mock JPMCPaymentHelper
        mockJPMCPaymentHelper = {
            performFraudCheck: sinon.stub().returns({
                success: true,
                riskDecision: {
                    fraudRiskScore: 25,
                    fraudRuleAction: 'A'
                },
                riskElement: 'LOW'
            })
        };

        // Load module with mocks
        var fraudDetectionModule = proxyquire('../../../../../../../cartridges/int_jpmc_sfra/cartridge/scripts/hooks/payment/processor/fraudDetection', {
            'dw/system/Transaction': mockTransaction,
            'dw/system/Logger': mockLogger,
            '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
            '*/cartridge/scripts/helpers/JPMCPaymentHelper': mockJPMCPaymentHelper,
            '*/cartridge/scripts/helpers/JPMCConstants': {
                FALLBACK_USER_AGENT: 'Unknown',
                ACCOUNT_NUMBER_TYPE_PIE: 'SAFETECH_PAGE_ENCRYPTION'
            }
        });

        fraudDetection = fraudDetectionModule.fraudDetection;
    });

    afterEach(function () {
        sinon.restore();
        delete global.request;
    });

    // ==================== Input Validation Tests ====================

    describe('Input Validation', function () {
        it('should return fail when basket/order is null', function () {
            var result = fraudDetection(null, mockPaymentInstrument);

            assert.equal(result.status, 'fail');
            assert.equal(result.errorCode, 'INVALID_INPUT');
            assert.include(result.errorMessage, 'Basket or order is required');
        });

        it('should return fail when basket/order is undefined', function () {
            var result = fraudDetection(undefined, mockPaymentInstrument);

            assert.equal(result.status, 'fail');
            assert.equal(result.errorCode, 'INVALID_INPUT');
        });

        it('should return fail when payment instrument is null', function () {
            var result = fraudDetection(mockBasket, null);

            assert.equal(result.status, 'fail');
            assert.equal(result.errorCode, 'INVALID_INPUT');
            assert.include(result.errorMessage, 'Payment instrument is required');
        });

        it('should return fail when payment instrument is undefined', function () {
            var result = fraudDetection(mockBasket, undefined);

            assert.equal(result.status, 'fail');
            assert.equal(result.errorCode, 'INVALID_INPUT');
        });
    });

    // ==================== Fraud Check Disabled Tests ====================

    describe('Fraud Check Disabled', function () {
        it('should return success when fraud check is disabled', function () {
            mockJPMCConfig.isFraudCheckEnabled.returns(false);

            // Pass options without enableFraudCheck
            var result = fraudDetection(mockBasket, mockPaymentInstrument, {
                resolvedConfig: {
                    enableFraudCheck: false
                }
            });

            assert.equal(result.status, 'success');
            assert.include(result.errorMessage, 'Fraud check disabled');
            assert.isFalse(mockJPMCPaymentHelper.performFraudCheck.called);
        });
    });

    // ==================== Fraud Rule Action Tests ====================

    describe('Fraud Rule Actions', function () {
        it('should return success for approved transaction (Action: A)', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {
                    fraudRiskScore: 15,
                    fraudRuleAction: 'A'
                },
                riskElement: 'LOW'
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'success');
            assert.equal(result.action, 'APPROVE');
            assert.equal(result.fraudRuleAction, 'A');
            assert.equal(result.fraudScore, 15);
            assert.equal(result.riskLevel, 'LOW');
        });

        it('should return fail for declined transaction (Action: D)', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {
                    fraudRiskScore: 95,
                    fraudRuleAction: 'D'
                },
                riskElement: 'HIGH'
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'fail');
            assert.equal(result.action, 'DECLINE');
            assert.equal(result.errorCode, 'FRAUD_DECLINED');
            assert.include(result.errorMessage, 'declined due to fraud');
            assert.equal(result.fraudRuleAction, 'D');
            assert.equal(result.fraudScore, 95);
        });

        it('should return flag for manager review (Action: E)', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {
                    fraudRiskScore: 65,
                    fraudRuleAction: 'E'
                },
                riskElement: 'MEDIUM'
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'flag');
            assert.equal(result.action, 'MANAGER_REVIEW');
            assert.equal(result.errorCode, 'FRAUD_REVIEW');
            assert.include(result.errorMessage, 'flagged for review');
            assert.equal(result.fraudRuleAction, 'E');
        });

        it('should return flag for review (Action: R)', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {
                    fraudRiskScore: 55,
                    fraudRuleAction: 'R'
                },
                riskElement: 'MEDIUM'
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'flag');
            assert.equal(result.action, 'REVIEW');
            assert.equal(result.errorCode, 'FRAUD_REVIEW');
            assert.equal(result.fraudRuleAction, 'R');
        });

        it('should return flag for REVIEW action', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {
                    fraudRiskScore: 35,
                    fraudRuleAction: 'X'
                },
                riskElement: 'LOW'
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'flag');
            assert.equal(result.action, 'REVIEW');
            assert.equal(result.fraudRuleAction, 'X');
        });

        it('should return success when no fraud rule action provided', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {
                    fraudRiskScore: 25
                },
                riskElement: 'LOW'
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'success');
            assert.equal(result.action, 'NO_ACTION');
            assert.isNull(result.fraudRuleAction);
        });
    });

    // ==================== Options Handling Tests ====================

    describe('Options Handling', function () {
        it('should pass orderNo to fraud check options', function () {
            var options = {
                resolvedConfig: { enableFraudCheck: true },
                orderNo: 'TEST-ORDER-123'
            };

            fraudDetection(mockBasket, mockPaymentInstrument, options);

            assert.isTrue(mockJPMCPaymentHelper.performFraudCheck.calledOnce);
            var fraudCheckOptions = mockJPMCPaymentHelper.performFraudCheck.firstCall.args[1];
            assert.equal(fraudCheckOptions.orderNo, 'TEST-ORDER-123');
        });

        it('should use provided accountNumberType from options', function () {
            var options = {
                resolvedConfig: { enableFraudCheck: true },
                accountNumberType: 'SAFETECH_TOKEN'
            };

            fraudDetection(mockBasket, mockPaymentInstrument, options);

            var fraudCheckOptions = mockJPMCPaymentHelper.performFraudCheck.firstCall.args[1];
            assert.equal(fraudCheckOptions.accountNumberType, 'SAFETECH_TOKEN');
        });

        it('should default to SAFETECH_PAGE_ENCRYPTION when accountNumberType not provided', function () {
            fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            var fraudCheckOptions = mockJPMCPaymentHelper.performFraudCheck.firstCall.args[1];
            assert.equal(fraudCheckOptions.accountNumberType, 'SAFETECH_PAGE_ENCRYPTION');
        });

        it('should handle null options gracefully', function () {
            var result = fraudDetection(mockBasket, mockPaymentInstrument, null);

            assert.equal(result.status, 'success');
            assert.include(result.errorMessage, 'Fraud check disabled');
            assert.isFalse(mockJPMCPaymentHelper.performFraudCheck.called);
        });
    });

    // ==================== Browser & Session Data Tests ====================

    describe('Browser & Session Data', function () {
        it('should include device IP address from request', function () {
            global.request.getHttpRemoteAddress.returns('203.0.113.42');

            fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            var fraudCheckOptions = mockJPMCPaymentHelper.performFraudCheck.firstCall.args[1];
            assert.equal(fraudCheckOptions.deviceIPAddress, '203.0.113.42');
        });

        it('should include browser user agent', function () {
            global.request.httpUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';

            fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            var fraudCheckOptions = mockJPMCPaymentHelper.performFraudCheck.firstCall.args[1];
            assert.equal(fraudCheckOptions.fraudScore.cardholderBrowserInformation, 
                'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)');
        });

        it('should use Unknown as default browser when httpUserAgent is missing', function () {
            delete global.request.httpUserAgent;

            fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            var fraudCheckOptions = mockJPMCPaymentHelper.performFraudCheck.firstCall.args[1];
            assert.equal(fraudCheckOptions.fraudScore.cardholderBrowserInformation, 'Unknown');
        });

        it('should include Kount session ID from payment instrument', function () {
            mockPaymentInstrument.custom.kountSessionId = 'KOUNT-SESSION-12345';

            fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            var fraudCheckOptions = mockJPMCPaymentHelper.performFraudCheck.firstCall.args[1];
            assert.equal(fraudCheckOptions.fraudScore.sessionId, 'KOUNT-SESSION-12345');
        });

        it('should handle missing Kount session ID', function () {
            delete mockPaymentInstrument.custom.kountSessionId;

            fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            var fraudCheckOptions = mockJPMCPaymentHelper.performFraudCheck.firstCall.args[1];
            assert.isNull(fraudCheckOptions.fraudScore.sessionId);
        });

        it('should set isFraudRuleReturn flag', function () {
            fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            var fraudCheckOptions = mockJPMCPaymentHelper.performFraudCheck.firstCall.args[1];
            assert.isTrue(fraudCheckOptions.fraudScore.isFraudRuleReturn);
        });
    });

    // ==================== Service Failure Tests ====================

    describe('Service Failure Handling (Fail-Open)', function () {
        it('should fail-open when fraud service returns error', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: false,
                error: 'Service timeout'
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'success');
            assert.equal(result.errorCode, 'FRAUD_SERVICE_ERROR');
            assert.equal(result.action, 'FAIL_OPEN');
            assert.include(result.errorMessage, 'Service timeout');
        });

        it('should fail-open with default message when error not provided', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: false
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'success');
            assert.equal(result.action, 'FAIL_OPEN');
            assert.include(result.errorMessage, 'Fraud check service error');
        });

        it('should set custom attributes on order when service fails with orderNo', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: false,
                error: 'API Error'
            });

            var options = { 
                resolvedConfig: { enableFraudCheck: true },
                orderNo: 'TEST-ORDER-999' 
            };
            fraudDetection(mockBasket, mockPaymentInstrument, options);

            assert.isTrue(mockTransaction.wrap.called);
            assert.equal(mockBasket.custom.jpmcFraudRiskElement, 'UNKNOWN');
            assert.isDefined(mockBasket.custom.jpmcFraudCheckDate);
        });

        it('should not set custom attributes when no orderNo provided', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: false,
                error: 'API Error'
            });

            fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            // Transaction.wrap should not be called without orderNo
            assert.isFalse(mockTransaction.wrap.called);
        });
    });

    // ==================== Exception Handling Tests ====================

    describe('Exception Handling', function () {
        it('should fail-open on exception', function () {
            mockJPMCPaymentHelper.performFraudCheck.throws(new Error('Unexpected error'));

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'success');
            assert.equal(result.errorCode, 'FRAUD_EXCEPTION');
            assert.equal(result.action, 'FAIL_OPEN');
            assert.include(result.errorMessage, 'Unexpected error');
        });

        it('should handle non-Error exception', function () {
            mockJPMCPaymentHelper.performFraudCheck.throws('String exception');

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'success');
            assert.equal(result.errorCode, 'FRAUD_EXCEPTION');
            assert.include(result.errorMessage, 'String exception');
        });
    });

    // ==================== Risk Score & Level Tests ====================

    describe('Risk Score & Level Extraction', function () {
        it('should extract fraud score from riskDecision', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {
                    fraudRiskScore: 42,
                    fraudRuleAction: 'A'
                },
                riskElement: 'MEDIUM'
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.fraudScore, 42);
        });

        it('should handle missing fraud score', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {
                    fraudRuleAction: 'A'
                },
                riskElement: 'LOW'
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.isNull(result.fraudScore);
        });

        it('should extract risk level from response', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {
                    fraudRiskScore: 75,
                    fraudRuleAction: 'E'
                },
                riskElement: 'HIGH'
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.riskLevel, 'HIGH');
        });

        it('should default risk level to UNKNOWN when not provided', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {
                    fraudRiskScore: 30,
                    fraudRuleAction: 'A'
                }
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.riskLevel, 'UNKNOWN');
        });
    });

    // ==================== Result Structure Tests ====================

    describe('Result Structure', function () {
        it('should return all expected properties', function () {
            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.property(result, 'status');
            assert.property(result, 'errorCode');
            assert.property(result, 'errorMessage');
            assert.property(result, 'fraudScore');
            assert.property(result, 'riskLevel');
            assert.property(result, 'action');
            assert.property(result, 'fraudRuleAction');
        });

        it('should initialize all properties to null on success with no data', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: {}
            });

            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);

            assert.equal(result.status, 'success');
            assert.isNull(result.errorCode);
            assert.isNull(result.fraudScore);
            assert.isNull(result.fraudRuleAction);
            assert.equal(result.riskLevel, 'UNKNOWN');
        });
    });

    // ==================== Module Exports Tests ====================

    describe('Module Exports', function () {
        it('should have fraudDetection function available', function () {
            // fraudDetection is already loaded via proxyquire
            assert.isFunction(fraudDetection);
            assert.equal(fraudDetection.name, 'fraudDetection');
        });
    });

    describe('Fraud logging without orderNo (lines 95, 110, 122)', function () {
        it('should log DECLINED without order number (line 95 else branch)', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: { fraudRiskScore: 90, fraudRuleAction: 'D' },
                riskElement: 'HIGH'
            });
            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);
            assert.equal(result.status, 'fail');
            assert.equal(result.action, 'DECLINE');
        });

        it('should log DECLINED with order number (line 95 if branch)', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: { fraudRiskScore: 90, fraudRuleAction: 'D' },
                riskElement: 'HIGH'
            });
            var result = fraudDetection(mockBasket, mockPaymentInstrument, { 
                resolvedConfig: { enableFraudCheck: true },
                orderNo: 'ORD-DECLINE' 
            });
            assert.equal(result.status, 'fail');
            assert.equal(result.action, 'DECLINE');
        });

        it('should log MANAGER_REVIEW flag with order number (line 110 if branch)', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({
                success: true,
                riskDecision: { fraudRiskScore: 60, fraudRuleAction: 'E' },
                riskElement: 'MEDIUM'
            });
            var result = fraudDetection(mockBasket, mockPaymentInstrument, { 
                resolvedConfig: { enableFraudCheck: true },
                orderNo: 'ORD-REVIEW' 
            });
            assert.equal(result.status, 'flag');
            assert.equal(result.action, 'MANAGER_REVIEW');
        });

        it('should log FAIL_OPEN without order number', function () {
            mockJPMCPaymentHelper.performFraudCheck.returns({ success: false, error: 'timeout' });
            var result = fraudDetection(mockBasket, mockPaymentInstrument, defaultOptions);
            assert.equal(result.action, 'FAIL_OPEN');
        });
    });
});
