import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
    private readonly consentModal = this.page.locator('#consent-tracking');
    private readonly consentYesButton = this.page.locator('#consent-tracking .affirm');
    private readonly emailInput = this.page.locator('#login-form-email');
    private readonly passwordInput = this.page.locator('#login-form-password');
    private readonly loginButton = this.page.locator('button:has-text("Login")').first();
    private readonly headerLoginLink = this.page.locator('a[aria-label="Login to your account"]').first();
    private readonly loginError = this.page.locator('.login-form-nav .alert-danger, form[name="login-form"] .alert-danger, .alert-danger').first();

    private credentials?: { homeUrl: string; email: string; password: string };

    constructor(page: Page) {
        super(page);
    }

    async navigateToLogin(homeUrl: string) {
        await this.goto(homeUrl);
        await this.handleConsentPopup();
        await this.click(this.headerLoginLink);
        await this.page.waitForLoadState('domcontentloaded');
        await this.emailInput.waitFor({ state: 'visible', timeout: this.timeouts.navigation });
    }

    async handleConsentPopup() {
        if (await this.isVisible(this.consentModal)) {
            await this.click(this.consentYesButton);
            await this.page.waitForTimeout(this.waits.short);
        }
        await this.page.locator('.modal-backdrop').evaluate(el => el.remove(), { timeout: 2000 }).catch(() => {});
    }

    async enterEmail(email: string) {
        await this.fill(this.emailInput, email);
    }

    async enterPassword(password: string) {
        await this.fill(this.passwordInput, password);
    }

    async clickLogin() {
        await this.click(this.loginButton);
    }

    async login(email: string, password: string) {
        await this.enterEmail(email);
        await this.enterPassword(password);
        await this.clickLogin();
        // Wait for either a successful redirect to the account area OR the
        // inline login error to appear (invalid credentials stay on Login page).
        await Promise.race([
            this.page.waitForURL(/Account-Show|account/i, { timeout: this.timeouts.navigation }).catch(() => {}),
            this.loginError.waitFor({ state: 'visible', timeout: this.timeouts.navigation }).catch(() => {})
        ]);
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    /**
     * Asserts that the inline "invalid login or password" error is displayed
     * and the shopper is still on the login page.
     */
    async verifyLoginError(): Promise<void> {
        await this.verifyElementVisible(this.loginError);
    }

    async isLoginErrorVisible(): Promise<boolean> {
        return await this.loginError.isVisible().catch(() => false);
    }

    async performLogin(homeUrl: string, email: string, password: string) {
        this.credentials = { homeUrl, email, password };
        await this.navigateToLogin(homeUrl);
        await this.login(email, password);
    }

    /**
     * Returns true if the browser is currently sitting on the SFRA login page
     * (e.g. after being redirected from a protected/sensitive route).
     */
    async isOnLoginPage(): Promise<boolean> {
        return /Login-Show/i.test(this.page.url()) || await this.emailInput.isVisible().catch(() => false);
    }

    /**
     * Fallback: if the session was lost and we landed back on the login page,
     * re-login using the previously supplied credentials.
     * Returns true if a re-login was performed.
     */
    async reloginIfNeeded(): Promise<boolean> {
        if (!await this.isOnLoginPage()) {
            return false;
        }
        if (!this.credentials) {
            throw new Error('Session lost on login page but no stored credentials to re-login with. Call performLogin() first.');
        }
        await this.handleConsentPopup();
        if (!await this.emailInput.isVisible().catch(() => false)) {
            await this.navigateToLogin(this.credentials.homeUrl);
        }
        await this.login(this.credentials.email, this.credentials.password);
        return true;
    }

    /**
     * Runs a protected action and, if it bounces the user to the login page,
     * re-logs in and retries the action once.
     */
    async withSessionRecovery<T>(action: () => Promise<T>): Promise<T> {
        try {
            const result = await action();
            if (await this.isOnLoginPage()) {
                await this.reloginIfNeeded();
                return await action();
            }
            return result;
        } catch (error) {
            if (await this.reloginIfNeeded()) {
                return await action();
            }
            throw error;
        }
    }
}
