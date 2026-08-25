import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductListingPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async verifyPLPLoaded() {
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForSelector('.product-grid, .search-results, [class*="product-grid"]', { timeout: this.timeouts.action });
    }

    async clickProduct(productName: string) {
        await this.dismissConsentIfVisible();
        const product = this.page.locator(`.product-tile a:has-text("${productName}"), a:has-text("${productName}")`).first();
        await product.waitFor({ state: 'visible', timeout: this.timeouts.action });
        await product.click();
    }

    async verifyCategoryPage(categoryName: string) {
        await this.verifyElementVisible(
            this.page.locator(`h1:has-text("${categoryName}"), .page-header:has-text("${categoryName}")`).first()
        );
    }
}
