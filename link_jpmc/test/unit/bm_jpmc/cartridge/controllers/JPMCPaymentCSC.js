'use strict';

/* eslint-disable no-unused-vars */

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');

/**
 * Builds a mock request whose httpParameterMap exposes the CSC parameters the
 * controller reads. Any parameter not supplied resolves to { stringValue: null }.
 *
 * @param {Object} options - request options
 * @param {string} options.method - HTTP method (GET/POST)
 * @param {Object} options.params - map of parameter name -> string value
 * @returns {Object} mock request
 */
function buildRequest(options) {
    var opts = options || {};
    var params = opts.params || {};
    var known = ['orderNo', 'capture', 'refund', 'voidAuth', 'amountIntroduced',
        'isFinalCapture', 'isFullRefund', 'refundCaptureId'];
    var httpParameterMap = {};
    known.forEach(function (name) {
        httpParameterMap[name] = {
            stringValue: Object.prototype.hasOwnProperty.call(params, name) ? params[name] : null
        };
    });
    return {
        httpMethod: opts.method || 'GET',
        httpParameterMap: httpParameterMap
    };
}

describe('bm_jpmc/controllers/JPMCPaymentCSC ManagePayment CSRF guard', function () {
    var controller;
    var renderedTemplates;
    var getOrderSpy;
    var validateRequestStub;

    var CSC_HELPER_STUB = {
        PAYMENT_STATUS: { AUTHORIZED: 'A', CAPTURED: 'C' },
        PAYMENT_STATUS_LABELS: {},
        AMOUNT_REGEX: /^\d+(\.\d{1,2})?$/,
        DELAYED_CAPTURE_WINDOW_MINUTES: 120,
        isSupportedPaymentMethod: function () { return false; },
        getPaymentMethodName: function () { return 'JPMC'; },
        getCaptureHistory: function () { return []; },
        getRefundHistory: function () { return []; },
        getVoidHistory: function () { return []; },
        canCapture: function () { return { allowed: false, reason: null }; },
        canRefund: function () { return { allowed: false, reason: null }; },
        canVoid: function () { return { allowed: false, reason: null }; },
        isWithinDelayedCaptureWindow: function () { return true; },
        delayedWindowMinutesRemaining: function () { return 0; }
    };

    function loadController() {
        renderedTemplates = [];
        getOrderSpy = sinon.spy(function () { return null; });
        validateRequestStub = sinon.stub().returns(false);

        return proxyquire('../../../../../cartridges/bm_jpmc/cartridge/controllers/JPMCPaymentCSC', {
            'dw/template/ISML': {
                renderTemplate: function (name) { renderedTemplates.push(name); }
            },
            'dw/system/Transaction': { wrap: function (cb) { return cb(); } },
            'dw/web/Resource': {
                msg: function (key) { return key; },
                msgf: function (key) { return key; }
            },
            'dw/order/OrderMgr': { getOrder: getOrderSpy },
            'dw/order/Order': {
                ORDER_STATUS_OPEN: 3,
                ORDER_STATUS_COMPLETED: 5,
                ORDER_STATUS_CANCELLED: 6
            },
            'dw/order/PaymentTransaction': { TYPE_CAPTURE: 'CAPTURE' },
            'dw/web/CSRFProtection': {
                validateRequest: validateRequestStub,
                getTokenName: function () { return 'csrf_token'; },
                generateToken: function () { return 'generated-token'; }
            },
            'dw/system/Logger': {
                getLogger: function () {
                    return { warn: function () {}, error: function () {}, info: function () {}, debug: function () {} };
                }
            },
            '~/cartridge/scripts/helpers/CSCPaymentHelpers': CSC_HELPER_STUB
        });
    }

    beforeEach(function () {
        global.session = { userName: 'csc-agent' };
        controller = loadController();
    });

    afterEach(function () {
        delete global.request;
        delete global.session;
    });

    ['refund', 'capture', 'voidAuth'].forEach(function (action) {
        it('rejects a GET carrying the "' + action + '" action param without touching the order', function () {
            var params = { orderNo: '00001234' };
            params[action] = 'true';
            global.request = buildRequest({ method: 'GET', params: params });

            controller.ManagePayment();

            assert.include(renderedTemplates, 'csrfFail',
                'expected the CSRF failure template to be rendered for a GET mutation');
            assert.isFalse(getOrderSpy.called,
                'the order must not be looked up when the CSRF guard rejects the request');
        });
    });

    it('rejects a POST mutation when the CSRF token is invalid', function () {
        validateRequestStub.returns(false);
        global.request = buildRequest({ method: 'POST', params: { orderNo: '00001234', refund: 'true', isFullRefund: 'true' } });

        controller.ManagePayment();

        assert.include(renderedTemplates, 'csrfFail');
        assert.isFalse(getOrderSpy.called);
    });

    it('allows a POST mutation with a valid CSRF token to proceed past the guard', function () {
        validateRequestStub.returns(true);
        global.request = buildRequest({ method: 'POST', params: { orderNo: '00001234', refund: 'true', isFullRefund: 'true' } });

        controller.ManagePayment();

        assert.notInclude(renderedTemplates, 'csrfFail',
            'a valid POST must not be treated as a CSRF failure');
        assert.isTrue(getOrderSpy.calledWith('00001234'),
            'a valid POST mutation must reach the order lookup');
    });

    it('does not block a plain GET with no action param (order view)', function () {
        global.request = buildRequest({ method: 'GET', params: { orderNo: '00001234' } });

        controller.ManagePayment();

        assert.notInclude(renderedTemplates, 'csrfFail',
            'read-only viewing via GET must not be blocked by the CSRF guard');
        assert.isTrue(getOrderSpy.calledWith('00001234'),
            'a read-only GET must reach the order lookup');
    });
});
