'use strict';

/**
 * Mock for dw/system/Session
 */

// Global session object that the code expects
var session = {
    userName: 'testuser',
    customer: {
        authenticated: false,
        registered: false
    },
    currency: 'USD',
    forms: {},
    privacy: {},
    custom: {}
};

/**
 * Reset session to defaults for testing
 */
function resetSession() {
    session.userName = 'testuser';
    session.customer.authenticated = false;
    session.customer.registered = false;
    session.currency = 'USD';
    session.forms = {};
    session.privacy = {};
    session.custom = {};
}

/**
 * Set session username
 * @param {string} username - Username
 */
function setUserName(username) {
    session.userName = username;
}

module.exports = session;
module.exports.resetSession = resetSession;
module.exports.setUserName = setUserName;
