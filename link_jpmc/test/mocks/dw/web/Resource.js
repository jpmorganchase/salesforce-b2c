'use strict';

/**
 * Mock for dw/web/Resource
 */

var messages = {
    'error.technical': 'Technical Error',
    'error.payment.processor': 'Payment Processor Error',
    'error.payment.processor.missing': 'Payment Processor Missing',
    'error.payment.instrument.not.found': 'Payment Instrument Not Found',
    'error.payment.authorization': 'Payment Authorization Error',
    'error.payment.declined': 'Payment Declined',
    'error.invalid.googlepay.token': 'Invalid Google Pay Token',
    'error.order.notfound': 'Order Not Found',
    'error.payment.order.not.found': 'Order not found.',
    'error.payment.not.valid': 'The selected payment method is not valid for this order.',
    'error.fraud.declined': 'Your payment could not be processed due to security reasons. Please contact customer service.'
};

var Resource = {
    /**
     * Get a localized message
     * @param {string} key - Message key
     * @param {string} bundle - Resource bundle name
     * @param {*} defaultValue - Default value if key not found
     * @returns {string} Localized message
     */
    msg: function (key, bundle, defaultValue) {
        // Return from our mock messages if exists
        if (messages[key]) {
            return messages[key];
        }
        
        // Return default value if provided
        if (defaultValue !== undefined && defaultValue !== null) {
            return defaultValue;
        }
        
        // Return the key itself as fallback
        return key;
    },

    /**
     * Get a localized message with parameters
     * @param {string} key - Message key
     * @param {string} bundle - Resource bundle name
     * @param {*} defaultValue - Default value if key not found
     * @param {...*} params - Parameters to substitute
     * @returns {string} Localized message with parameters substituted
     */
    msgf: function (key, bundle, defaultValue) {
        var message = this.msg(key, bundle, defaultValue);
        
        // Simple parameter substitution for {0}, {1}, etc.
        var params = Array.prototype.slice.call(arguments, 3);
        params.forEach(function (param, index) {
            message = message.replace('{' + index + '}', param);
        });
        
        return message;
    },

    /**
     * Helper to set custom messages for testing
     * @param {string} key - Message key
     * @param {string} value - Message value
     */
    _setMessage: function (key, value) {
        messages[key] = value;
    },

    /**
     * Helper to get all messages (for debugging)
     * @returns {Object} All messages
     */
    _getMessages: function () {
        return Object.assign({}, messages);
    },

    /**
     * Reset mock state
     */
    reset: function () {
        messages = {
            'error.technical': 'Technical Error',
            'error.payment.processor': 'Payment Processor Error',
            'error.payment.processor.missing': 'Payment Processor Missing',
            'error.payment.instrument.not.found': 'Payment Instrument Not Found',
            'error.payment.authorization': 'Payment Authorization Error',
            'error.payment.declined': 'Payment Declined',
            'error.invalid.googlepay.token': 'Invalid Google Pay Token',
            'error.order.notfound': 'Order Not Found',
            'error.payment.order.not.found': 'Order not found.',
            'error.payment.not.valid': 'The selected payment method is not valid for this order.',
            'error.fraud.declined': 'Your payment could not be processed due to security reasons. Please contact customer service.'
        };
    },

    /**
     * Reset mock state (alias)
     */
    resetMock: function () {
        this.reset();
    }
};

module.exports = Resource;
