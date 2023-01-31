'use strict';
const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfProfileChangeModel = [
    'version',
    'merchant',
    'paymentInstrument',
    'profile',
    'cardPresent'
];

var proxyquireStubs = {
    MerchantModel: require('../../../../mocks/jpmcModelsMocks/jpmcMerchantModelMock.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test'),
    jpmcCardPresentModelMocks: require('../../../../mocks/jpmcModelsMocks/jpmcCardPresentModelMock.test')
};

describe('ProfileChangeModel unit test', function () {
    const ProfileChangeModelPath = '../../../../mocks/jpmcModelsMocks/jpmcProfileChangeModelMock.test.js';


    const ProfileChangeModel = proxyquire(ProfileChangeModelPath, {
        '*/cartridge/models/jpmcModels/jpmcMerchantModel': proxyquireStubs.MerchantModel,
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks,
        '*/cartridge/models/jpmcModels/jpmcCardPresentModel': proxyquireStubs.jpmcCardPresentModelMocks
    });
    describe('ProfileChangeModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            merchant: {
                bin: '000001'
            },
            paymentInstrument: {
                customerAccountType: 'CC',
                card: {
                    ccAccountNum: '5454545454545454',
                    ccExp: '202206'
                }
            },
            profile: {
                customerName: 'Customer Name',
                customerAddress1: '123 Main St',
                customerCity: 'Tampa',
                customerState: 'FL',
                customerZIP: '123456',
                customerEmail: 'email@email.com',
                customerPhone: '1234561234',
                customerCountryCode: 'US'
            },
            cardPresent: {
                emvInfo: {
                    vendorID: 'G022',
                    softwareID: 'O023'
                }
            }
        };

        let profileObject = new ProfileChangeModel(object);
        it('It should return ProfileChangeModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileChangeModel);
        });
        it('It should return ProfileChangeModel instance with keys', function () {
            assert.hasAllKeys(profileObject, allKeysOfProfileChangeModel);
        });
        it('It should return ProfileChangeModel instance version', function () {
            assert.equal(profileObject.version, object.version);
        });
        it('It should return ProfileChangeModel instance merchant', function () {
            assert.equal(profileObject.merchant, object.merchant);
        });
        it('It should return ProfileChangeModel instance paymentInstrument', function () {
            assert.equal(profileObject.paymentInstrument, object.paymentInstrument);
        });
        it('It should return ProfileChangeModel instance profile', function () {
            assert.equal(profileObject.profile, object.profile);
        });
        it('It should return ProfileChangeModel instance cardPresent', function () {
            assert.equal(profileObject.cardPresent, object.cardPresent);
        });
    });
    describe('getProfileChangeObject method unit test', function () {
        var profile = {
            phoneHome: '9876543210',
            email: 'customer@email.com',
            addressBook: { addresses: [{ fullName: 'name', address1: 'address1', city: 'city', stateCode: 'state', postalCode: '12345', countryCode: { value: '123456' } }
            ],
                length: 1 }
        };
        var token = '123456';
        var ccAccountNum = '5454545454545454';
        var ccNum = '202206';
        let profileObject = ProfileChangeModel.getProfileChangeObject(ccAccountNum, ccNum, profile, token, 'CC', {});
        it('It should return ProfileChangeModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileChangeModel);
        });
        it('It should return ProfileChangeModel instance version', function () {
            assert.equal(profileObject.version, '4.5');
        });
        it('It should return ProfileChangeModel instance merchant bin', function () {
            assert.equal(profileObject.merchant.bin, '000001');
        });
        it('It should return ProfileChangeModel instance paymentInstrument card ccAccountNum', function () {
            assert.equal(profileObject.paymentInstrument.card.ccAccountNum, '5454545454545454');
        });
        it('It should return ProfileChangeModel instance paymentInstrument customerAccountType', function () {
            assert.equal(profileObject.paymentInstrument.customerAccountType, 'CC');
        });
        it('It should return ProfileChangeModel instance profile customerName', function () {
            assert.equal(profileObject.profile.customerName, 'name');
        });
        it('It should return ProfileChangeModel instance profile customerAddress1', function () {
            assert.equal(profileObject.profile.customerAddress1, 'address1');
        });
        it('It should return ProfileChangeModel instance profile customerRefNum', function () {
            assert.equal(profileObject.profile.customerRefNum, '123456');
        });
        it('It should return ProfileChangeModel instance profile accountUpdaterEligibility', function () {
            assert.equal(profileObject.profile.accountUpdaterEligibility, 'Y');
        });
        it('It should return ProfileChangeModel instance profile status', function () {
            assert.equal(profileObject.profile.status, 'A');
        });
        it('It should return ProfileChangeModel instance cardPresent vendorID', function () {
            assert.equal(profileObject.cardPresent.emvInfo.vendorID, 'G022');
        });
        it('It should return ProfileChangeModel instance cardPresent softwareID', function () {
            assert.equal(profileObject.cardPresent.emvInfo.softwareID, 'O023');
        });
    });
});
