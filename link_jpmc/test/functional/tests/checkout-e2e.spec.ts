import { test } from '../utils/fixtures';
import { TestData } from '../test-data/testData';
import { logStep } from '../utils/helpers';

test.describe('Checkout Flow - Registered User', () => {
    test.describe.configure({ mode: 'serial' });
    const { urls, users, products, checkout } = TestData;
    const user = users.validUser;
    const product = products.modernSportCoat;
    const card = checkout.defaultCard;

    async function browseAndStartCheckout(fixtures: {
        loginPage: import('../pages').LoginPage;
        dashboardPage: import('../pages').DashboardPage;
        navigationPage: import('../pages').NavigationPage;
        productListingPage: import('../pages').ProductListingPage;
        productDetailPage: import('../pages').ProductDetailPage;
        checkoutPage: import('../pages').CheckoutPage;
    }) {
        const {
            loginPage,
            dashboardPage,
            navigationPage,
            productListingPage,
            productDetailPage,
            checkoutPage,
        } = fixtures;

        logStep('Navigate to home page and click login');
        await loginPage.navigateToLogin(urls.homePage);

        logStep('Login with valid credentials');
        await loginPage.login(user.email, user.password);

        logStep('Verify dashboard');
        await dashboardPage.verifyDashboard();

        logStep(`Search and select product: ${product.name}`);
        await navigationPage.searchAndSelectProduct(product.name);
        await productDetailPage.verifyPDPLoaded();

        logStep(`Select size ${product.size} and add to cart`);
        await productDetailPage.selectSizeAndAddToCart(product.size);

        logStep('Proceed to checkout via mini-cart');
        await navigationPage.hoverCartIcon();
        await navigationPage.clickCheckoutFromMiniCart();
        await checkoutPage.verifyUrlContains('checkout', 20000);
    }

    test('Checkout Happy Path - New Credit Card', async ({
        loginPage,
        dashboardPage,
        navigationPage,
        productListingPage,
        productDetailPage,
        checkoutPage,
        orderConfirmationPage,
    }) => {
        await browseAndStartCheckout({
            loginPage,
            dashboardPage,
            navigationPage,
            productListingPage,
            productDetailPage,
            checkoutPage,
        });

        logStep('Click Next: Payment');
        await checkoutPage.clickNextPayment();

        logStep('Click Add Payment to open new-card form');
        await checkoutPage.clickAddPayment();

        logStep('Verify payment form labels');
        await checkoutPage.verifyPaymentFormLabels();

        logStep('Enter card details');
        await checkoutPage.fillCheckoutPaymentForm(card.cardNumber, card.expirationMonth, card.expirationYear, card.cvv);

        logStep('Submit payment and go to review page');
        await checkoutPage.clickNextPlaceOrder();

        logStep('Verify payment summary on review page');
        await checkoutPage.verifyPaymentSummary(card.cardType, card.lastFourDigits, card.expiryDisplay);

        logStep('Place order');
        await checkoutPage.clickPlaceOrder();

        logStep('Verify order confirmation');
        await orderConfirmationPage.verifyOrderConfirmation();
        await orderConfirmationPage.verifyThankYouMessage();
    });

    test('Checkout Happy Path - Saved Payment Method', async ({
        loginPage,
        dashboardPage,
        navigationPage,
        productListingPage,
        productDetailPage,
        checkoutPage,
        orderConfirmationPage,
    }) => {
        await browseAndStartCheckout({
            loginPage,
            dashboardPage,
            navigationPage,
            productListingPage,
            productDetailPage,
            checkoutPage,
        });

        logStep('Click Next: Payment');
        await checkoutPage.clickNextPayment();

        logStep('Verify payment method tabs');
        await checkoutPage.verifyAllPaymentMethodLabels();

        logStep('Enter CVV for saved card');
        await checkoutPage.fillCheckoutSavedPaymentFormWithCVV(card.cvv);

        logStep('Submit payment and go to review page');
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
