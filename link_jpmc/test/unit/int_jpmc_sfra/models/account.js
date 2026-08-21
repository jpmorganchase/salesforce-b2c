'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var sinon = require('sinon');
var Module = require('module');

describe('int_jpmc_sfra/models/account', function () {
    var Account;
    var mockBaseAccount;
    var mockURLUtils;
    var mockCustomerClass;
    var originalCompile;

    /**
     * Helper: build a plain wallet payment instrument object.
     * @param {Object} overrides - fields to override
     * @returns {Object}
     */
    function makePi(overrides) {
        var defaults = {
            creditCardHolder: 'John Doe',
            maskedCreditCardNumber: '***1111',
            creditCardType: 'Visa',
            creditCardExpirationMonth: 12,
            creditCardExpirationYear: 2030,
            UUID: 'uuid-001',
            custom: {}
        };
        return Object.assign({}, defaults, overrides);
    }

    /**
     * Helper: build a plain currentCustomer (non-Customer-instance) object.
     * @param {Array} instruments - payment instruments array
     * @returns {Object}
     */
    function makePlainCustomer(instruments) {
        return {
            wallet: {
                paymentInstruments: instruments || []
            }
        };
    }

    /**
     * Helper: build a dw.customer.Customer-instance-like object.
     * @param {Array} instruments - raw instruments array
     * @returns {Object}
     */
    function makeDwCustomer(instruments) {
        var obj = Object.create(mockCustomerClass.prototype);
        obj.profile = {
            wallet: {
                paymentInstruments: {
                    toArray: function () { return instruments || []; }
                }
            }
        };
        return obj;
    }

    beforeEach(function () {
        // Base account mock — simple constructor that copies nothing
        mockBaseAccount = sinon.stub();
        mockBaseAccount.prototype = {};

        mockURLUtils = {
            staticURL: sinon.stub().callsFake(function (path) { return 'https://cdn.example.com' + path; })
        };

        // Mock dw/customer/Customer class so instanceof checks work
        mockCustomerClass = function Customer() {};

        // Inject module.superModule by patching Module._compile temporarily so that
        // when proxyquire loads the source file the module object already has superModule set.
        originalCompile = Module.prototype._compile;
        Module.prototype._compile = function (content, filename) {
            if (filename && filename.indexOf('int_jpmc_sfra/cartridge/models/account.js') !== -1) {
                this.superModule = mockBaseAccount;
            }
            return originalCompile.apply(this, arguments);
        };

        Account = proxyquire('../../../../cartridges/int_jpmc_sfra/cartridge/models/account', {
            'dw/web/URLUtils': mockURLUtils,
            'dw/customer/Customer': mockCustomerClass
        });

        Module.prototype._compile = originalCompile;
    });

    // -------------------------------------------------------------------------
    // getMerchantId (private — tested indirectly through filterByMerchant)
    // -------------------------------------------------------------------------
    describe('getMerchantId (via filterByMerchant)', function () {
        it('should read merchantId from pi.custom.jpmcMerchantId', function () {
            var pi1 = makePi({ custom: { jpmcMerchantId: 'MID-001' } });
            var pi2 = makePi({ custom: { jpmcMerchantId: 'MID-002' } });
            var customer = makePlainCustomer([pi1, pi2]);

            var acct = new Account(customer, {}, {}, 'MID-001');
            assert.equal(acct.customerPaymentInstruments.length, 1);
            assert.equal(acct.customerPaymentInstruments[0].UUID, 'uuid-001');
        });

        it('should read merchantId from pi.raw.custom.jpmcMerchantId when pi.custom is absent', function () {
            var pi = makePi({ custom: {}, raw: { custom: { jpmcMerchantId: 'MID-RAW' } } });
            var customer = makePlainCustomer([pi]);

            var acct = new Account(customer, {}, {}, 'MID-RAW');
            assert.equal(acct.customerPaymentInstruments.length, 1);
        });

        it('should include pi with no merchantId when filtering (null piMid passes through)', function () {
            var pi = makePi({ custom: {} }); // no jpmcMerchantId
            var customer = makePlainCustomer([pi]);

            var acct = new Account(customer, {}, {}, 'MID-001');
            // piMid is null → allowed through
            assert.equal(acct.customerPaymentInstruments.length, 1);
        });
    });

    // -------------------------------------------------------------------------
    // filterByMerchant
    // -------------------------------------------------------------------------
    describe('filterByMerchant', function () {
        it('should return all instruments when currentMerchantId is null', function () {
            var pi1 = makePi({ UUID: 'a', custom: { jpmcMerchantId: 'MID-A' } });
            var pi2 = makePi({ UUID: 'b', custom: { jpmcMerchantId: 'MID-B' } });
            var customer = makePlainCustomer([pi1, pi2]);

            var acct = new Account(customer, {}, {}, null);
            assert.equal(acct.customerPaymentInstruments.length, 2);
        });

        it('should return all instruments when currentMerchantId is undefined', function () {
            var pi = makePi();
            var customer = makePlainCustomer([pi]);

            var acct = new Account(customer, {}, {}); // no 4th arg
            assert.equal(acct.customerPaymentInstruments.length, 1);
        });

        it('should return empty array when paymentInstruments is empty', function () {
            var customer = makePlainCustomer([]);
            var acct = new Account(customer, {}, {}, 'MID-X');
            assert.deepEqual(acct.customerPaymentInstruments, []);
        });

        it('should filter out instruments belonging to a different merchant', function () {
            var pi1 = makePi({ UUID: 'keep', custom: { jpmcMerchantId: 'MID-KEEP' } });
            var pi2 = makePi({ UUID: 'drop', custom: { jpmcMerchantId: 'MID-DROP' } });
            var customer = makePlainCustomer([pi1, pi2]);

            var acct = new Account(customer, {}, {}, 'MID-KEEP');
            assert.equal(acct.customerPaymentInstruments.length, 1);
            assert.equal(acct.customerPaymentInstruments[0].UUID, 'keep');
        });
    });

    // -------------------------------------------------------------------------
    // getPayment
    // -------------------------------------------------------------------------
    describe('getPayment', function () {
        it('should return null when instruments list is empty', function () {
            var customer = makePlainCustomer([]);
            var acct = new Account(customer, {}, {});
            assert.isNull(acct.payment);
        });

        it('should return payment summary from first instrument', function () {
            var pi = makePi();
            var customer = makePlainCustomer([pi]);
            var acct = new Account(customer, {}, {});

            assert.equal(acct.payment.maskedCreditCardNumber, '***1111');
            assert.equal(acct.payment.creditCardType, 'Visa');
            assert.equal(acct.payment.creditCardExpirationMonth, 12);
            assert.equal(acct.payment.creditCardExpirationYear, 2030);
        });
    });

    // -------------------------------------------------------------------------
    // mapPaymentInstruments
    // -------------------------------------------------------------------------
    describe('mapPaymentInstruments', function () {
        it('should return empty array when instruments is empty', function () {
            var customer = makePlainCustomer([]);
            var acct = new Account(customer, {}, {});
            assert.deepEqual(acct.customerPaymentInstruments, []);
        });

        it('should map all fields correctly', function () {
            var pi = makePi();
            var customer = makePlainCustomer([pi]);
            var acct = new Account(customer, {}, {});

            assert.equal(acct.customerPaymentInstruments.length, 1);
            var mapped = acct.customerPaymentInstruments[0];
            assert.equal(mapped.creditCardHolder, 'John Doe');
            assert.equal(mapped.maskedCreditCardNumber, '***1111');
            assert.equal(mapped.creditCardType, 'Visa');
            assert.equal(mapped.creditCardExpirationMonth, 12);
            assert.equal(mapped.creditCardExpirationYear, 2030);
            assert.equal(mapped.UUID, 'uuid-001');
        });

        it('should generate cardTypeImage via URLUtils.staticURL', function () {
            var pi = makePi({ creditCardType: 'Master Card' });
            var customer = makePlainCustomer([pi]);
            var acct = new Account(customer, {}, {});

            var img = acct.customerPaymentInstruments[0].cardTypeImage;
            assert.include(img.src, 'mastercard-dark.svg');
            assert.equal(img.alt, 'Master Card');
        });

        it('should lower-case and strip spaces from card type for image path', function () {
            var pi = makePi({ creditCardType: 'American Express' });
            var customer = makePlainCustomer([pi]);
            var acct = new Account(customer, {}, {});

            var img = acct.customerPaymentInstruments[0].cardTypeImage;
            assert.include(img.src, 'americanexpress-dark.svg');
        });
    });

    // -------------------------------------------------------------------------
    // account constructor — dw.customer.Customer instanceof branch
    // -------------------------------------------------------------------------
    describe('account constructor — dw.customer.Customer instanceof', function () {
        it('should read instruments from profile.wallet.paymentInstruments.toArray() for Customer instances', function () {
            var pi = makePi({ UUID: 'dw-pi-1' });
            var dwCustomer = makeDwCustomer([pi]);

            var acct = new Account(dwCustomer, {}, {});
            assert.equal(acct.customerPaymentInstruments.length, 1);
            assert.equal(acct.customerPaymentInstruments[0].UUID, 'dw-pi-1');
        });

        it('should return empty array when profile.wallet is absent for Customer instances', function () {
            var dwCustomer = Object.create(mockCustomerClass.prototype);
            dwCustomer.profile = {}; // no wallet

            var acct = new Account(dwCustomer, {}, {});
            assert.deepEqual(acct.customerPaymentInstruments, []);
        });

        it('should return empty array when profile.wallet.paymentInstruments is absent', function () {
            var dwCustomer = Object.create(mockCustomerClass.prototype);
            dwCustomer.profile = { wallet: {} }; // no paymentInstruments

            var acct = new Account(dwCustomer, {}, {});
            assert.deepEqual(acct.customerPaymentInstruments, []);
        });
    });

    // -------------------------------------------------------------------------
    // account constructor — plain customer object branch
    // -------------------------------------------------------------------------
    describe('account constructor — plain customer object', function () {
        it('should read instruments from wallet.paymentInstruments for plain customer', function () {
            var pi = makePi({ UUID: 'plain-pi-1' });
            var customer = makePlainCustomer([pi]);

            var acct = new Account(customer, {}, {});
            assert.equal(acct.customerPaymentInstruments[0].UUID, 'plain-pi-1');
        });

        it('should return empty array when wallet is absent', function () {
            var acct = new Account({}, {}, {}); // no wallet
            assert.deepEqual(acct.customerPaymentInstruments, []);
        });

        it('should return empty array when wallet.paymentInstruments is absent', function () {
            var acct = new Account({ wallet: {} }, {}, {});
            assert.deepEqual(acct.customerPaymentInstruments, []);
        });
    });

    // -------------------------------------------------------------------------
    // static method
    // -------------------------------------------------------------------------
    describe('account.getCustomerPaymentInstruments (static)', function () {
        it('should be exposed as a static method', function () {
            assert.isFunction(Account.getCustomerPaymentInstruments);
        });

        it('should map instruments the same way as the instance method', function () {
            var pi = makePi();
            var result = Account.getCustomerPaymentInstruments([pi]);
            assert.equal(result.length, 1);
            assert.equal(result[0].UUID, 'uuid-001');
        });

        it('should return empty array when called with empty array', function () {
            var result = Account.getCustomerPaymentInstruments([]);
            assert.deepEqual(result, []);
        });
    });

    // -------------------------------------------------------------------------
    // prototype chain
    // -------------------------------------------------------------------------
    describe('prototype chain', function () {
        it('should call baseAccount constructor', function () {
            var customer = makePlainCustomer([]);
            new Account(customer, {}, {}); // eslint-disable-line no-new
            assert.isTrue(mockBaseAccount.called);
        });
    });
});
