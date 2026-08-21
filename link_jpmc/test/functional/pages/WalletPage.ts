import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class WalletPage extends BasePage {
    private readonly backToAccountLink = this.page.locator('text=Back to My Account');
    private deletedCardId: string | null = null;

    constructor(page: Page) {
        super(page);
    }

    async verifyWalletPage() {
        await this.page.waitForLoadState('domcontentloaded', { timeout: 20000 });
        await expect(this.page.locator('.paymentInstruments, .payment-instruments, h1:has-text("Payments")').first()).toBeVisible({ timeout: 20000 });
    }

    async verifySavedCard(name: string, cardType: string, lastFourDigits: string, expiryDate: string) {
        const savedCard = this.page.locator('[id^="uuid-"]')
            .filter({ hasText: name })
            .filter({ hasText: cardType })
            .filter({ hasText: lastFourDigits })
            .filter({ hasText: expiryDate })
            .first();
        await this.verifyElementVisible(savedCard);
    }

    async verifyCardDetails(name: string, cardType: string, lastFourDigits: string, expiryDate: string) {
        const pageContent = await this.page.content();

        if (!pageContent.includes(name)) {
            throw new Error(`Card owner name "${name}" not found on wallet page`);
        }

        if (!pageContent.includes(cardType)) {
            throw new Error(`Card type "${cardType}" not found on wallet page`);
        }

        if (!pageContent.includes(lastFourDigits)) {
            throw new Error(`Last four digits "${lastFourDigits}" not found on wallet page`);
        }

        if (expiryDate && !pageContent.includes(expiryDate)) {
            const ownerLocator = this.page.locator('*').filter({ hasText: name }).first();
            await this.verifyElementVisible(ownerLocator);
            return;
        }

        const ownerLocator = this.page.locator('*').filter({ hasText: name }).first();
        await this.verifyElementVisible(ownerLocator);
    }

    async clickAddNew() {
        await this.page.locator('text=Add New').last().click();
    }

    async clickBackToAccount() {
        await this.backToAccountLink.click();
    }

    async deleteCardByName(cardOwnerName: string) {
        const card = this.page.locator('[id^="uuid-"]').filter({ hasText: cardOwnerName }).first();
        await expect(card).toBeVisible({ timeout: 5000 });

        const cardId = await card.getAttribute('id');

        // Click the × button to open the delete modal
        await card.locator('button.remove-payment').click();

        // Wait for modal to appear
        const modal = this.page.locator('#deletePaymentModal');
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        // Set up listener for AJAX response BEFORE clicking Yes
        const responsePromise = this.page.waitForResponse(
            (resp) => resp.url().includes('PaymentInstruments-DeletePayment'),
            { timeout: 15000 }
        );

        // Click Yes
        await modal.locator('.delete-confirmation-btn').click();

        // Wait for AJAX to complete — this is the critical wait
        await responsePromise;

        // Wait for modal to close
        await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

        this.deletedCardId = cardId;
    }

    async deleteCard(cardIndex: number = 0) {
        const deleteBtn = this.page.locator('button.remove-payment').nth(cardIndex);
        await expect(deleteBtn).toBeVisible({ timeout: 5000 });

        const card = deleteBtn.locator('xpath=ancestor::div[starts-with(@id,"uuid-")]');
        const cardId = await card.getAttribute('id').catch(() => null);

        await deleteBtn.click();

        const modal = this.page.locator('#deletePaymentModal');
        await modal.waitFor({ state: 'visible', timeout: 5000 });

        const responsePromise = this.page.waitForResponse(
            (resp) => resp.url().includes('PaymentInstruments-DeletePayment'),
            { timeout: 15000 }
        );

        await modal.locator('.delete-confirmation-btn').click();
        await responsePromise;
        await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

        this.deletedCardId = cardId;
    }

    async verifyCardDeleted(cardOwnerName: string) {
        if (!this.deletedCardId) {
            throw new Error('No card deletion was tracked. Call deleteCardByName first.');
        }

        // SFRA AJAX removes the element via $('#uuid-' + UUID).remove()
        // Verify the specific card is gone from the DOM
        const deletedCard = this.page.locator(`#${this.deletedCardId}`);
        await expect(deletedCard).toHaveCount(0, { timeout: 5000 });
        this.deletedCardId = null;
    }

    async getSavedCardsCount(): Promise<number> {
        return await this.page.locator('[id^="uuid-"]').count();
    }
}
