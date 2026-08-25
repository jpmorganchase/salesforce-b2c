'use strict';

var assert = require('chai').assert;
var axios = require('axios');
var config = require('../it.config');

// Create axios instance with defaults
function createAxiosInstance() {
    return axios.create({
        httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false }),
        validateStatus: function () { return true; },
        maxRedirects: 0
    });
}

describe('JPMCGooglePay-GetConfig', function () {
    this.timeout(5000);

    it('should return Google Pay configuration JSON', function () {
        var axiosInstance = createAxiosInstance();

        return axiosInstance.get(config.baseUrl + '/JPMCGooglePay-GetConfig', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(function (response) {
                assert.equal(response.status, 200);
                var body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                assert.isBoolean(body.enabled);
            });
    });
});

describe('JPMCGooglePay-StoreToken', function () {
    this.timeout(5000);

    it('should reject request without CSRF token', function () {
        var axiosInstance = createAxiosInstance();
        var cookies = '';

        var formData = 'token=' + encodeURIComponent(JSON.stringify({ signature: 'test', protocolVersion: 'ECv2' }));

        return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-StoreToken', formData, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies
            }
        })
            .then(function (response) {
                assert.include([301, 302, 403, 500], response.status, 'CSRF rejection should redirect or error');
            });
    });

    it('should store token with valid CSRF', function () {
        var axiosInstance = createAxiosInstance();
        var cookies = '';

        return axiosInstance.get(config.baseUrl + '/CSRF-Generate', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(function (csrfResponse) {
                if (csrfResponse.headers['set-cookie']) {
                    cookies = csrfResponse.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
                }
                var csrf = typeof csrfResponse.data === 'string' ? JSON.parse(csrfResponse.data).csrf : csrfResponse.data.csrf;
                var formData = 'token=' + encodeURIComponent(JSON.stringify({ signature: 'test', protocolVersion: 'ECv2' })) +
                               '&' + csrf.tokenName + '=' + encodeURIComponent(csrf.token);

                return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-StoreToken', formData, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': cookies
                    }
                });
            })
            .then(function (response) {
                assert.include([200, 301, 302], response.status);
                if (response.status === 200) {
                    var body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                    assert.isFalse(body.error);
                }
            });
    });
});

describe('JPMCGooglePay-ClearToken', function () {
    this.timeout(5000);

    it('should reject request without CSRF token', function () {
        var axiosInstance = createAxiosInstance();
        var cookies = '';

        return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-ClearToken', '', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies
            }
        })
            .then(function (response) {
                assert.include([301, 302, 403, 500], response.status, 'CSRF rejection should redirect or error');
            });
    });

    it('should clear token with valid CSRF', function () {
        var axiosInstance = createAxiosInstance();
        var cookies = '';

        return axiosInstance.get(config.baseUrl + '/CSRF-Generate', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(function (csrfResponse) {
                if (csrfResponse.headers['set-cookie']) {
                    cookies = csrfResponse.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
                }
                var csrf = typeof csrfResponse.data === 'string' ? JSON.parse(csrfResponse.data).csrf : csrfResponse.data.csrf;
                var formData = csrf.tokenName + '=' + encodeURIComponent(csrf.token);

                return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-ClearToken', formData, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': cookies
                    }
                });
            })
            .then(function (response) {
                assert.include([200, 301, 302], response.status);
                if (response.status === 200) {
                    var body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                    assert.isFalse(body.error);
                }
            });
    });
});

describe('JPMCGooglePay-SelectShippingDetails', function () {
    this.timeout(10000);

    var axiosInstance;
    var cookies = '';
    var variantPid = '701643421084M';

    before(function () {
        axiosInstance = createAxiosInstance();
        var formData = 'pid=' + encodeURIComponent(variantPid) + '&quantity=1';

        return axiosInstance.post(config.baseUrl + '/Cart-AddProduct', formData, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies
            }
        })
            .then(function (response) {
                if (response.headers['set-cookie']) {
                    cookies = response.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
                }
                assert.include([200, 301, 302], response.status);
            });
    });

    it('should reject request without CSRF token', function () {
        var payload = { address: { countryCode: 'US', postalCode: '01803', administrativeArea: 'MA', locality: 'Burlington' } };

        return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-SelectShippingDetails', JSON.stringify(payload), {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
                'Cookie': cookies
            }
        })
            .then(function (response) {
                assert.include([301, 302, 403, 500], response.status, 'CSRF rejection should redirect or error');
            });
    });

    it('should return shipping options with valid CSRF and address', function () {
        return axiosInstance.get(config.baseUrl + '/CSRF-Generate', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Cookie': cookies
            }
        })
            .then(function (csrfResponse) {
                if (csrfResponse.headers['set-cookie']) {
                    var newCookies = csrfResponse.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
                    cookies = cookies ? cookies + '; ' + newCookies : newCookies;
                }
                var csrf = typeof csrfResponse.data === 'string' ? JSON.parse(csrfResponse.data).csrf : csrfResponse.data.csrf;
                var payload = {
                    address: { countryCode: 'US', postalCode: '01803', administrativeArea: 'MA', locality: 'Burlington' }
                };
                payload[csrf.tokenName] = csrf.token;

                return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-SelectShippingDetails', JSON.stringify(payload), {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json',
                        'Cookie': cookies
                    }
                });
            })
            .then(function (response) {
                assert.include([200, 301, 302], response.status);
                if (response.status === 200) {
                    var body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                    assert.isObject(body);
                }
            });
    });
});

describe('JPMCGooglePay-SelectShippingMethod', function () {
    this.timeout(10000);

    var axiosInstance;
    var cookies = '';
    var variantPid = '701643421084M';

    before(function () {
        axiosInstance = createAxiosInstance();
        var formData = 'pid=' + encodeURIComponent(variantPid) + '&quantity=1';

        return axiosInstance.post(config.baseUrl + '/Cart-AddProduct', formData, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies
            },
            maxRedirects: 5
        })
            .then(function (response) {
                if (response.headers['set-cookie']) {
                    cookies = response.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
                }
                // Accept 200, 301, 302 (successful response or handled redirect)
                assert.include([200, 301, 302], response.status);
            });
    });

    it('should reject request without CSRF token', function () {
        var payload = { shippingMethodId: '001' };

        return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-SelectShippingMethod', JSON.stringify(payload), {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
                'Cookie': cookies
            }
        })
            .then(function (response) {
                assert.include([301, 302, 403, 500], response.status, 'CSRF rejection should redirect or error');
            });
    });

    it('should select shipping method with valid CSRF', function () {
        return axiosInstance.get(config.baseUrl + '/CSRF-Generate', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Cookie': cookies
            }
        })
            .then(function (csrfResponse) {
                if (csrfResponse.headers['set-cookie']) {
                    var newCookies = csrfResponse.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
                    cookies = cookies ? cookies + '; ' + newCookies : newCookies;
                }
                var csrf = typeof csrfResponse.data === 'string' ? JSON.parse(csrfResponse.data).csrf : csrfResponse.data.csrf;
                var payload = {
                    shippingMethodId: '001'
                };
                payload[csrf.tokenName] = csrf.token;

                return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-SelectShippingMethod', JSON.stringify(payload), {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json',
                        'Cookie': cookies
                    }
                });
            })
            .then(function (response) {
                assert.include([200, 301, 302], response.status);
                if (response.status === 200) {
                    var body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                    assert.isObject(body);
                }
            });
    });
});

describe('JPMCGooglePay-PrepareBasket', function () {
    this.timeout(10000);

    var axiosInstance;
    var cookies = '';
    var variantPid = '701643421084M';

    before(function () {
        axiosInstance = createAxiosInstance();
        var formData = 'pid=' + encodeURIComponent(variantPid) + '&quantity=1';

        return axiosInstance.post(config.baseUrl + '/Cart-AddProduct', formData, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies
            },
            maxRedirects: 5
        })
            .then(function (response) {
                if (response.headers['set-cookie']) {
                    cookies = response.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
                }
                // Accept 200, 301, 302 (successful response or handled redirect)
                assert.include([200, 301, 302], response.status);
            });
    });

    it('should reject request without CSRF token', function () {
        return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-PrepareBasket', '', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies
            }
        })
            .then(function (response) {
                assert.include([301, 302, 403, 500], response.status, 'CSRF rejection should redirect or error');
            });
    });

    it('should prepare basket with valid CSRF', function () {
        return axiosInstance.get(config.baseUrl + '/CSRF-Generate', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Cookie': cookies
            }
        })
            .then(function (csrfResponse) {
                if (csrfResponse.headers['set-cookie']) {
                    var newCookies = csrfResponse.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
                    cookies = cookies ? cookies + '; ' + newCookies : newCookies;
                }
                var csrf = typeof csrfResponse.data === 'string' ? JSON.parse(csrfResponse.data).csrf : csrfResponse.data.csrf;
                var formData = csrf.tokenName + '=' + encodeURIComponent(csrf.token);

                return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-PrepareBasket', formData, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': cookies
                    }
                });
            })
            .then(function (response) {
                assert.include([200, 301, 302], response.status);
                if (response.status === 200) {
                    var body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                    assert.isObject(body);
                }
            });
    });
});

describe('JPMCGooglePay-RestoreBasket', function () {
    this.timeout(5000);

    it('should reject request without CSRF token', function () {
        var axiosInstance = createAxiosInstance();
        var cookies = '';

        return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-RestoreBasket', '', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies
            }
        })
            .then(function (response) {
                assert.include([301, 302, 403, 500], response.status, 'CSRF rejection should redirect or error');
            });
    });

    it('should restore basket with valid CSRF', function () {
        var axiosInstance = createAxiosInstance();
        var cookies = '';

        return axiosInstance.get(config.baseUrl + '/CSRF-Generate', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(function (csrfResponse) {
                if (csrfResponse.headers['set-cookie']) {
                    cookies = csrfResponse.headers['set-cookie'].map(function(c) { return c.split(';')[0]; }).join('; ');
                }
                var csrf = typeof csrfResponse.data === 'string' ? JSON.parse(csrfResponse.data).csrf : csrfResponse.data.csrf;
                var formData = csrf.tokenName + '=' + encodeURIComponent(csrf.token);

                return axiosInstance.post(config.baseUrl + '/JPMCGooglePay-RestoreBasket', formData, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': cookies
                    }
                });
            })
            .then(function (response) {
                assert.include([200, 301, 302], response.status);
                if (response.status === 200) {
                    var body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                    assert.isFalse(body.error);
                }
            });
    });
});
