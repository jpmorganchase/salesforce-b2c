'use strict';

const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

const allKeysOfProfileAddModel = [
    'version',
    'merchant',
    'order',
    'paymentInstrument',
    'profile',
    'cardPresent'
];

var proxyquireStubs = {
    CardModel: require('../../../../mocks/jpmcModelsMocks/jpmcCardModelMock.test'),
    ProfileModel: require('../../../../mocks/jpmcModelsMocks/jpmcProfileModelMock.test'),
    MerchantModel: require('../../../../mocks/jpmcModelsMocks/jpmcMerchantModelMock.test'),
    ElectronicCheckModel: require('../../../../mocks/jpmcModelsMocks/jpmcElectronicCheckModelMock.test'),
    preferenceHelperMock: require('../../../../mocks/preferenceHelperMocks.test'),
    OrbitalAPIHelper: require('../../../../mocks/orbitalAPIHelperMocks.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test'),
    jpmcCardPresentModelMocks: require('../../../../mocks/jpmcModelsMocks/jpmcCardPresentModelMock.test')
};

describe('ProfileAddModel unit test', function () {
    const ProfileAddModelPath = '../../../../mocks/jpmcModelsMocks/jpmcProfileAddModelMock.test.js';
    const ProfileAddModel = proxyquire(ProfileAddModelPath, {
        '*/cartridge/scripts/helpers/preferenceHelper': proxyquireStubs.preferenceHelperMock,
        '*/cartridge/models/jpmcModels/jpmcProfileModel': proxyquireStubs.ProfileModel,
        '*/cartridge/models/jpmcModels/jpmcMerchantModel': proxyquireStubs.MerchantModel,
        '*/cartridge/models/jpmcModels/jpmcCardModel': proxyquireStubs.CardModel,
        '*/cartridge/models/jpmcModels/jpmcElectronicCheckModel': proxyquireStubs.ElectronicCheckModel,
        '*/cartridge/scripts/helpers/orbitalAPIHelper': proxyquireStubs.OrbitalAPIHelper,
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks,
        '*/cartridge/models/jpmcModels/jpmcCardPresentModel': proxyquireStubs.jpmcCardPresentModelMocks
    });
    describe('ProfileAddModel constructor function unit test', function () {
        let object = {
            version: '4.5',
            merchant: {
                bin: '000001'
            },
            order: {
                customerProfileOrderOverideInd: 'NO',
                customerProfileFromOrderInd: 'A',
                orderDefaultAmount: '1050'
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

        let profileObject = new ProfileAddModel(object);
        it('It should return ProfileAddModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileAddModel);
        });
        it('It should return ProfileAddModel instance with keys', function () {
            assert.hasAllKeys(profileObject, allKeysOfProfileAddModel);
        });
        it('It should return ProfileAddModel instance version', function () {
            assert.equal(profileObject.version, object.version);
        });
        it('It should return ProfileAddModel instance merchant', function () {
            assert.equal(profileObject.merchant, object.merchant);
        });
        it('It should return ProfileAddModel instance order', function () {
            assert.equal(profileObject.order, object.order);
        });
        it('It should return ProfileAddModel instance paymentInstrument', function () {
            assert.equal(profileObject.paymentInstrument, object.paymentInstrument);
        });
        it('It should return ProfileAddModel instance profile', function () {
            assert.equal(profileObject.profile, object.profile);
        });
        it('It should return ProfileAddModel instance cardPresent', function () {
            assert.equal(profileObject.cardPresent, object.cardPresent);
        });
    });
    describe('getProfileAddObject method unit test', function () {
        var order = {
            customerName: 'name',
            customerEmail: 'customer@email.com',
            billingAddress: { address1: 'address1', city: 'city', stateCode: 'state', postalCode: '12345', phone: '9876543210', countryCode: { value: '123456' } },
            accountUpdaterEligibility: 'N'
        };
        var type = 'CC';
        var paymentObject = {
            paymentInstrument: {
                card: {
                    ccAccountNum: '5454545454545454',
                    ccExp: '202206'
                }
            },
            merchant: {
                bin: '000001'
            }
        };
        var paymentInstrument = {
            card: {
                ccAccountNum: '5454545454545454',
                ccExp: '202206'
            }
        };
        let profileObject = ProfileAddModel.getProfileAddObject(order, paymentObject, paymentInstrument, type);
        it('It should return ProfileAddModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileAddModel);
        });
        it('It should return ProfileAddModel instance version', function () {
            assert.equal(profileObject.version, '4.5');
        });
        it('It should return ProfileAddModel instance merchant bin', function () {
            assert.equal(profileObject.merchant.bin, '000001');
        });
        it('It should return ProfileAddModel instance order customerProfileOrderOverideInd ', function () {
            assert.equal(profileObject.order.customerProfileOrderOverideInd, 'NO');
        });
        it('It should return ProfileAddModel instance order customerProfileFromOrderInd', function () {
            assert.equal(profileObject.order.customerProfileFromOrderInd, 'A');
        });
        it('It should return ProfileAddModel instance order orderDefaultAmount', function () {
            assert.equal(profileObject.order.orderDefaultAmount, '1000');
        });
        it('It should return ProfileAddModel instance paymentInstrument card ccAccountNum', function () {
            assert.equal(profileObject.paymentInstrument.card.ccAccountNum, '5454545454545454');
        });
        it('It should return ProfileAddModel instance paymentInstrument customerAccountType', function () {
            assert.equal(profileObject.paymentInstrument.customerAccountType, 'CC');
        });
        it('It should return ProfileAddModel instance profile customerName', function () {
            assert.equal(profileObject.profile.customerName, 'name');
        });
        it('It should return ProfileAddModel instance profile customerAddress1', function () {
            assert.equal(profileObject.profile.customerAddress1, 'address1');
        });
        it('It should return ProfileAddModel instance profile customerCity', function () {
            assert.equal(profileObject.profile.customerCity, 'city');
        });
        it('It should return ProfileAddModel instance profile customerState', function () {
            assert.equal(profileObject.profile.customerState, 'state');
        });
        it('It should return ProfileAddModel instance profile customerZIP', function () {
            assert.equal(profileObject.profile.customerZIP, '12345');
        });
        it('It should return ProfileAddModel instance profile customerEmail', function () {
            assert.equal(profileObject.profile.customerEmail, 'customer@email.com');
        });
        it('It should return ProfileAddModel instance profile customerPhone', function () {
            assert.equal(profileObject.profile.customerPhone, '9876543210');
        });
        it('It should return ProfileAddModel instance profile customerCountryCode', function () {
            assert.equal(profileObject.profile.customerCountryCode, '123456');
        });
        it('It should return ProfileAddModel instance  cardPresent vendorID', function () {
            assert.equal(profileObject.cardPresent.emvInfo.vendorID, 'G022');
        });
        it('It should return ProfileAddModel instance cardPresent softwareID', function () {
            assert.equal(profileObject.cardPresent.emvInfo.softwareID, 'O023');
        });
    });
    describe('getProfileAddObjectFromAccount method unit test', function () {
        var customer = {
            phoneHome: '9876543210',
            email: 'customer@email.com',
            addressBook: { addresses: [{ fullName: 'name', address1: 'address1', city: 'city', stateCode: 'state', postalCode: '12345', countryCode: { value: '123456' } }
            ],
                length: 1 }
        };
        var type = 'CC';
        var card = {
            cardNumber: { value: '5454545454545454' },
            expirationYear: { value: '2022' },
            expirationMonth: { value: '06' },
            cardType: {
                value: 'Master Card'
            }
        };
        let profileObject = ProfileAddModel.getProfileAddObjectFromAccount(card, customer, type);
        it('It should return ProfileAddModel instance as typeof object', function () {
            assert.typeOf(profileObject, 'object');
            assert.instanceOf(profileObject, ProfileAddModel);
        });
        it('It should return ProfileAddModel instance version', function () {
            assert.equal(profileObject.version, '4.5');
        });
        it('It should return ProfileAddModel instance merchant bin', function () {
            assert.equal(profileObject.merchant.bin, '000001');
        });
        it('It should return ProfileAddModel instance order customerProfileOrderOverideInd ', function () {
            assert.equal(profileObject.order.customerProfileOrderOverideInd, 'NO');
        });
        it('It should return ProfileAddModel instance order customerProfileFromOrderInd', function () {
            assert.equal(profileObject.order.customerProfileFromOrderInd, 'A');
        });
        it('It should return ProfileAddModel instance order orderDefaultAmount', function () {
            assert.equal(profileObject.order.orderDefaultAmount, '1000');
        });
        it('It should return ProfileAddModel instance paymentInstrument card ccAccountNum', function () {
            assert.equal(profileObject.paymentInstrument.card.ccAccountNum, '5454545454545454');
        });
        it('It should return ProfileAddModel instance paymentInstrument customerAccountType', function () {
            assert.equal(profileObject.paymentInstrument.customerAccountType, 'CC');
        });
        it('It should return ProfileAddModel instance profile customerName', function () {
            assert.equal(profileObject.profile.customerName, 'name');
        });
        it('It should return ProfileAddModel instance profile customerAddress1', function () {
            assert.equal(profileObject.profile.customerAddress1, 'address1');
        });
        it('It should return ProfileAddModel instance profile customerCity', function () {
            assert.equal(profileObject.profile.customerCity, 'city');
        });
        it('It should return ProfileAddModel instance profile customerState', function () {
            assert.equal(profileObject.profile.customerState, 'state');
        });
        it('It should return ProfileAddModel instance profile customerZIP', function () {
            assert.equal(profileObject.profile.customerZIP, '12345');
        });
        it('It should return ProfileAddModel instance profile customerEmail', function () {
            assert.equal(profileObject.profile.customerEmail, 'customer@email.com');
        });
        it('It should return ProfileAddModel instance profile customerPhone', function () {
            assert.equal(profileObject.profile.customerPhone, '9876543210');
        });
        it('It should return ProfileAddModel instance profile customerCountryCode', function () {
            assert.equal(profileObject.profile.customerCountryCode, '123456');
        });
        it('It should return ProfileAddModel instance  cardPresent vendorID', function () {
            assert.equal(profileObject.cardPresent.emvInfo.vendorID, 'G022');
        });
        it('It should return ProfileAddModel instance cardPresent softwareID', function () {
            assert.equal(profileObject.cardPresent.emvInfo.softwareID, 'O023');
        });
    });
});
