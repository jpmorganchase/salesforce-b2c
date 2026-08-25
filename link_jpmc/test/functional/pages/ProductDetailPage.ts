import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductDetailPage extends BasePage {
    private readonly addToCartButton = this.page.locator('button.add-to-cart, button:has-text("Add to Cart")').first();

    constructor(page: Page) {
        super(page);
    }

    async verifyPDPLoaded() {
        await this.page.waitForLoadState('domcontentloaded');
        await this.addToCartButton.waitFor({ state: 'visible', timeout: this.timeouts.action });
    }

    async selectSize(size: string) {
        const sizeDropdown = this.page.locator('select[id*="Size"], select[id*="size"]').first();
        if (await sizeDropdown.isVisible().catch(() => false)) {
            // SFRA size <option>s carry the variation URL as their value and the real size in
            // `data-attr-value`; the "Select Size" placeholder has no data-attr-value and must be
            // skipped (selecting it leaves the product unconfigured and Add to Cart disabled).
            const options = await sizeDropdown.locator('option[data-attr-value]').evaluateAll(
                (opts) => (opts as HTMLOptionElement[]).map((o) => ({ size: (o.textContent || '').trim(), value: o.value })),
            );
            // Try the requested size first, then fall back to any other size if it is out of stock.
            const ordered = [
                ...options.filter((o) => o.size === size),
                ...options.filter((o) => o.size !== size),
            ];
            for (const option of ordered) {
                await sizeDropdown.selectOption(option.value);
                // Selecting a size triggers an AJAX variation update; wait for the resulting
                // orderable state before proceeding to Add to Cart.
                try {
                    await expect(this.addToCartButton).toBeEnabled({ timeout: this.timeouts.action });
                    return;
                } catch {
                    // Variant out of stock for this size — try the next available size.
                }
            }
            throw new Error('Unable to select an in-stock size for this product');
        }
        const sizeBtn = this.page.locator(`[data-attr-value="${size}"], button:has-text("${size}"), .size-btn:has-text("${size}")`).first();
        await sizeBtn.click();
    }

    async clickAddToCart() {
        await this.addToCartButton.waitFor({ state: 'visible', timeout: this.timeouts.action });
        await this.addToCartButton.click();
        await this.page.waitForTimeout(this.waits.medium);
    }

    async selectSizeAndAddToCart(size: string) {
        await this.selectSize(size);
        await this.clickAddToCart();
    }
}
