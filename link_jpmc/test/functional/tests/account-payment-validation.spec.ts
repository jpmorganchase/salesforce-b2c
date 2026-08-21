import { test } from '../utils/fixtures';
import { TestData } from '../test-data/testData';
import { logStep } from '../utils/helpers';
import { LoginPage, DashboardPage } from '../pages';

test.describe('Payment Management Tests', () => {
    const { urls, users, paymentCards } = TestData;

    async function loginAndVerifyDashboard(loginPage: LoginPage, dashboardPage: DashboardPage) {
        await loginPage.performLogin(urls.homePage, users.validUser.email, users.validUser.password);
        await dashboardPage.verifyDashboard();
    }

    /**
     * Navigates to the Add New Payment form. If the session was lost and the
     * shopper is bounced to the login page, transparently re-logs in and
     * retries the pending navigation.
     */
    async function goToAddPayment(loginPage: LoginPage, dashboardPage: DashboardPage) {
        await loginPage.withSessionRecovery(async () => {
            if (await loginPage.isOnLoginPage()) {
                await loginPage.reloginIfNeeded();
                await dashboardPage.verifyDashboard();
            }
            await dashboardPage.clickAddNewPayment();
        });
    }

    test('Login and Add Payment Method', async ({ loginPage, dashboardPage, paymentPage, walletPage }) => {
        const card = paymentCards.visaCard;

        logStep('Login and navigate to dashboard');
        await loginAndVerifyDashboard(loginPage, dashboardPage);

        logStep('Navigate to Add New Payment form');
        await goToAddPayment(loginPage, dashboardPage);

        logStep('Verify payment form structure');
        await paymentPage.verifyPaymentPage();
        await paymentPage.verifyAllLabels();

        logStep('Fill and submit payment form');
        await paymentPage.addPayment(
            card.cardOwner,
            card.cardNumber,
            card.expirationMonth,
            card.expirationYear,
            card.cvv
        );

        logStep('Verify card appears on wallet page');
        await walletPage.verifyWalletPage();
        await walletPage.verifyCardDetails(card.cardOwner, card.cardType, card.lastFourDigits, card.expiryDisplay);
    });

    test('Verify Payment Form Labels', async ({ loginPage, dashboardPage, paymentPage }) => {
        logStep('Login and navigate to payment form');
        await loginAndVerifyDashboard(loginPage, dashboardPage);
        await goToAddPayment(loginPage, dashboardPage);

        logStep('Verify all form labels are present');
        await paymentPage.verifyPaymentPage();
        await paymentPage.verifyAllLabels();
    });

    test('Add Multiple Payment Cards', async ({ loginPage, dashboardPage, paymentPage, walletPage }) => {
        const cards = [paymentCards.visaCard, paymentCards.mastercardCard, paymentCards.amexCard];

        logStep('Login');
        await loginAndVerifyDashboard(loginPage, dashboardPage);

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];

            logStep(`Adding ${card.cardType} card`);
            await goToAddPayment(loginPage, dashboardPage);
            await paymentPage.verifyPaymentPage();
            await paymentPage.addPayment(
                card.cardOwner,
                card.cardNumber,
                card.expirationMonth,
                card.expirationYear,
                card.cvv
            );

            logStep(`Verify ${card.cardType} saved`);
            await walletPage.verifyWalletPage();
            await walletPage.verifyCardDetails(card.cardOwner, card.cardType, card.lastFourDigits, card.expiryDisplay);

            if (i < cards.length - 1) {
                await walletPage.clickBackToAccount();
            }
        }
    });

    test('Save Card and Remove It', async ({ loginPage, dashboardPage, paymentPage, walletPage }) => {
        const card = paymentCards.visaCard2;

        logStep('Login');
        await loginAndVerifyDashboard(loginPage, dashboardPage);

        logStep('Add a new payment card');
        await goToAddPayment(loginPage, dashboardPage);
        await paymentPage.verifyPaymentPage();
        await paymentPage.verifyAllLabels();
        await paymentPage.addPayment(
            card.cardOwner,
            card.cardNumber,
            card.expirationMonth,
            card.expirationYear,
            card.cvv
        );

        logStep('Verify card saved');
        await walletPage.verifyWalletPage();
        await walletPage.verifyCardDetails(card.cardOwner, card.cardType, card.lastFourDigits, card.expiryDisplay);

        logStep('Delete the card');
        await walletPage.deleteCardByName(card.cardOwner);

        logStep('Verify card removed');
        await walletPage.verifyCardDeleted(card.cardOwner);
    });
});
