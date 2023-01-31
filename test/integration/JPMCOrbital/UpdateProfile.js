var assert = require('chai').assert;
var request = require('request-promise');
var config = require('../it.config');
var chai = require('chai');
var chaiSubset = require('chai-subset');
chai.use(chaiSubset);

describe('updateProfile', function () {
    this.timeout(config.timeout);
    var cookieJar = request.jar();

    var myRequest = {
        url: '',
        method: 'POST',
        jar: cookieJar,
        rejectUnauthorized: false,
        resolveWithFullResponse: true,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    };
    myRequest.form = {
        customerNo: config.customerNo,
        customerToken: config.customerToken,
        paymentMethodID: ''
    };

    it('Should not update JPMC_ORBITAL_CC_METHOD', function () {
        var updateProfile = '/JPMCOrbitalController-UpdateProfile';
        myRequest.url = config.baseUrl + updateProfile;
        myRequest.form.paymentMethodID = 'JPMC_ORBITAL_CC_METHOD';
        myRequest.form.UUID = config.UUID_CC;
        myRequest.form.cardNumber = '5454545454545454';
        myRequest.form.month = '06';
        myRequest.form.year = '2021';

        var expectedResBody = {
            success: false,
            errorMessage: 'This Credit Card has expired'
        };

        return request(myRequest)
            .then(function (updateProfileResponse) {
                assert.containSubset(JSON.parse(updateProfileResponse.body), expectedResBody);
            });
    });

    it('Should update JPMC_ORBITAL_CC_METHOD with success', function (done) {
        myRequest.method = 'POST';
        myRequest.url = config.baseUrl + '/CSRF-Generate';
        myRequest.form.paymentMethodID = 'JPMC_ORBITAL_CC_METHOD';
        myRequest.form.UUID = config.UUID_CC;
        myRequest.form.cardNumber = '5454545454545454';
        myRequest.form.month = '06';
        myRequest.form.year = '2025';

        request(myRequest, function (error, response) {
            var csrfResponse = JSON.parse(response.body);
            var csrf = '&' + csrfResponse.csrf.tokenName + '=' + csrfResponse.csrf.token;
            var url = config.baseUrl + '/JPMCOrbitalController-UpdateProfile?' + config.customerNo + '&' + config.customerToken + '&' + config.UUID_CC + '&paymentMethodID=JPMC_ORBITAL_CC_METHOD' + csrf;
            myRequest.url = url;
            myRequest.method = 'POST';
            myRequest.headers['content-type'] = 'application/x-www-form-urlencoded';

            // eslint-disable-next-line no-shadow
            request(myRequest, function (error, response) {
                assert.equal(response.statusCode, 200, 'Expected statusCode to be 200.');
                assert.isNull(error, 'there was no error');
                assert.equal(JSON.parse(response.body).success, true);
                done();
            });
        });
    });

    it('Should update JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD with success', function (done) {
        myRequest.method = 'POST';
        myRequest.url = config.baseUrl + '/CSRF-Generate';
        myRequest.form.UUID = config.UUID_EC;
        myRequest.form.paymentMethodID = 'JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD';
        myRequest.form.transitNr = '122000247';
        myRequest.form.accNrDDA = '0888271156';
        myRequest.form.depAccType = 'C';

        request(myRequest, function (error, response) {
            var csrfResponse = JSON.parse(response.body);
            var csrf = '&' + csrfResponse.csrf.tokenName + '=' + csrfResponse.csrf.token;
            var url = config.baseUrl + '/JPMCOrbitalController-UpdateProfile?' + config.customerNo + '&' + config.customerToken + '&' + config.UUID_CC + '&paymentMethodID=JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD' + csrf;
            myRequest.url = url;
            myRequest.method = 'POST';
            myRequest.headers['content-type'] = 'application/x-www-form-urlencoded';

            // eslint-disable-next-line no-shadow
            request(myRequest, function (error, response) {
                assert.equal(response.statusCode, 200, 'Expected statusCode to be 200.');
                assert.isNull(error, 'there was no error');
                assert.equal(JSON.parse(response.body).success, true);
                done();
            });
        });
    });
});
