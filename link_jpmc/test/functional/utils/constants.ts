export const TIMEOUTS = {
    SHORT: 10000,
    MEDIUM: 15000,
    LONG: 30000,
    EXTRA_LONG: 60000,
} as const;

export const WAIT_STATES = {
    LOAD: 'load',
    DOM_CONTENT_LOADED: 'domcontentloaded',
    NETWORK_IDLE: 'networkidle',
} as const;

export const BROWSERS = {
    CHROMIUM: 'chromium',
    FIREFOX: 'firefox',
    WEBKIT: 'webkit',
} as const;

export const CARD_TYPES = {
    VISA: 'Credit Visa',
    MASTERCARD: 'Credit Mastercard',
    AMEX: 'Credit Amex',
    DISCOVER: 'Credit Discover',
} as const;

export const ERROR_MESSAGES = {
    LOGIN_FAILED: 'Login failed. Please check credentials.',
    PAYMENT_FAILED: 'Failed to add payment method.',
    ELEMENT_NOT_FOUND: 'Element not found on the page.',
    TIMEOUT: 'Operation timed out.',
} as const;

export const SUCCESS_MESSAGES = {
    LOGIN_SUCCESS: 'Login successful',
    PAYMENT_ADDED: 'Payment method added successfully',
    CARD_VERIFIED: 'Card details verified successfully',
} as const;

export const PAGE_URLS = {
    LOGIN: '/Login-Show',
    DASHBOARD: '/account',
    ADD_PAYMENT: '/PaymentInstruments-AddPayment',
    WALLET: '/wallet',
} as const;

export const SELECTORS = {
    BUTTON: 'button',
    LINK: 'a',
    INPUT: 'input',
    SELECT: 'select',

    CONSENT_MODAL: '#consent-tracking',
    CONSENT_YES: '#consent-tracking .affirm',
    LOGIN_BUTTON: 'button[type="submit"]',
} as const;
