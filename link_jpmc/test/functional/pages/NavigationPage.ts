import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class NavigationPage extends BasePage {
    private readonly newArrivalsMenu = this.page.locator('button:has-text("New Arrivals"), a:has-text("New Arrivals")').first();

    constructor(page: Page) {
        super(page);
    }

    async hoverNewArrivals() {
        await this.newArrivalsMenu.hover();
    }

    async clickNavItem(label: string) {
        await this.page.locator(`a:has-text("${label}"), button:has-text("${label}")`).first().click();
    }

    async hoverAndSelectCategory(topMenu: string, subCategory: string) {
        const topItem = this.page.locator(`button:has-text("${topMenu}"), a:has-text("${topMenu}")`).first();
        await topItem.hover();
        await this.page.waitForTimeout(this.waits.short);
        const subItem = this.page.getByText(subCategory, { exact: true }).first();
        await subItem.waitFor({ state: 'visible', timeout: this.timeouts.action });
        await subItem.click();
    }

    async searchAndSelectProduct(productName: string) {
        await this.withReloadRetry(async () => {
            const searchInput = this.page.locator('input.search-field').first();
            await searchInput.click();
            await searchInput.fill(productName);
            await this.page.waitForTimeout(this.waits.medium);

            const suggestion = this.page.locator(`.suggestions .item a[aria-label="${productName}"]`).first();
            await suggestion.waitFor({ state: 'visible', timeout: this.timeouts.action });
            await suggestion.click();
            await this.page.waitForLoadState('domcontentloaded');
        }, 3);
    }

    async hoverCartIcon() {
        const minicart = this.page.locator('.minicart').first();
        await minicart.hover();
        await this.page.waitForTimeout(this.waits.medium);
    }

    async clickCheckoutFromMiniCart() {
        await this.withReloadRetry(async () => {
            await this.hoverCartIcon();
            const checkoutBtn = this.page.locator('[class*="checkout-btn"], a:has-text("Checkout")').first();
            await checkoutBtn.waitFor({ state: 'visible', timeout: this.timeouts.action });
            await checkoutBtn.click();
            // Confirm navigation actually reached the checkout page
            await this.page.waitForURL(/Checkout-Begin|Checkout/i, { timeout: this.timeouts.navigation });
        }, 3);
    }

    /**
     * Runs an action that may intermittently fail due to network/timing issues
     * (search suggestions not loading, checkout button not navigating). On
     * failure it reloads the page and retries the same action up to `attempts`.
     */
    private async withReloadRetry(action: () => Promise<void>, attempts: number = 3): Promise<void> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                await action();
                return;
            } catch (error) {
                lastError = error;
                if (attempt < attempts) {
                    await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
                    await this.dismissConsentIfVisible();
                    await this.page.waitForTimeout(this.waits.medium);
                }
            }
        }
        throw lastError;
    }
}
