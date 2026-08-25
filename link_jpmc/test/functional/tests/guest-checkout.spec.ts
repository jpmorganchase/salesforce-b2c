import { test, expect } from '../utils/fixtures';
import { TestData } from '../test-data/testData';
import { logStep } from '../utils/helpers';

test.describe('Guest User Checkout', () => {
    const { urls, users, shippingDetails, paymentCards, products } = TestData;
    const card = paymentCards.visaCard;
    const product = products.modernSportCoat;

    test('Guest Checkout - Full Happy Path', async ({
        page,
        loginPage,
        navigationPage,
        productListingPage,
        productDetailPage,
        checkoutPage,
        orderConfirmationPage,
    }) => {
        logStep('Navigate to store home page');
        await page.goto(urls.homePage, { waitUntil: 'domcontentloaded' });

        logStep('Handle tracking consent popup');
        await loginPage.handleConsentPopup();

        logStep(`Search and select product: ${product.name}`);
        await navigationPage.searchAndSelectProduct(product.name);

        logStep(`Select size ${product.size} and add to cart`);
        await productDetailPage.verifyPDPLoaded();
        await productDetailPage.selectSizeAndAddToCart(product.size);

        logStep('Proceed to checkout via mini-cart');
        await navigationPage.hoverCartIcon();
        await navigationPage.clickCheckoutFromMiniCart();
        await checkoutPage.verifyUrlContains('Checkout-Begin', 20000);

        const guestEmail = users.guestEmail();
        logStep(`Enter guest email: ${guestEmail}`);
        await checkoutPage.enterGuestEmail(guestEmail);
        await checkoutPage.clickContinueAsGuest();

        logStep('Verify customer info displays email');
        await checkoutPage.verifyCustomerInfoEmail(guestEmail);

        logStep('Verify shipping form labels');
        await checkoutPage.verifyShippingLabels();

        logStep('Fill shipping form');
        await checkoutPage.fillShippingForm(shippingDetails);

        logStep('Verify and fill gift options');
        await checkoutPage.verifyGiftCheckboxDisplayed();
        await checkoutPage.clickGiftCheckbox();
        await checkoutPage.enterGiftMessage(shippingDetails.giftMessage);

        logStep('Click Next: Payment');
        await checkoutPage.clickNextPayment();

        logStep('Open payment form if not already visible');
        await checkoutPage.clickAddPaymentIfVisible();

        logStep('Verify guest payment form labels');
        await checkoutPage.verifyGuestPaymentFormLabels();

        logStep('Verify Back to Saved Payments is absent for guest');
        const backBtn = page.locator('button:has-text("Back to Saved Payments"), a:has-text("Back to Saved Payments")');
        const hasBackBtn = await backBtn.isVisible().catch(() => false);
        expect(hasBackBtn).toBe(false);

        logStep('Enter card details');
        await checkoutPage.fillCheckoutPaymentForm(card.cardNumber, card.expirationMonth, card.expirationYear, card.cvv);

        logStep('Click Next: Place Order');
        await checkoutPage.clickNextPlaceOrder();

        logStep('Verify payment summary on review page');
        await checkoutPage.verifyPaymentSummary(card.cardType, card.lastFourDigits, card.expiryDisplay);

        logStep('Place order');
        await checkoutPage.clickPlaceOrder();

        logStep('Verify order confirmation');
        await orderConfirmationPage.verifyOrderConfirmation();
        await orderConfirmationPage.verifyThankYouMessage();
    });
});
