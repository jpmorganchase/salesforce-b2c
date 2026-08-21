import { Page, Locator, expect } from '@playwright/test';
import { envConfig } from '../config/environment';

export class BasePage {
    protected page: Page;

    protected readonly timeouts = {
        action: envConfig.timeouts.action,
        navigation: envConfig.timeouts.navigation,
    };

    protected readonly waits = {
        short: envConfig.waits.short,
        medium: envConfig.waits.medium,
        long: envConfig.waits.long,
    };

    constructor(page: Page) {
        this.page = page;
    }

    async dismissConsentIfVisible() {
        const modal = this.page.locator('#consent-tracking');
        const isVisible = await modal.isVisible().catch(() => false);
        if (isVisible) {
            const yesBtn = this.page.locator('#consent-tracking .affirm').first();
            await yesBtn.click();
            await this.page.waitForTimeout(this.waits.short);
        }
        await this.page.locator('.modal-backdrop').evaluate(el => el.remove(), { timeout: 2000 }).catch(() => {});
    }

    async goto(url: string) {
        await this.page.goto(url);
    }

    async waitForPageLoad() {
        await this.page.waitForLoadState('domcontentloaded');
    }

    async click(locator: Locator) {
        await locator.click();
    }

    async fill(locator: Locator, text: string) {
        await locator.fill(text);
    }

    async selectOption(locator: Locator, value: string) {
        await locator.selectOption(value);
    }

    async isVisible(locator: Locator): Promise<boolean> {
        return await locator.isVisible();
    }

    async waitForElement(locator: Locator) {
        await locator.waitFor({ state: 'visible' });
    }

    async getText(locator: Locator): Promise<string> {
        return (await locator.textContent()) || '';
    }

    async verifyElementVisible(locator: Locator) {
        await expect(locator).toBeVisible();
    }

    async verifyUrlContains(urlFragment: string, timeout: number = 50000) {
        await expect(this.page).toHaveURL(new RegExp(urlFragment, 'i'), { timeout });
    }

    async waitForNavigation(timeout: number = this.timeouts.navigation) {
        await this.page.waitForLoadState('domcontentloaded', { timeout });
    }
}
