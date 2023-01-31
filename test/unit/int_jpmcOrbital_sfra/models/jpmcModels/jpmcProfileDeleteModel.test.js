'use strict';
const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfProfileDeleteModel = [
    'version',
    'merchant',
    'profile'
];

var proxyquireStubs = {
    MerchantModel: require('../../../../mocks/jpmcModelsMocks/jpmcMerchantModelMock.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

describe('ProfileDeleteModel unit test', function () {
    const ProfileDeleteModelPath = '../../../../mocks/jpmcModelsMocks/jpmcProfileDeleteModelMock.test.js';

    const ProfileDeleteModel = proxyquire(ProfileDeleteModelPath, {
        '*/cartridge/models/jpmcModels/jpmcMerchantModel': proxyquireStubs.MerchantModel,
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks
    });
    describe('ProfileDeleteModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            merchant: {
                bin: '000001'
            },
            profile: {
                customerRefNum: '123456'
            }
        };

        let profileObject = new ProfileDeleteModel(object);
        it('It should return ProfileDeleteModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileDeleteModel);
        });
        it('It should return ProfileDeleteModel instance with keys', function () {
            assert.hasAllKeys(profileObject, allKeysOfProfileDeleteModel);
        });
        it('It should return ProfileDeleteModel instance version', function () {
            assert.equal(profileObject.version, object.version);
        });
        it('It should return ProfileDeleteModel instance merchant', function () {
            assert.equal(profileObject.merchant, object.merchant);
        });
        it('It should return ProfileDeleteModel instance profile', function () {
            assert.equal(profileObject.profile, object.profile);
        });
    });
    describe('getProfileDeleteObject method unit test', function () {
        var customerRefNum = '123456';
        let profileObject = ProfileDeleteModel.getProfileDeleteObject(customerRefNum);
        it('It should return ProfileDeleteModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileDeleteModel);
        });
        it('It should return ProfileDeleteModel instance version', function () {
            assert.equal(profileObject.version, '4.5');
        });
        it('It should return ProfileDeleteModel instance merchant bin', function () {
            assert.equal(profileObject.merchant.bin, '000001');
        });
        it('It should return ProfileDeleteModel instance profile customerRefNum', function () {
            assert.equal(profileObject.profile.customerRefNum, '123456');
        });
    });
});
