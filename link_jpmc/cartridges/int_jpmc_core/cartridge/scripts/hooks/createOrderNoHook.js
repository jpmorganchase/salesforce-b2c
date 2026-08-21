'use strict';

var OrderMgr = require('dw/order/OrderMgr');

/**
 * Hook: dw.order.createOrderNo
 * 
 * Called when generating an order number for a basket.
 * 
 * For EU drop-in flow, checks session for a pre-reserved order number
 * (set by dw.ocapi.shop.order.beforePOST hook from basket.custom.jpmcReservedOrderNo).
 * Returns the reserved number if found, otherwise generates default sequence number.
 * 
 * @returns {string} The order number to use
 */
exports.createOrderNo = function() {
    // Check session for reserved order number (EU drop-in flow)
    var reservedOrderNo = session.privacy.jpmcReservedOrderNo;
    
    if (reservedOrderNo) {
        // Clear the session variable after use
        delete session.privacy.jpmcReservedOrderNo;
        return String(reservedOrderNo);
    }
    
    // Default behavior: generate new sequence number with site prefix
    var orderSeqNo = OrderMgr.createOrderSequenceNo();
    return String(orderSeqNo);
};
