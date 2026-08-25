'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

describe('bm_jpmc/scripts/helpers/CSCPaymentHelpers', function () {
    var CSCPaymentHelpers;
    var mockLogger;
    var mockResource;
    var mockSite;
    var mockPaymentMgr;
    var mockJpmcConstants;
    var PaymentTransaction;

    beforeEach(function () {
        mockLogger = require('../../../../../../test/mocks/dw/system/Logger');
        mockLogger.resetAllLoggers();

        mockResource = require('../../../../../../test/mocks/dw/web/Resource');
        mockResource.reset();

        mockSite = require('../../../../../../test/mocks/dw/system/Site');
        mockSite.reset();

        mockPaymentMgr = require('../../../../../../test/mocks/dw/order/PaymentMgr');
        mockPaymentMgr.resetMockPaymentMethods();

        PaymentTransaction = require('../../../../../../test/mocks/dw/order/PaymentTransaction');
        PaymentTransaction.reset();

        mockJpmcConstants = {
            JPMC_Processor: 'JPMC_PROCESSOR',
            PAYMENT_METHOD_DISPLAY_UNKNOWN: 'Unknown Payment Method'
        };

        mockSite.setMockPreferences({ JPMCDelayedCaptureWindowMinutes: 120 });

        CSCPaymentHelpers = proxyquire('../../../../../../cartridges/bm_jpmc/cartridge/scripts/helpers/CSCPaymentHelpers', {
            'dw/web/Resource': mockResource,
            'dw/system/Logger': mockLogger,
            'dw/system/Site': mockSite,
            'dw/order/PaymentMgr': mockPaymentMgr,
            '*/cartridge/scripts/helpers/JPMCConstants': mockJpmcConstants
        });
    });

    afterEach(function () {
        mockLogger.resetAllLoggers();
        mockResource.reset();
        mockSite.reset();
        mockPaymentMgr.resetMockPaymentMethods();
        PaymentTransaction.reset();
    });

    describe('PAYMENT_STATUS constants', function () {
        it('should expose payment status constants', function () {
            assert.strictEqual(CSCPaymentHelpers.PAYMENT_STATUS.AUTHORIZED, 'A');
            assert.strictEqual(CSCPaymentHelpers.PAYMENT_STATUS.AUTH_AND_CAPTURE, 'AC');
            assert.strictEqual(CSCPaymentHelpers.PAYMENT_STATUS.CAPTURED, 'C');
            assert.strictEqual(CSCPaymentHelpers.PAYMENT_STATUS.PARTIAL_CAPTURED, 'PC');
            assert.strictEqual(CSCPaymentHelpers.PAYMENT_STATUS.REFUNDED, 'RF');
            assert.strictEqual(CSCPaymentHelpers.PAYMENT_STATUS.PARTIAL_REFUNDED, 'PRF');
            assert.strictEqual(CSCPaymentHelpers.PAYMENT_STATUS.VOIDED, 'V');
            assert.strictEqual(CSCPaymentHelpers.PAYMENT_STATUS.PARTIAL_VOID, 'PV');
        });
    });

    describe('PAYMENT_STATUS_LABELS constants', function () {
        it('should expose payment status label constants', function () {
            assert.isDefined(CSCPaymentHelpers.PAYMENT_STATUS_LABELS.A);
            assert.isDefined(CSCPaymentHelpers.PAYMENT_STATUS_LABELS.AC);
            assert.isDefined(CSCPaymentHelpers.PAYMENT_STATUS_LABELS.C);
            assert.isDefined(CSCPaymentHelpers.PAYMENT_STATUS_LABELS.PC);
            assert.isDefined(CSCPaymentHelpers.PAYMENT_STATUS_LABELS.RF);
            assert.isDefined(CSCPaymentHelpers.PAYMENT_STATUS_LABELS.PRF);
            assert.isDefined(CSCPaymentHelpers.PAYMENT_STATUS_LABELS.V);
            assert.isDefined(CSCPaymentHelpers.PAYMENT_STATUS_LABELS.PV);
        });
    });

    describe('AMOUNT_REGEX constant', function () {
        it('should validate valid decimal amounts', function () {
            assert.isTrue(CSCPaymentHelpers.AMOUNT_REGEX.test('100'));
            assert.isTrue(CSCPaymentHelpers.AMOUNT_REGEX.test('100.00'));
            assert.isTrue(CSCPaymentHelpers.AMOUNT_REGEX.test('100.5'));
            assert.isTrue(CSCPaymentHelpers.AMOUNT_REGEX.test('0.99'));
            assert.isTrue(CSCPaymentHelpers.AMOUNT_REGEX.test('1234567.89'));
        });

        it('should reject invalid amounts', function () {
            assert.isFalse(CSCPaymentHelpers.AMOUNT_REGEX.test('100.'));
            assert.isFalse(CSCPaymentHelpers.AMOUNT_REGEX.test('100.999'));
            assert.isFalse(CSCPaymentHelpers.AMOUNT_REGEX.test('abc'));
            assert.isFalse(CSCPaymentHelpers.AMOUNT_REGEX.test('-100'));
            assert.isFalse(CSCPaymentHelpers.AMOUNT_REGEX.test(''));
        });
    });

    describe('DELAYED_CAPTURE_WINDOW_MINUTES constant', function () {
        it('should default to 120 minutes', function () {
            assert.strictEqual(CSCPaymentHelpers.DELAYED_CAPTURE_WINDOW_MINUTES, 120);
        });

        it('should use site preference if valid', function () {
            mockSite.setMockPreferences({ JPMCDelayedCaptureWindowMinutes: 180 });

            var CSCPaymentHelpers2 = proxyquire('../../../../../../cartridges/bm_jpmc/cartridge/scripts/helpers/CSCPaymentHelpers', {
                'dw/web/Resource': mockResource,
                'dw/system/Logger': mockLogger,
                'dw/system/Site': mockSite,
                'dw/order/PaymentMgr': mockPaymentMgr,
                '*/cartridge/scripts/helpers/JPMCConstants': mockJpmcConstants
            });

            assert.strictEqual(CSCPaymentHelpers2.DELAYED_CAPTURE_WINDOW_MINUTES, 180);
        });
    });

    describe('isWithinDelayedCaptureWindow', function () {
        it('should return true if within window', function () {
            var fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            assert.isTrue(CSCPaymentHelpers.isWithinDelayedCaptureWindow(fiveMinutesAgo));
        });

        it('should return false if outside window', function () {
            var threehHoursAgo = new Date(Date.now() - 180 * 60 * 1000).toISOString();
            assert.isFalse(CSCPaymentHelpers.isWithinDelayedCaptureWindow(threehHoursAgo));
        });

        it('should return false if timestamp is null', function () {
            assert.isFalse(CSCPaymentHelpers.isWithinDelayedCaptureWindow(null));
        });

        it('should return false if timestamp is invalid', function () {
            assert.isFalse(CSCPaymentHelpers.isWithinDelayedCaptureWindow('invalid-date'));
        });
    });

    describe('delayedWindowMinutesRemaining', function () {
        it('should return correct remaining minutes', function () {
            var fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            var remaining = CSCPaymentHelpers.delayedWindowMinutesRemaining(fiveMinutesAgo);
            assert.isAtLeast(remaining, 114);
            assert.isAtMost(remaining, 116);
        });

        it('should return 0 if outside window', function () {
            var threehHoursAgo = new Date(Date.now() - 180 * 60 * 1000).toISOString();
            assert.strictEqual(CSCPaymentHelpers.delayedWindowMinutesRemaining(threehHoursAgo), 0);
        });

        it('should return 0 if timestamp is null', function () {
            assert.strictEqual(CSCPaymentHelpers.delayedWindowMinutesRemaining(null), 0);
        });

        it('should return 0 if timestamp is invalid', function () {
            assert.strictEqual(CSCPaymentHelpers.delayedWindowMinutesRemaining('invalid-date'), 0);
        });
    });

    describe('canCapture', function () {
        it('should allow capture for MANUAL method with AUTHORIZED status', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'MANUAL',
                amounts: { remainingAuth: 100 }
            };
            var result = CSCPaymentHelpers.canCapture(paymentDetails);
            assert.isTrue(result.allowed);
            assert.isNull(result.reason);
        });

        it('should allow capture for MANUAL method with PARTIAL_CAPTURED status', function () {
            var paymentDetails = {
                paymentStatus: 'PC',
                captureMethod: 'MANUAL',
                amounts: { remainingAuth: 50 }
            };
            var result = CSCPaymentHelpers.canCapture(paymentDetails);
            assert.isTrue(result.allowed);
            assert.isNull(result.reason);
        });

        it('should disallow capture if no remaining auth', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'MANUAL',
                amounts: { remainingAuth: 0 }
            };
            var result = CSCPaymentHelpers.canCapture(paymentDetails);
            assert.isFalse(result.allowed);
            assert.isString(result.reason);
        });

        it('should disallow capture for CAPTURED status', function () {
            var paymentDetails = {
                paymentStatus: 'C',
                captureMethod: 'MANUAL',
                amounts: { remainingAuth: 0 }
            };
            var result = CSCPaymentHelpers.canCapture(paymentDetails);
            assert.isFalse(result.allowed);
        });

        it('should allow capture for DELAYED within window', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'DELAYED',
                amounts: { remainingAuth: 100 },
                authTimestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
            };
            var result = CSCPaymentHelpers.canCapture(paymentDetails);
            assert.isTrue(result.allowed);
        });

        it('should disallow capture for DELAYED outside window', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'DELAYED',
                amounts: { remainingAuth: 100 },
                authTimestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString()
            };
            var result = CSCPaymentHelpers.canCapture(paymentDetails);
            assert.isFalse(result.allowed);
            assert.isString(result.reason);
        });
    });

    describe('canVoid', function () {
        it('should allow void for MANUAL method with AUTHORIZED status', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'MANUAL',
                amounts: { remainingAuth: 100 }
            };
            var result = CSCPaymentHelpers.canVoid(paymentDetails);
            assert.isTrue(result.allowed);
            assert.isNull(result.reason);
        });

        it('should disallow void if already voided', function () {
            var paymentDetails = {
                paymentStatus: 'V',
                captureMethod: 'MANUAL',
                amounts: { remainingAuth: 0 }
            };
            var result = CSCPaymentHelpers.canVoid(paymentDetails);
            assert.isFalse(result.allowed);
        });

        it('should disallow void if no remaining auth', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'MANUAL',
                amounts: { remainingAuth: 0 }
            };
            var result = CSCPaymentHelpers.canVoid(paymentDetails);
            assert.isFalse(result.allowed);
        });

        it('should allow void for DELAYED within window', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'DELAYED',
                amounts: { remainingAuth: 100 },
                authTimestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
            };
            var result = CSCPaymentHelpers.canVoid(paymentDetails);
            assert.isTrue(result.allowed);
        });

        it('should disallow void for DELAYED outside window', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'DELAYED',
                amounts: { remainingAuth: 100 },
                authTimestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString()
            };
            var result = CSCPaymentHelpers.canVoid(paymentDetails);
            assert.isFalse(result.allowed);
            assert.isString(result.reason);
        });
    });

    describe('canRefund', function () {
        it('should allow refund for CAPTURED status', function () {
            var paymentDetails = {
                paymentStatus: 'C',
                captureMethod: 'MANUAL',
                amounts: { remainingRefundable: 100 }
            };
            var result = CSCPaymentHelpers.canRefund(paymentDetails);
            assert.isTrue(result.allowed);
            assert.isNull(result.reason);
        });

        it('should allow refund for AUTH_AND_CAPTURE status', function () {
            var paymentDetails = {
                paymentStatus: 'AC',
                captureMethod: 'NOW',
                amounts: { remainingRefundable: 100 }
            };
            var result = CSCPaymentHelpers.canRefund(paymentDetails);
            assert.isTrue(result.allowed);
        });

        it('should disallow refund if nothing to refund', function () {
            var paymentDetails = {
                paymentStatus: 'C',
                captureMethod: 'MANUAL',
                amounts: { remainingRefundable: 0 }
            };
            var result = CSCPaymentHelpers.canRefund(paymentDetails);
            assert.isFalse(result.allowed);
            assert.isString(result.reason);
        });

        it('should disallow refund for DELAYED AUTHORIZED within window', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'DELAYED',
                amounts: { remainingRefundable: 100, authorized: 100 },
                authTimestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
            };
            var result = CSCPaymentHelpers.canRefund(paymentDetails);
            assert.isFalse(result.allowed);
            assert.isString(result.reason);
        });

        it('should allow refund for DELAYED AUTHORIZED outside window (auto-captured)', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'DELAYED',
                amounts: { remainingRefundable: 100, authorized: 100 },
                authTimestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString()
            };
            var result = CSCPaymentHelpers.canRefund(paymentDetails);
            assert.isTrue(result.allowed);
            assert.isTrue(result.delayedAutoCapture);
        });

        it('should disallow refund for AUTHORIZED status', function () {
            var paymentDetails = {
                paymentStatus: 'A',
                captureMethod: 'MANUAL',
                amounts: { remainingRefundable: 0 }
            };
            var result = CSCPaymentHelpers.canRefund(paymentDetails);
            assert.isFalse(result.allowed);
        });
    });

    describe('getCaptureHistory', function () {
        it('should parse and return capture history', function () {
            var mockTransaction = new PaymentTransaction();
            var captureHistory = [
                { transactionId: 'CAP-1', amount: 50 },
                { transactionId: 'CAP-2', amount: 30 }
            ];
            mockTransaction.custom.jpmcCaptureHistory = JSON.stringify(captureHistory);

            var result = CSCPaymentHelpers.getCaptureHistory(mockTransaction);
            assert.deepEqual(result, captureHistory);
        });

        it('should return empty array if history is empty', function () {
            var mockTransaction = new PaymentTransaction();
            var result = CSCPaymentHelpers.getCaptureHistory(mockTransaction);
            assert.deepEqual(result, []);
        });

        it('should return empty array and log error if JSON is invalid', function () {
            var mockTransaction = new PaymentTransaction();
            mockTransaction.custom.jpmcCaptureHistory = 'invalid-json';

            var result = CSCPaymentHelpers.getCaptureHistory(mockTransaction);
            assert.deepEqual(result, []);
            
            var jpmcLogger = mockLogger.getLogger('JPMC', 'CSC-helper');
            assert.isTrue(jpmcLogger.errorMessages.length > 0, 'Logger should have error messages');
        });
    });

    describe('getRefundHistory', function () {
        it('should parse and return refund history', function () {
            var mockTransaction = new PaymentTransaction();
            var refundHistory = [
                { transactionId: 'REF-1', amount: 20 }
            ];
            mockTransaction.custom.jpmcRefundHistory = JSON.stringify(refundHistory);

            var result = CSCPaymentHelpers.getRefundHistory(mockTransaction);
            assert.deepEqual(result, refundHistory);
        });

        it('should return empty array if history is empty', function () {
            var mockTransaction = new PaymentTransaction();
            var result = CSCPaymentHelpers.getRefundHistory(mockTransaction);
            assert.deepEqual(result, []);
        });
    });

    describe('getVoidHistory', function () {
        it('should parse and return void history', function () {
            var mockTransaction = new PaymentTransaction();
            var voidHistory = [
                { transactionId: 'VOID-1', amount: 100 }
            ];
            mockTransaction.custom.jpmcVoidHistory = JSON.stringify(voidHistory);

            var result = CSCPaymentHelpers.getVoidHistory(mockTransaction);
            assert.deepEqual(result, voidHistory);
        });

        it('should return empty array if history is empty', function () {
            var mockTransaction = new PaymentTransaction();
            var result = CSCPaymentHelpers.getVoidHistory(mockTransaction);
            assert.deepEqual(result, []);
        });
    });

    describe('maskCardNumber', function () {
        it('should mask card number correctly', function () {
            assert.strictEqual(CSCPaymentHelpers.maskCardNumber('4111111111111111'), '************1111');
            assert.strictEqual(CSCPaymentHelpers.maskCardNumber('378282246310005'), '***********0005');
        });

        it('should return **** for cards shorter than 4 digits', function () {
            assert.strictEqual(CSCPaymentHelpers.maskCardNumber('123'), '****');
            assert.strictEqual(CSCPaymentHelpers.maskCardNumber(''), '****');
            assert.strictEqual(CSCPaymentHelpers.maskCardNumber(null), '****');
        });
    });

    describe('getPaymentMethodName', function () {
        it('should return payment method name from PaymentMgr', function () {
            var mockMethod = { name: 'Credit Card' };
            mockPaymentMgr.setMockPaymentMethod('CREDIT_CARD', mockMethod);

            var result = CSCPaymentHelpers.getPaymentMethodName('CREDIT_CARD');
            assert.strictEqual(result, 'Credit Card');
        });

        it('should return method ID if name not found', function () {
            mockPaymentMgr.setMockPaymentMethod('CREDIT_CARD', null);

            var result = CSCPaymentHelpers.getPaymentMethodName('CREDIT_CARD');
            assert.strictEqual(result, 'CREDIT_CARD');
        });

        it('should return unknown label if payment method is null', function () {
            var result = CSCPaymentHelpers.getPaymentMethodName(null);
            assert.strictEqual(result, 'Unknown Payment Method');
        });
    });

    describe('isSupportedPaymentMethod', function () {
        it('should return true for JPMC processor', function () {
            var mockProcessor = { ID: 'JPMC_PROCESSOR' };
            var mockMethod = {
                getPaymentProcessor: sinon.stub().returns(mockProcessor)
            };
            mockPaymentMgr.setMockPaymentMethod('JPMC_CREDIT', mockMethod);

            var result = CSCPaymentHelpers.isSupportedPaymentMethod('JPMC_CREDIT');
            assert.isTrue(result);
        });

        it('should return false for non-JPMC processor', function () {
            var mockProcessor = { ID: 'OTHER_PROCESSOR' };
            var mockMethod = {
                getPaymentProcessor: sinon.stub().returns(mockProcessor)
            };
            mockPaymentMgr.setMockPaymentMethod('OTHER_CREDIT', mockMethod);

            var result = CSCPaymentHelpers.isSupportedPaymentMethod('OTHER_CREDIT');
            assert.isFalse(result);
        });

        it('should return false if method not found', function () {
            mockPaymentMgr.setMockPaymentMethod('INVALID', null);

            var result = CSCPaymentHelpers.isSupportedPaymentMethod('INVALID');
            assert.isFalse(result);
        });

        it('should return false if payment method is null', function () {
            var result = CSCPaymentHelpers.isSupportedPaymentMethod(null);
            assert.isFalse(result);
        });
    });
});
