import { test, expect } from '../utils/fixtures';
import { TestData } from '../test-data/testData';
import { logStep, takeScreenshot } from '../utils/helpers';
import { envConfig } from '../config/environment';

test.describe('Login Tests', () => {
    const { urls, users } = TestData;

    test('Successful login with valid credentials', async ({ page, loginPage, dashboardPage }) => {
        logStep('Navigate to home page and click login');
        await loginPage.navigateToLogin(urls.homePage);
        await takeScreenshot(page, 'login-page');

        logStep('Enter credentials and login');
        await loginPage.login(users.validUser.email, users.validUser.password);

        logStep('Verify dashboard is displayed');
        await dashboardPage.verifyDashboard();
        await takeScreenshot(page, 'dashboard-after-login');
    });

    test('Login with invalid credentials should fail', async ({ page, loginPage }) => {
        logStep('Navigate to home page and click login');
        await loginPage.navigateToLogin(urls.homePage);

        logStep('Enter invalid credentials');
        await loginPage.login(users.invalidUser.email, users.invalidUser.password);

        logStep('Verify user remains on the login page');
        await page.waitForTimeout(envConfig.waits.medium);
        await takeScreenshot(page, 'login-failed');

        logStep('Verify login error message is displayed');
        await loginPage.verifyLoginError();

        const currentUrl = page.url();
        expect(currentUrl).toContain('Login');
    });

    test('Verify tracking consent popup handling', async ({ loginPage }) => {
        logStep('Navigate to home page and click login');
        await loginPage.navigateToLogin(urls.homePage);

        logStep('Verify login form is accessible after consent');
        await loginPage.enterEmail('test@example.com');
    });
});
