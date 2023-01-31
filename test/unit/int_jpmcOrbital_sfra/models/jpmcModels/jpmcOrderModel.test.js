
const assert = require('assert');
const proxyquire = require('proxyquire').noCallThru();

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

var stubObject = {
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

const OrderModelPath = '../../../../mocks/jpmcModelsMocks/jpmcOrderModelMock.test.js';
const OrderModel = proxyquire(OrderModelPath, {
    '*/cartridge/scripts/helpers/jpmcOConstantsHelper': stubObject.jpmcOConstantsHelperMocks

});
describe('getOrderObjectForCredit', function () {
    it('should return a orderObject with orderID and amount', function () {
        var result = new OrderModel(OrderModel.getOrderObjectForCredit(order));
        assert.equal(result.orderID, '00004419');
        assert.equal(result.amount, '9974');
    });
});

describe('getOrderObjectForProfile', function () {
    it('should return a orderObject with orderID and amount', function () {
        var result = new OrderModel(OrderModel.getOrderObjectForCredit(order));
        assert.equal(result.orderID, '00004419');
        assert.equal(result.amount, '9974');
    });
});
