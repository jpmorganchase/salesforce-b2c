'use strict';

/**
 * Mock for dw/order/OrderMgr
 */

var orders = {};

var OrderMgr = {
    /**
     * Get an order by order number
     * @param {string} orderNo - Order number
     * @param {string} [orderToken] - Order token for secure access
     * @returns {Object|null} Order object or null
     */
    getOrder: function (orderNo, orderToken) {
        var order = orders[orderNo] || null;
        if (order && orderToken && order.orderToken !== orderToken) {
            return null;
        }
        return order;
    },

    /**
     * Fail an order
     * @param {Object} order - Order to fail
     * @param {boolean} undoPaymentAuthorization - Whether to undo payment authorization
     * @returns {Object} Status object
     */
    failOrder: function (order, undoPaymentAuthorization) {
        if (!order) {
            return { error: true, message: 'Order is required' };
        }
        
        // Mock behavior - mark order as failed
        order.custom = order.custom || {};
        order.custom.failed = true;
        order.custom.undoPaymentAuthorization = undoPaymentAuthorization;
        
        return { error: false };
    },

    /**
     * Helper method to register an order for testing
     * @param {string} orderNo - Order number
     * @param {Object} order - Order object
     */
    _registerOrder: function (orderNo, order) {
        orders[orderNo] = order;
    },

    /**
     * Reset mock state
     */
    reset: function () {
        orders = {};
    },

    /**
     * Reset mock state (alias)
     */
    resetMock: function () {
        this.reset();
    }
};

module.exports = OrderMgr;
