import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class OrderConfirmationPage extends BasePage {
    private readonly confirmationMessage = this.page.locator('text=Thank you for your order').first();

    constructor(page: Page) {
        super(page);
    }

    async verifyOrderConfirmation() {
        await this.page.waitForLoadState('domcontentloaded', { timeout: this.timeouts.navigation });
        await this.confirmationMessage.waitFor({ state: 'visible', timeout: this.timeouts.navigation });
        await this.verifyElementVisible(this.confirmationMessage);
    }

    async verifyThankYouMessage() {
        const pageText = await this.page.locator('body').innerText();
        expect(pageText).toContain('Thank you for your order');
    }
}
