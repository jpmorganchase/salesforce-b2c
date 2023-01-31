'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfProfileModel = [
    'customerRefNum',
    'addProfileFromOrder',
    'profileOrderOverideInd',
    'useCustomerRefNum',
    'customerName',
    'customerAddress1',
    'customerCity',
    'customerState',
    'customerZIP',
    'customerEmail',
    'customerPhone',
    'customerCountryCode',
    'accountUpdaterEligibility'
];

var proxyquireStubs = {
    preferenceHelperMock: require('../../../../mocks/preferenceHelperMocks.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

describe('ProfileModel unit test', function () {
    const profileModelPath = '../../../../mocks/jpmcModelsMocks/jpmcProfileModelMock.test.js';

    const ProfileModel = proxyquire(profileModelPath, {
        '*/cartridge/scripts/helpers/preferenceHelper': proxyquireStubs.preferenceHelperMock,
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks
    });
    describe('ProfileModel constructor function unit test', function () {
        let object = {
            customerRefNum: '218850506',
            addProfileFromOrder: 'S',
            profileOrderOverideInd: 'NO',
            useCustomerRefNum: '218850506',
            customerName: 'name',
            customerAddress1: 'address1',
            customerCity: 'city',
            customerState: 'state',
            customerZIP: '12345',
            customerEmail: 'customer@email.com',
            customerPhone: '9876543210',
            customerCountryCode: '123456',
            accountUpdaterEligibility: 'N'
        };

        let profileObject = new ProfileModel(object);
        it('It should return ProfileModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileModel);
        });
        it('It should return ProfileModel instance with keys', function () {
            assert.hasAllKeys(profileObject, allKeysOfProfileModel);
        });
        it('It should return ProfileModel instance customerRefNum', function () {
            assert.equal(profileObject.customerRefNum, object.customerRefNum);
        });
        it('It should return ProfileModel instance addProfileFromOrder', function () {
            assert.equal(profileObject.addProfileFromOrder, object.addProfileFromOrder);
        });
        it('It should return ProfileModel instance profileOrderOverideInd', function () {
            assert.equal(profileObject.profileOrderOverideInd, object.profileOrderOverideInd);
        });
        it('It should return ProfileModel instance useCustomerRefNum', function () {
            assert.equal(profileObject.useCustomerRefNum, object.useCustomerRefNum);
        });
        it('It should return ProfileModel instance customerName', function () {
            assert.equal(profileObject.customerName, object.customerName);
        });
        it('It should return ProfileModel instance customerAddress1', function () {
            assert.equal(profileObject.customerAddress1, object.customerAddress1);
        });
        it('It should return ProfileModel instance customerCity', function () {
            assert.equal(profileObject.customerCity, object.customerCity);
        });
        it('It should return ProfileModel instance customerState', function () {
            assert.equal(profileObject.customerState, object.customerState);
        });
        it('It should return ProfileModel instance customerZIP', function () {
            assert.equal(profileObject.customerZIP, object.customerZIP);
        });
        it('It should return ProfileModel instance customerEmail', function () {
            assert.equal(profileObject.customerEmail, object.customerEmail);
        });
        it('It should return ProfileModel instance customerPhone', function () {
            assert.equal(profileObject.customerPhone, object.customerPhone);
        });
        it('It should return ProfileModel instance customerCountryCode', function () {
            assert.equal(profileObject.customerCountryCode, object.customerCountryCode);
        });
        it('It should return ProfileModel instance accountUpdaterEligibility', function () {
            assert.equal(profileObject.accountUpdaterEligibility, object.accountUpdaterEligibility);
        });
    });
    describe('getProfileObjectFromOrder method unit test', function () {
        var order = {
            customerName: 'name',
            customerEmail: 'customer@email.com',
            billingAddress: { address1: 'address1', city: 'city', stateCode: 'state', postalCode: '12345', phone: '9876543210', countryCode: { value: '123456' } },
            accountUpdaterEligibility: 'N'
        };
        let profileObject = ProfileModel.getProfileObjectFromOrder(order);
        it('It should return ProfileModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileModel);
        });
        it('It should return ProfileModel instance customerName', function () {
            assert.equal(profileObject.customerName, 'name');
        });
        it('It should return ProfileModel instance customerAddress1', function () {
            assert.equal(profileObject.customerAddress1, 'address1');
        });
        it('It should return ProfileModel instance customerCity', function () {
            assert.equal(profileObject.customerCity, 'city');
        });
        it('It should return ProfileModel instance customerState', function () {
            assert.equal(profileObject.customerState, 'state');
        });
        it('It should return ProfileModel instance customerZIP', function () {
            assert.equal(profileObject.customerZIP, '12345');
        });
        it('It should return ProfileModel instance customerEmail', function () {
            assert.equal(profileObject.customerEmail, 'customer@email.com');
        });
        it('It should return ProfileModel instance customerPhone', function () {
            assert.equal(profileObject.customerPhone, '9876543210');
        });
        it('It should return ProfileModel instance customerCountryCode', function () {
            assert.equal(profileObject.customerCountryCode, '123456');
        });
        it('It should return ProfileModel instance accountUpdaterEligibility', function () {
            assert.equal(profileObject.accountUpdaterEligibility, 'N');
        });
    });
    describe('getProfileObjectFromAccount method unit test', function () {
        var customer = {
            phoneHome: '9876543210',
            email: 'customer@email.com',
            addressBook: { addresses: [{ fullName: 'name', address1: 'address1', city: 'city', stateCode: 'state', postalCode: '12345', countryCode: { value: '123456' } }
            ],
                length: 1 }
        };
        let profileObject = ProfileModel.getProfileObjectFromAccount(customer);
        it('It should return ProfileAddModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileModel);
        });
        it('It should return ProfileAddModel instance profile customerName', function () {
            assert.equal(profileObject.customerName, 'name');
        });
        it('It should return ProfileAddModel instance profile customerAddress1', function () {
            assert.equal(profileObject.customerAddress1, 'address1');
        });
        it('It should return ProfileAddModel instance profile customerCity', function () {
            assert.equal(profileObject.customerCity, 'city');
        });
        it('It should return ProfileAddModel instance profile customerState', function () {
            assert.equal(profileObject.customerState, 'state');
        });
        it('It should return ProfileAddModel instance profile customerZIP', function () {
            assert.equal(profileObject.customerZIP, '12345');
        });
        it('It should return ProfileAddModel instance profile customerEmail', function () {
            assert.equal(profileObject.customerEmail, 'customer@email.com');
        });
        it('It should return ProfileAddModel instance profile customerPhone', function () {
            assert.equal(profileObject.customerPhone, '9876543210');
        });
        it('It should return ProfileAddModel instance profile customerCountryCode', function () {
            assert.equal(profileObject.customerCountryCode, '123456');
        });
    });
    describe('getInstrumentProfileObject method unit test', function () {
        var useCustomerRefNum = '12345';
        var result = new ProfileModel(ProfileModel.getInstrumentProfileObject(useCustomerRefNum));
        assert.equal(result.useCustomerRefNum, '12345');
    });
});
