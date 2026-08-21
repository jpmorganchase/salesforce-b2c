'use strict';

/**
 * JPMC Constants
 * Centralized constants used across JPMC payment integration
 * @module scripts/helpers/JPMCConstants
 */
var JPMCConstants = {
    // Processor
    JPMC_Processor: 'JPMC_Payment',

    // Transaction States (from JPMC API response)
    TRANSACTION_STATE: {
        AUTHORIZED: 'AUTHORIZED',
        CLOSED: 'CLOSED',
        DECLINED: 'DECLINED'
    },

    // Apple Pay Protocol Versions
    APPLE_PAY_PROTOCOL: {
        EC_V1: 'EC_v1',
        RSA_V1: 'RSA_v1'
    },

    // Drop-in UI
    JPMC_DROP_IN: 'JPMC_DROP_IN',
    AWAITING_TRANSACTION_ID: 'Awaiting Transaction Id',

    // Google Pay
    JPMC_GOOGLE_PAY: 'JPMC_GOOGLE_PAY',
    GOOGLE_PAY_WALLET_PROVIDER: 'GOOGLE_PAY',
    APPLE_PAY_WALLET_PROVIDER: 'APPLE_PAY',

    // Account Number Types
    ACCOUNT_NUMBER_TYPE_PIE: 'SAFETECH_PAGE_ENCRYPTION',

    // Token Management
    TOKEN_CACHE_ID: 'jpmc_access_token_cache',
    TOKEN_CACHE_KEY: 'jpmc_access_token',
    TOKEN_CUSTOM_OBJECT_TYPE: 'JPMCAccessToken',
    CLOCK_SKEW_SECONDS: 30,

    // Keystore Aliases (defaults)
    DEFAULT_CERT_ALIAS: 'jpmc-certificate',
    DEFAULT_KEY_ALIAS: 'jpmc-private-key',

    // Config Defaults
    DEFAULT_COMPANY_NAME: 'JPMC Plugin',
    DEFAULT_PRODUCT_NAME: 'JPMC SFCC SFRA Cartridge',
    DEFAULT_VERSION: '1.0',
    DEFAULT_TOKEN_TYPE: 'SAFETECH_TOKEN',
    DEFAULT_CAPTURE_METHOD: 'MANUAL',
    CAPTURE_METHOD_NOW: 'NOW',

    // Fraud Detection
    FRAUD_REVIEW_NOTE_SUBJECT: 'Fraud Review',
    FRAUD_CART_MAX_LENGTH: 999,

    // Multi-capture
    MULTI_CAPTURE_MAX_RECORD_COUNT: 99,

    // Fallback values for external data
    FALLBACK_IP_ADDRESS: '0.0.0.0',
    FALLBACK_USER_AGENT: 'Unknown',

    // Payment method display names (server-side)
    PAYMENT_METHOD_DISPLAY_UNKNOWN: 'Unknown',
    PAYMENT_METHOD_DISPLAY_GOOGLE_PAY: 'Google Pay',
    PAYMENT_METHOD_DISPLAY_APPLE_PAY: 'Apple Pay',
    PAYMENT_METHOD_DISPLAY_CREDIT_CARD: 'Credit Card',

    // Order note subjects
    NOTE_SUBJECT_GPAY_PAYMENT: 'JPMC Google Pay Payment',
    NOTE_SUBJECT_APPLEPAY_PAYMENT: 'JPMC Apple Pay Payment',

    // Multi-MID
    MERCHANT_CONFIG_CO_TYPE: 'JPMCMerchantConfig',
    TOKEN_CACHE_KEY_PREFIX: 'jpmc_access_token_',
    MERCHANT_CONFIG_CACHE_ID: 'jpmc_merchant_config_cache',
    MERCHANT_CONFIG_CACHE_KEY_PREFIX: 'jpmc_merchant_cfg_',

    // Validation
    VALID_CAPTURE_METHODS: ['MANUAL', 'DELAYED', 'NOW'],
    ALIAS_PATTERN: /^[a-zA-Z0-9_-]{1,100}$/,
    THUMBPRINT_PATTERN: /^[A-F0-9]{40}$/,

    // Account Updater
    ACCOUNT_UPDATER: {
        // Mode (driven by Site Preference jpmcAccountUpdaterMode)
        MODE_NONE: 'NONE',
        MODE_REAL_TIME: 'REAL_TIME',

        // Logger Category
        LOGGER_CATEGORY: 'AccountUpdater',

        // Site preference key for the mode dropdown
        MODE_PREF_KEY: 'jpmcAccountUpdaterMode',

        // RTAU response codes (from /payments authorization response)
        RTAU_RESPONSE_NEW_ACCOUNT: 'NEW_ACCOUNT',
        RTAU_RESPONSE_NEW_EXPIRY: 'NEW_EXPIRY',
        RTAU_RESPONSE_NEW_ACCOUNT_AND_EXPIRY: 'NEW_ACCOUNT_AND_EXPIRY',
        RTAU_RESPONSE_CLOSED_ACCOUNT: 'CLOSED_ACCOUNT',
        RTAU_RESPONSE_CONTACT_CARDHOLDER: 'CONTACT_CARDHOLDER',
        RTAU_RESPONSE_MATCH_NO_UPDATE: 'MATCH_NO_UPDATE'
    },
    // Phone country codes keyed by ISO 3166 Alpha-2.
    // Covers US, CA, and all EU member states.
    PHONE_COUNTRY_CODES: {
        // North America
        US: 1,
        CA: 1,
        // EU member states
        AT: 43,  // Austria
        BE: 32,  // Belgium
        BG: 359, // Bulgaria
        HR: 385, // Croatia
        CY: 357, // Cyprus
        CZ: 420, // Czech Republic
        DK: 45,  // Denmark
        EE: 372, // Estonia
        FI: 358, // Finland
        FR: 33,  // France
        DE: 49,  // Germany
        GR: 30,  // Greece
        HU: 36,  // Hungary
        IE: 353, // Ireland
        IT: 39,  // Italy
        LV: 371, // Latvia
        LT: 370, // Lithuania
        LU: 352, // Luxembourg
        MT: 356, // Malta
        NL: 31,  // Netherlands
        PL: 48,  // Poland
        PT: 351, // Portugal
        RO: 40,  // Romania
        SK: 421, // Slovakia
        SI: 386, // Slovenia
        ES: 34,  // Spain
        SE: 46   // Sweden
    },

    // 3D Secure (3DS)
    THREE_DS: {
        // Response statuses from JPMC postback
        RESPONSE_STATUS: {
            SUCCESS: 'SUCCESS',
            ERROR: 'ERROR',
            DENIED: 'DENIED',
            CANCELLED: 'CANCELLED'
        },
        // Transaction authentication statuses (stored in order)
        TRANSACTION_STATUS: {
            SUCCESS: 'Y',           // Authentication successful
            FAILED: 'N',            // Authentication failed
            ATTEMPTED: 'A',         // Authentication attempted
            UNAVAILABLE: 'U'        // Authentication unavailable/unknown
        },
        // Failure reasons for frontend-initiated failures
        FAILURE_REASON: {
            TIMEOUT: 'TIMEOUT',
            USER_CANCELLED: 'USER_CANCELLED',
            IFRAME_ERROR: 'IFRAME_ERROR'
        },
        // Timeout configuration
        TIMEOUT_MS: 3 * 60 * 1000,      // 3 minutes
        TIMEOUT_MINUTES: 3,
        // PostMessage event type
        POSTMESSAGE_TYPE: 'jpmc3dsComplete',
        // Valid JPMC origins for postMessage validation
        JPMC_ORIGINS: [
            'https://payments.jpmorgan.com',
            'https://api-ms.payments.jpmorgan.com',
            'https://api-ms-test.payments.jpmorgan.com'
        ],
        JPMC_DOMAIN_SUFFIX: '.payments.jpmorgan.com',
        // Card types that support 3DS (whitelist approach)
        // Only Visa, Mastercard, and American Express support 3DS
        // Includes both full names and short codes for validation
        SUPPORTED_CARD_TYPES: ['VISA', 'MASTERCARD', 'AMERICAN_EXPRESS', 'VI', 'MC', 'AX'],
        // authenticationPurpose values
        AUTHENTICATION_PURPOSE: {
            PAYMENT_TRANSACTION: 'PAYMENT_TRANSACTION'
        },
        // threeDomainSecureTransactionType values
        TRANSACTION_TYPE: {
            GOODS_SERVICES: 'GOODS_SERVICES'
        }
    }
};

module.exports = JPMCConstants;