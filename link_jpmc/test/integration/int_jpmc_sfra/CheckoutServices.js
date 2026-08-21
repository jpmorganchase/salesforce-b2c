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

describe('CheckoutServices-Fail3DSOrder', function () {
    this.timeout(10000);

    it('should reject request without CSRF token', function () {
        var axiosInstance = createAxiosInstance();
        var cookies = '';

        return axiosInstance.post(config.baseUrl + '/CheckoutServices-Fail3DSOrder', '', {
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

    it('should return error for missing order with valid CSRF', function () {
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
                return axiosInstance.post(config.baseUrl + '/CheckoutServices-Fail3DSOrder', formData, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': cookies
                    }
                });
            })
            .then(function (response) {
                if (response.status === 200) {
                    var body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                    assert.isTrue(body.error);
                } else {
                    assert.include([301, 302, 500], response.status);
                }
            });
    });
});
