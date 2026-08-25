'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');
var Module = require('module');

describe('int_jpmc_sfra/scripts/account/accountHelpers', function () {
    var accountHelpers;
    var mockAccountModel;
    var mockAddressModel;
    var mockOrderHelpers;
    var mockMerchantResolver;
    var mockBaseHelpers;
    var originalCompile;

    /**
     * Build a minimal req object.
     * @param {Object} opts
     * @returns {Object}
     */
    function makeReq(opts) {
        opts = opts || {};
        return {
            currentCustomer: opts.customer || {
                profile: { firstName: 'Jane' },
                addressBook: {
                    preferredAddress: opts.preferredAddress !== undefined ? opts.preferredAddress : { address1: '1 Main St' }
                },
                wallet: { paymentInstruments: [] }
            }
        };
    }

    beforeEach(function () {
        mockAccountModel = sinon.stub().returns({ payment: null, customerPaymentInstruments: [] });
        mockAddressModel = sinon.stub().returns({ line1: '1 Main St' });
        mockOrderHelpers = { getLastOrder: sinon.stub().returns(null) };
        mockMerchantResolver = { resolve: sinon.stub().returns({ merchantId: 'MID-001' }) };

        // baseHelpers starts as a plain object; the source mutates it then re-exports it
        mockBaseHelpers = {};

        // Patch Module._compile to inject superModule before the source file executes
        originalCompile = Module.prototype._compile;
        Module.prototype._compile = function (content, filename) {
            if (filename && filename.indexOf('scripts/account/accountHelpers.js') !== -1) {
                this.superModule = mockBaseHelpers;
            }
            return originalCompile.apply(this, arguments);
        };

        accountHelpers = proxyquire(
            '../../../../../cartridges/int_jpmc_sfra/cartridge/scripts/account/accountHelpers',
            {
                '*/cartridge/models/account': mockAccountModel,
                '*/cartridge/models/address': mockAddressModel,
                '*/cartridge/scripts/order/orderHelpers': mockOrderHelpers,
                '*/cartridge/scripts/helpers/JPMCMerchantResolver': mockMerchantResolver
            }
        );

        Module.prototype._compile = originalCompile;
    });

    // -------------------------------------------------------------------------
    // module exports
    // -------------------------------------------------------------------------
    describe('module.exports', function () {
        it('should export the baseHelpers object', function () {
            assert.isObject(accountHelpers);
        });

        it('should expose getAccountModel as a function', function () {
            assert.isFunction(accountHelpers.getAccountModel);
        });
    });

    // -------------------------------------------------------------------------
    // getAccountModel — happy path
    // -------------------------------------------------------------------------
    describe('getAccountModel', function () {
        it('should return null when customer has no profile', function () {
            var req = makeReq({ customer: { profile: null, addressBook: {}, wallet: {} } });
            var result = accountHelpers.getAccountModel(req);
            assert.isNull(result);
        });

        it('should return an AccountModel instance when profile exists', function () {
            var req = makeReq();
            var result = accountHelpers.getAccountModel(req);
            assert.ok(result);
            assert.isTrue(mockAccountModel.called);
        });

        it('should pass the resolved merchantId to AccountModel', function () {
            mockMerchantResolver.resolve.returns({ merchantId: 'MID-XYZ' });
            var req = makeReq();
            accountHelpers.getAccountModel(req);

            var callArgs = mockAccountModel.firstCall.args;
            assert.equal(callArgs[3], 'MID-XYZ');
        });

        it('should pass null merchantId when resolve returns null', function () {
            mockMerchantResolver.resolve.returns(null);
            var req = makeReq();
            accountHelpers.getAccountModel(req);

            var callArgs = mockAccountModel.firstCall.args;
            assert.isNull(callArgs[3]);
        });

        it('should create AddressModel from preferredAddress when present', function () {
            var req = makeReq({ preferredAddress: { address1: '42 Elm St' } });
            accountHelpers.getAccountModel(req);
            assert.isTrue(mockAddressModel.called);
        });

        it('should pass null preferredAddressModel when preferredAddress is absent', function () {
            var req = makeReq({ preferredAddress: null });
            accountHelpers.getAccountModel(req);

            // AddressModel should NOT have been called
            assert.isFalse(mockAddressModel.called);
            // AccountModel's second arg should be null
            var callArgs = mockAccountModel.firstCall.args;
            assert.isNull(callArgs[1]);
        });

        it('should call orderHelpers.getLastOrder with req', function () {
            var req = makeReq();
            accountHelpers.getAccountModel(req);
            assert.isTrue(mockOrderHelpers.getLastOrder.calledWith(req));
        });

        it('should forward the orderModel returned by getLastOrder to AccountModel', function () {
            var fakeOrder = { orderNo: 'ORD-999' };
            mockOrderHelpers.getLastOrder.returns(fakeOrder);

            var req = makeReq();
            accountHelpers.getAccountModel(req);

            var callArgs = mockAccountModel.firstCall.args;
            assert.equal(callArgs[2], fakeOrder);
        });

        it('should forward currentCustomer as first arg to AccountModel', function () {
            var req = makeReq();
            accountHelpers.getAccountModel(req);

            var callArgs = mockAccountModel.firstCall.args;
            assert.equal(callArgs[0], req.currentCustomer);
        });
    });
});
