'use strict';

var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger');

/**
 * OCAPI Hook: dw.ocapi.shop.order.beforePOST
 * 
 * Called before an order is created for the basket (POST /orders).
 * 
 * For EU drop-in flow, extracts the pre-reserved order number from basket.custom.jpmcReservedOrderNo
 * and stores it in session. The dw.order.createOrderNo hook will retrieve it when generating
 * the order number.
 * 
 * @param {dw.order.Basket} basket - The basket based on which the order is created
 * @returns {dw.system.Status} Status.OK to continue with default order creation
 */
exports.beforePOST = function(basket) {
    var logger = Logger.getLogger('JPMC', 'OrderHook');
    
    // Check if basket has reserved order number (EU drop-in flow)
    var reservedOrderNo = basket && basket.custom && basket.custom.jpmcReservedOrderNo;
    
    if (reservedOrderNo) {
        logger.info('beforePOST: Found JPMC reserved order number {0} for basket {1}, storing in session', 
            reservedOrderNo, basket.UUID);
        
        // Store in session for createOrderNoHook to retrieve
        session.privacy.jpmcReservedOrderNo = reservedOrderNo;
    } else {
        logger.debug('beforePOST: No reserved order number found for basket {0}, will use default generation', 
            basket ? basket.UUID : 'null');
    }
    
    // Always return OK to continue with default order creation process
    return new Status(Status.OK);
};
