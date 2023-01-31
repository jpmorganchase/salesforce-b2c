const assert = require('assert');

var order = {
    currentOrderNo: '00004419',
    totalGrossPrice: { value: 99.74 },
    billingAddress: {
        address1: 'Address 1',
        address2: 'Address 2',
        city: 'Los Angeles',
        fullName: 'John Doe',
        phone: '5555555555',
        postalCode: '90001',
        stateCode: 'CA',
        countryCode: { value: 'US' }
    }
};

var AVSModel = require('../../../../mocks/jpmcModelsMocks/jpmcAVSModelMock.test');

describe('getAVSObjectForPayment', function () {
    it('should return an AVS Object', function () {
        var result = new AVSModel(AVSModel.getAVSObjectForPayment(order));
        assert.equal(result.avsAddress1, 'Address 1');
        assert.equal(result.avsAddress2, 'Address 2');
        assert.equal(result.avsCity, 'Los Angeles');
        assert.equal(result.avsCountryCode, 'US');
        assert.equal(result.avsZip, '90001');
        assert.equal(result.avsName, 'John Doe');
        assert.equal(result.avsPhone, '5555555555');
    });
});
