'use strict';

var JPMCOrbitalConstants = {};

// Paymet methods types
JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD = 'JPMC_ORBITAL_CC_METHOD';
JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD = 'JPMC_ORBITAL_PROFILE_METHOD';
JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD = 'JPMC_ORBITAL_GOOGLEPAY_METHOD';
JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD = 'JPMC_ORBITAL_APPLEPAY_METHOD';
JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD = 'JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD';
JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD = 'VISA_CHECKOUT';
JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY = 'JPMC_ORBITAL_PROFILE_METHOD_GOOGLE_PAY';
JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_APPLE_PAY = 'JPMC_ORBITAL_PROFILE_METHOD_APPLE_PAY';
JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK = 'JPMC_ORBITAL_PROFILE_METHOD_ELECTRONIC_CHECK';
JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_CARD = 'JPMC_ORBITAL_PROFILE_METHOD_CARD';
JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD_VISA_CHECKOUT = 'VISA_CHECKOUT';
JPMCOrbitalConstants.CREDIT_CARD = 'CREDIT_CARD';
JPMCOrbitalConstants.GIFT_CERTIFICATE = 'GIFT_CERTIFICATE';

// Credit card types
JPMCOrbitalConstants.Card = 'Card';
JPMCOrbitalConstants.Visa = 'Visa';
JPMCOrbitalConstants.Amex = 'Amex';
JPMCOrbitalConstants.Discover = 'Discover';
JPMCOrbitalConstants.Diners = 'DinersClub';
JPMCOrbitalConstants.Master_Card = 'Master Card';
JPMCOrbitalConstants.International_Maestro = 'International Maestro';
JPMCOrbitalConstants.GOOGLE = 'GOOGLE';
JPMCOrbitalConstants.APPLE = 'APPLE';
JPMCOrbitalConstants.VISA_CHECKOUT = 'VISA CHECKOUT';
JPMCOrbitalConstants.Unknown = 'Unknown';
JPMCOrbitalConstants.Jcb = 'Japan Credit Bureau';
JPMCOrbitalConstants.EC = 'EC';
JPMCOrbitalConstants.DI = 'DI';
JPMCOrbitalConstants.CC = 'CC';
JPMCOrbitalConstants.ED = 'ED';
JPMCOrbitalConstants.VI = 'VI';
JPMCOrbitalConstants.AX = 'AX';
JPMCOrbitalConstants.MC = 'MC';
JPMCOrbitalConstants.JC = 'JC';
JPMCOrbitalConstants.IM = 'IM';

// Currency codes
JPMCOrbitalConstants.GBP = 'GBP';
JPMCOrbitalConstants.EUR = 'EUR';
JPMCOrbitalConstants.currencyCodes = {
    AFN: '971',
    ALL: '8',
    DZD: '12',
    AOA: '973',
    ARS: '32',
    AMD: '51',
    AWG: '533',
    AUD: '36',
    AZN: '944',
    BSD: '44',
    BDT: '50',
    BBD: '52',
    BYR: '933',
    BZD: '84',
    BMD: '60',
    BOB: '68',
    BAM: '977',
    BWP: '72',
    BRL: '986',
    GBP: '826',
    BND: '96',
    BGN: '975',
    BIF: '108',
    BTN: '64',
    XOF: '952',
    XAF: '950',
    XPF: '953',
    CAD: '124',
    KHR: '116',
    CVE: '132',
    KYD: '136',
    CLP: '152',
    CNY: '156',
    COP: '170',
    KMF: '174',
    CDF: '976',
    CRC: '188',
    HRK: '191',
    CZK: '203',
    DKK: '208',
    DJF: '262',
    DOP: '214',
    XCD: '951',
    EGP: '818',
    SVC: '222',
    ETB: '230',
    EUR: '978',
    FKP: '238',
    FJD: '242',
    GMD: '270',
    GEL: '981',
    GHS: '936',
    GIP: '292',
    GTQ: '320',
    GNF: '324',
    GWP: '624',
    GYD: '328',
    HTG: '332',
    HNL: '340',
    HKD: '344',
    HUF: '348',
    ISK: '352',
    INR: '356',
    IDR: '360',
    ILS: '376',
    JMD: '388',
    JPY: '392',
    KZT: '398',
    KES: '404',
    KGS: '417',
    LAK: '418',
    LVL: '422',
    LSL: '426',
    LRD: '430',
    MOP: '446',
    MGA: '969',
    MWK: '454',
    MYR: '458',
    MVR: '462',
    MRO: '478',
    MUR: '480',
    MXN: '484',
    MDL: '498',
    MNT: '496',
    MAD: '504',
    MZN: '943',
    MMK: '104',
    NAD: '516',
    NPR: '524',
    NLG: '532',
    PGK: '598',
    NZD: '554',
    NIO: '558',
    NGN: '566',
    NOK: '578',
    PKR: '586',
    PAB: '590',
    PYG: '600',
    PEN: '604',
    PHP: '608',
    PLN: '985',
    QAR: '634',
    RON: '946',
    RUB: '643',
    RWF: '646',
    SHP: '654',
    WST: '882',
    STD: '678',
    SAR: '682',
    RSD: '941',
    SCR: '690',
    SLL: '694',
    SGD: '702',
    SBD: '90',
    SOS: '706',
    ZAR: '710',
    KRW: '410',
    LKR: '144',
    SRD: '968',
    SZL: '748',
    SEK: '752',
    CHF: '756',
    TWD: '901',
    TJS: '972',
    TZS: '834',
    THB: '764',
    TOP: '776',
    TTD: '780',
    TL: '949',
    UGX: '800',
    UAH: '980',
    AED: '784',
    UYU: '858',
    USD: '840',
    UZM: '860',
    VUV: '548',
    VND: '704',
    YER: '886',
    ZMK: '967',
    ZWD: '716'
};

// Payment platform mode
JPMCOrbitalConstants.stratus = '000001';
JPMCOrbitalConstants.tandem = '000002';

// Payment status
JPMCOrbitalConstants.IA = 'IA';
JPMCOrbitalConstants.PC = 'PC';
JPMCOrbitalConstants.OK = 'OK';
JPMCOrbitalConstants.RV = 'RV';
JPMCOrbitalConstants.C = 'C';
JPMCOrbitalConstants.RF = 'RF';
JPMCOrbitalConstants.PRF = 'PRF';
JPMCOrbitalConstants.Status_Message = 'Status message: ';
JPMCOrbitalConstants.Approved = 'Approved';
JPMCOrbitalConstants.Declined = 'Declined';

// Payment transaction types
JPMCOrbitalConstants.Authorization = 'A';
JPMCOrbitalConstants.AuthorizationAndCapture = 'AC';
JPMCOrbitalConstants.ForceAndCapture = 'FC';

// Payment actions CSC
JPMCOrbitalConstants.incrementalAuthorization = 'Incremental Authorization ';
JPMCOrbitalConstants.reversal = 'Reversal ';
JPMCOrbitalConstants.capture = 'Capture ';
JPMCOrbitalConstants.refund = 'Refund ';

// MIT message types
JPMCOrbitalConstants.MINC = 'MINC';
JPMCOrbitalConstants.MUSE = 'MUSE';
JPMCOrbitalConstants.MRAU = 'MRAU';
JPMCOrbitalConstants.CEST = 'CEST';
JPMCOrbitalConstants.CSTO = 'CSTO';
JPMCOrbitalConstants.CGEN = 'CGEN';
JPMCOrbitalConstants.CUSE = 'CUSE';
JPMCOrbitalConstants.MREC = 'MREC';

// Card indicators
JPMCOrbitalConstants.Y = 'Y';
JPMCOrbitalConstants.P = 'P';

// Action code
JPMCOrbitalConstants.TK = 'TK';

// Token type
JPMCOrbitalConstants.UT = 'UT';

// Other
JPMCOrbitalConstants.JPMC = 'JPMC';
JPMCOrbitalConstants.null = 'null';
JPMCOrbitalConstants.undefined = 'undefined';
JPMCOrbitalConstants.version = '4.5';
JPMCOrbitalConstants.TxRefNumber = ' TxRefNumber: ';
JPMCOrbitalConstants.N = 'N';
JPMCOrbitalConstants.NO = 'NO';
JPMCOrbitalConstants.orderDefaultAmount = '1000';
JPMCOrbitalConstants.ccCardVerifyPresenceInd = '1';
JPMCOrbitalConstants.n_0 = '0';
JPMCOrbitalConstants.terminalID = '001';
JPMCOrbitalConstants.pieFormatID = '64';
JPMCOrbitalConstants.latitudeLongitude = '1,1';
JPMCOrbitalConstants.FPE = 'FPE';
JPMCOrbitalConstants.S = 'S';
JPMCOrbitalConstants.hidden = 'hidden-xl-down';
JPMCOrbitalConstants.retryTrace = 'retryTrace';
JPMCOrbitalConstants.googleWallet = '2';
JPMCOrbitalConstants.appleWallet = '1';
JPMCOrbitalConstants.visaWallet = '3';
JPMCOrbitalConstants.intgrityCheck = 'intgrityCheck';
JPMCOrbitalConstants.keyID = 'keyID';
JPMCOrbitalConstants.n_20 = '20';
JPMCOrbitalConstants.stratus_vendorID = 'G022';
JPMCOrbitalConstants.stratus_softwareID = 'O023';
JPMCOrbitalConstants.tandem_vendorID = '0167';
JPMCOrbitalConstants.tandem_softwareID = '0278';

// Customer saved payment type
JPMCOrbitalConstants.orbitalProfile = 'orbitalProfile';
JPMCOrbitalConstants.safetechToken = 'safetechToken';

// Retry trace attribute
JPMCOrbitalConstants.getCaptureObject = 'getCaptureObject';
JPMCOrbitalConstants.getRefundObject = 'getRefundObject';
JPMCOrbitalConstants.getReversalObject = 'getReversalObject';
JPMCOrbitalConstants.getPaymentObjectForCardAuthorizationOnly = 'getPaymentObjectForCardAuthorizationOnly';
JPMCOrbitalConstants.getPaymentObjectForCardAuthorizationAndCapture = 'getPaymentObjectForCardAuthorizationAndCapture';
JPMCOrbitalConstants.getPaymentObjectForProfileAuthorizationOnly = 'getPaymentObjectForProfileAuthorizationOnly';
JPMCOrbitalConstants.getPaymentObjectForProfileAuthorizationAndCapture = 'getPaymentObjectForProfileAuthorizationAndCapture';
JPMCOrbitalConstants.getPaymentObjectForElectronicCheckAuthorizationOnly = 'getPaymentObjectForElectronicCheckAuthorizationOnly';
JPMCOrbitalConstants.getPaymentObjectForElectronicCheckAuthorizationAndCapture = 'getPaymentObjectForElectronicCheckAuthorizationAndCapture';
JPMCOrbitalConstants.getPaymentObjectForCardZeroAuth = 'getPaymentObjectForCardZeroAuth';
JPMCOrbitalConstants.getPaymentObjectForGooglePayAuthorizationOnly = 'getPaymentObjectForGooglePayAuthorizationOnly';
JPMCOrbitalConstants.getPaymentObjectForGooglePayAuthorizationAndCapture = 'getPaymentObjectForGooglePayAuthorizationAndCapture';
JPMCOrbitalConstants.getPaymentObjectForApplePayAuthorizationOnly = 'getPaymentObjectForApplePayAuthorizationOnly';
JPMCOrbitalConstants.getPaymentObjectForApplePayAuthorizationAndCapture = 'getPaymentObjectForApplePayAuthorizationAndCapture';
JPMCOrbitalConstants.getPaymentObjectForElectronicCheckAuthorizationOnly = 'getPaymentObjectForElectronicCheckAuthorizationOnly';
JPMCOrbitalConstants.getPaymentObjectForVisaPayAuthorizationOnly = 'getPaymentObjectForVisaPayAuthorizationOnly';
JPMCOrbitalConstants.getPaymentObjectForVisaPayAuthorizationAndCapture = 'getPaymentObjectForVisaPayAuthorizationAndCapture';

// Preference helper values
JPMCOrbitalConstants.jpmcOEnabled = 'jpmcOEnabled';
JPMCOrbitalConstants.jpmcOGooglePayEnabled = 'jpmcOGooglePayEnabled';
JPMCOrbitalConstants.jpmcOApplePayEnabled = 'jpmcOApplePayEnabled';
JPMCOrbitalConstants.jpmcOAVSEnabled = 'jpmcOAVSEnabled';
JPMCOrbitalConstants.jpmcOIncrementalAuthorizationEnabled = 'jpmcOIncrementalAuthorizationEnabled';
JPMCOrbitalConstants.jpmcOPlatformMode = 'jpmcOPlatformMode';
JPMCOrbitalConstants.jpmcOCustomerSavedPaymentType = 'jpmcOCustomerSavedPaymentType';
JPMCOrbitalConstants.jpmcOPageEncryptionEnabled = 'jpmcOPageEncryptionEnabled';
JPMCOrbitalConstants.jpmcOPageEncryptionConfigurationSubID = 'jpmcOPageEncryptionConfigurationSubID';
JPMCOrbitalConstants.jpmcOPageEncryptionConfiguration = 'jpmcOPageEncryptionConfiguration';
JPMCOrbitalConstants.testing = 'testing';
JPMCOrbitalConstants.live = 'live';
JPMCOrbitalConstants.jpmcOAVSUnacceptedValues = 'jpmcOAVSUnacceptedValues';
JPMCOrbitalConstants.jpmcOVisaPayApiKey = 'jpmcOVisaPayApiKey';
JPMCOrbitalConstants.jpmcOVisaPayEnabled = 'jpmcOVisaPayEnabled';
JPMCOrbitalConstants.jpmcOPaymentModeVisaPay = 'jpmcOPaymentModeVisaPay';
JPMCOrbitalConstants.jpmcEnabledUpdateProfile = 'jpmcEnabledUpdateProfile';
JPMCOrbitalConstants.jpmcOGooglePayConfAllowedCardNetworks = 'jpmcOGooglePayConfAllowedCardNetworks';
JPMCOrbitalConstants.jpmcOGooglePayConfMerchantEnviroment = 'jpmcOGooglePayConfMerchantEnviroment';
JPMCOrbitalConstants.jpmcOApplePayConfAllowedCardNetworks = 'jpmcOApplePayConfAllowedCardNetworks';
JPMCOrbitalConstants.jpmcOApplePayConfMerchantEnviroment = 'jpmcOApplePayConfMerchantEnviroment';
JPMCOrbitalConstants.TEST = 'TEST';
JPMCOrbitalConstants.jpmcOGooglePayConfMerchantId = 'jpmcOGooglePayConfMerchantId';
JPMCOrbitalConstants.jpmcOGooglePayConfMerchantName = 'jpmcOGooglePayConfMerchantName';
JPMCOrbitalConstants.jpmcOApplePayConfMerchantId = 'jpmcOApplePayConfMerchantId';
JPMCOrbitalConstants.jpmcOApplePayConfMerchantName = 'jpmcOApplePayConfMerchantName';
JPMCOrbitalConstants.jpmcOPaymentModeCard = 'jpmcOPaymentModeCard';
JPMCOrbitalConstants.jpmcOPaymentModeElectronicCheck = 'jpmcOPaymentModeElectronicCheck';
JPMCOrbitalConstants.jpmcOPaymentModeGooglePay = 'jpmcOPaymentModeGooglePay';
JPMCOrbitalConstants.jpmcOPaymentModeApplePay = 'jpmcOPaymentModeApplePay';
JPMCOrbitalConstants.jpmcOPaymentModeProfile = 'jpmcOPaymentModeProfile';

// Acceptable service codes
JPMCOrbitalConstants.approvedRespCodes = ['00', '0', '8', '11', '24', '26', '27', '28', '29', '31', '32', '34', '91', '92',
    '93', '94', 'E7', 'P1', 'PA'];
JPMCOrbitalConstants.resendableRespCodes = ['19', '98', '99', 'L2'];
JPMCOrbitalConstants.approvedHostRespCodesStratus = ['100', '101', '102', '103', '104', '105', '106', '107', '110', '111',
    '112', '113', '114', '115', '704', '119'];
JPMCOrbitalConstants.resendHostRespCodesStratus = ['301', '0', '902'];
JPMCOrbitalConstants.approvedHostRespCodesTandem = ['00', '000', '100', '102', '8', '11', '101', '103', '10'];
JPMCOrbitalConstants.resendHostRespCodesTandem = ['19', '99'];
JPMCOrbitalConstants.approvedProcStatusCodes = ['0', '1019', '3002', '3007', '4004', '4009', '6004', '7000'];
JPMCOrbitalConstants.resendableProcStatusCodes = ['1', '2', '3', '6', '14', '24', '26', '29', '30', '40', '47', '49', '50',
    '51', '201', '202', '203', '204', '205', '207', '208', '209', '210', '301', '302', '303', '304',
    '310', '311', '312', '313', '314', '315', '343', '345', '410', '411', '920', '921', '1002', '1009',
    '2002', '3004', '3005', '3016', '4006', '7002', '8001', '9736', '9737', '9738', '9759', '9990', '9991', '9992',
    '9993', '9999', '10011', '10138', '10144', '19772', '9710', '9711', '9737'];
module.exports = JPMCOrbitalConstants;
