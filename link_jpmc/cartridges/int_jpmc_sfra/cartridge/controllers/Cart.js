'use strict';

// Extend the base Cart controller
var server = require('server');
server.extend(module.superModule);
var BasketMgr = require('dw/order/BasketMgr');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger').getLogger('JPMC', 'cart');


/**
 * Clear reserved order number from basket
 * Called when basket becomes empty
 * @param {dw.order.Basket} basket - The basket to clear the order number from
 */
function clearReservedOrderNumber(basket) {
    if (basket && basket.custom) {
        try {
            Transaction.wrap(function () {
                basket.custom.jpmcReservedOrderNo = null;
                basket.custom.jpmcLastEtag = null;
                basket.custom.jpmcCheckoutIntentOrderNumber = null;
            });
            Logger.debug('Cleared reserved order number for basket {0}', basket.UUID);
        } catch (e) {
            Logger.warn('Failed to clear reserved order number for basket {0}: {1}',
                basket.UUID, e instanceof Error ? e.message : String(e));
        }
    }
}

/**
 * Override RemoveProductLineItem to clear reserved order number
 * only when basket becomes completely empty
 */
server.append('RemoveProductLineItem', function (req, res, next) {
    var currentBasket = BasketMgr.getCurrentBasket();
    if (currentBasket && currentBasket.productLineItems.empty) {
        clearReservedOrderNumber(currentBasket);
    }
    next();
});
/**
 * Cart-MiniCartShow : Append to add miniCart flag to view data
 * @name Base/Cart-MiniCartShow
 * @function
 * @memberof Cart
 * @param {middleware} - server.middleware.include
 * @param {serverfunction} - append
 */
server.append('MiniCartShow', function (req, res, next) {
    var viewData = res.getViewData();
    viewData.miniCart = true;
    res.setViewData(viewData);
    next();
});

module.exports = server.exports();