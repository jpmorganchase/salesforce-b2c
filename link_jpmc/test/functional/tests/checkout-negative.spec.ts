import { test, expect } from '../utils/fixtures';
import { TestData } from '../test-data/testData';
import { logStep } from '../utils/helpers';

test.describe('Guest Checkout - Negative Path', () => {
    const { urls, users, shippingDetails, paymentCards, products } = TestData;
    const card = paymentCards.invalidCard;
    const product = products.modernSportCoat;

    test('Guest order placement shows error on failed payment', async ({
        page,
        loginPage,
        navigationPage,
        productListingPage,
        productDetailPage,
        checkoutPage,
    }) => {
        logStep('Navigate to store home page');
        await page.goto(urls.homePage, { waitUntil: 'domcontentloaded' });

        logStep('Handle tracking consent');
        await loginPage.handleConsentPopup();

        logStep(`Search and select product: ${product.name}`);
        await navigationPage.searchAndSelectProduct(product.name);

        logStep('Select size 48 and add to cart');
        await productDetailPage.verifyPDPLoaded();
        await productDetailPage.selectSizeAndAddToCart('48');

        logStep('Proceed to checkout via mini-cart');
        await navigationPage.hoverCartIcon();
        await navigationPage.clickCheckoutFromMiniCart();
        await checkoutPage.verifyUrlContains('Checkout-Begin', 20000);

        const guestEmail = users.guestEmail();
        logStep(`Enter guest email: ${guestEmail}`);
        await checkoutPage.enterGuestEmail(guestEmail);
        await checkoutPage.clickContinueAsGuest();
        await checkoutPage.verifyCustomerInfoEmail(guestEmail);

        logStep('Verify shipping labels and fill form');
        await checkoutPage.verifyShippingLabels();
        await checkoutPage.fillShippingForm(shippingDetails);

        logStep('Handle gift options');
        await checkoutPage.verifyGiftCheckboxDisplayed();
        await checkoutPage.clickGiftCheckbox();
        await checkoutPage.enterGiftMessage(shippingDetails.giftMessage);

        logStep('Proceed to payment step');
        await checkoutPage.clickNextPayment();
        await checkoutPage.clickAddPaymentIfVisible();

        logStep('Verify guest payment labels');
        await checkoutPage.verifyGuestPaymentFormLabels();

        logStep('Fill payment form');
        await checkoutPage.fillCheckoutPaymentForm(card.cardNumber, card.expirationMonth, card.expirationYear, card.cvv);

        logStep('Submit payment with invalid card and verify inline error on same page');
        const errorText = await checkoutPage.submitPaymentExpectingError();
        expect(errorText.length).toBeGreaterThan(0);
    });
});
