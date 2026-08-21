'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

describe('int_jpmc_core/scripts/jobs/JPMCMerchantCacheWarmup', function () {
    var job;
    var StatusMock;
    var SiteMock;
    var ResolverMock;

    function makeStatusCtor() {
        function Status(code, key, msg) {
            this.code = code;
            this.key = key;
            this.msg = msg;
        }
        Status.OK = 0;
        Status.ERROR = 1;
        return Status;
    }

    beforeEach(function () {
        StatusMock = makeStatusCtor();

        SiteMock = {
            getCurrent: function () {
                return {
                    getID: function () { return 'TestSite'; },
                    getAllowedLocales: function () {
                        var locales = ['en_US', 'fr_FR'];
                        locales.size = function () { return locales.length; };
                        return locales;
                    }
                };
            }
        };

        ResolverMock = {
            resolve: function () { return { merchantId: 'mid' }; }
        };

        job = proxyquire(
            '../../../../../cartridges/int_jpmc_core/cartridge/scripts/jobs/JPMCMerchantCacheWarmup',
            {
                'dw/system/Status': StatusMock,
                'dw/system/Site': SiteMock,
                '*/cartridge/scripts/helpers/JPMCMerchantResolver': ResolverMock
            }
        );
    });

    it('should export an execute function', function () {
        assert.isFunction(job.execute);
    });

    it('should return OK when all locales warm successfully', function () {
        var result = job.execute({}, {});
        assert.equal(result.code, StatusMock.OK);
        assert.include(result.msg, 'TestSite');
    });

    it('should include warmed locale count in OK message', function () {
        var result = job.execute({}, {});
        assert.include(result.msg, '2');
    });

    it('should return OK even when some locale resolutions fail (partial success)', function () {
        var callCount = 0;
        ResolverMock.resolve = function (opts) {
            callCount++;
            // fail fr_FR and the empty-locale call, succeed en_US
            if (opts.locale === 'fr_FR' || opts.locale === '') {
                throw new Error('Locale resolution failed');
            }
            return { merchantId: 'mid' };
        };
        var result = job.execute({}, {});
        // warmedLocales=1, errors=2 → but warmedLocales>0 so should be OK
        assert.equal(result.code, StatusMock.OK);
    });

    it('should return ERROR when all locale resolutions fail', function () {
        ResolverMock.resolve = function () {
            throw new Error('All failed');
        };
        var result = job.execute({}, {});
        assert.equal(result.code, StatusMock.ERROR);
        assert.include(result.msg, 'TestSite');
    });

    it('should handle site with no allowed locales', function () {
        SiteMock.getCurrent = function () {
            return {
                getID: function () { return 'EmptySite'; },
                getAllowedLocales: function () {
                    var locales = [];
                    locales.size = function () { return 0; };
                    return locales;
                }
            };
        };
        var result = job.execute({}, {});
        // No locales → warmedLocales=0 but default resolve also runs
        // If that succeeds, errors=0 and warmedLocales=0 → OK
        assert.equal(result.code, StatusMock.OK);
    });

    it('should handle null allowed locales', function () {
        SiteMock.getCurrent = function () {
            return {
                getID: function () { return 'NullLocaleSite'; },
                getAllowedLocales: function () { return null; }
            };
        };
        var result = job.execute({}, {});
        assert.equal(result.code, StatusMock.OK);
    });

    it('should return ERROR status when outer try-catch fires', function () {
        SiteMock.getCurrent = function () {
            throw new Error('Site unavailable');
        };
        var result = job.execute({}, {});
        assert.equal(result.code, StatusMock.ERROR);
        assert.include(result.msg, 'Site unavailable');
    });
});
