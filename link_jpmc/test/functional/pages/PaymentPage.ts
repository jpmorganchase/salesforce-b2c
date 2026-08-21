import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class PaymentPage extends BasePage {
    private readonly pageHeading = this.page.locator('text=Add New Payment');
    private readonly cardOwnerInput = this.page.locator('input[name*="cardOwner"]');
    private readonly cardNumberInput = this.page.locator('input[name*="cardNumber"]');
    private readonly expirationMonthSelect = this.page.locator('select[name*="expirationMonth"]');
    private readonly expirationYearSelect = this.page.locator('select[name*="expirationYear"]');
    private readonly securityCodeInput = this.page.locator('input[name*="securityCode"]');
    private readonly saveButton = this.page.locator('//button[normalize-space()="Save"]');
    private readonly cancelLink = this.page.locator('//a[normalize-space()="Cancel"]');

    private readonly labels = {
        addNewPayment: this.page.locator('text=Add New Payment'),
        credit: this.page.locator('text=Credit'),
        nameOnCard: this.page.locator('text=Name on Card'),
        cardNumber: this.page.locator('text=Card Number'),
        expirationMonth: this.page.locator('text=Expiration Month'),
        expirationYear: this.page.locator('text=Expiration Year'),
        securityCode: this.page.locator('text=Security Code'),
        makeDefault: this.page.locator('text=Make default payment'),
    };

    constructor(page: Page) {
        super(page);
    }

    async verifyPaymentPage() {
        await this.verifyUrlContains('PaymentInstruments-AddPayment');
        await this.verifyElementVisible(this.pageHeading);
    }

    async verifyAllLabels() {
        await this.verifyElementVisible(this.labels.addNewPayment);
        await this.verifyElementVisible(this.labels.credit);
        await this.verifyElementVisible(this.labels.nameOnCard);
        await this.verifyElementVisible(this.labels.cardNumber);
        await this.verifyElementVisible(this.labels.expirationMonth);
        await this.verifyElementVisible(this.labels.expirationYear);
        await this.verifyElementVisible(this.labels.securityCode);
        await this.verifyElementVisible(this.labels.makeDefault);
        await this.verifyElementVisible(this.cancelLink);
        await this.verifyElementVisible(this.saveButton);
    }

    async enterCardOwner(name: string) {
        await this.fill(this.cardOwnerInput, name);
    }

    async enterCardNumber(cardNumber: string) {
        await this.fill(this.cardNumberInput, cardNumber);
    }

    async selectExpirationMonth(month: string) {
        await this.selectOption(this.expirationMonthSelect, month);
    }

    async selectExpirationYear(year: string) {
        await this.selectOption(this.expirationYearSelect, year);
    }

    async enterSecurityCode(cvv: string) {
        await this.fill(this.securityCodeInput, cvv);
    }

    async clickSave() {
        await Promise.all([
            // SFRA redirects to the wallet list page, whose clean URL is `/wallet`
            // (controller route PaymentInstruments-List). Match either, and resolve on
            // `commit` so we don't hang on the slow `load` event fired by storefront trackers.
            this.page.waitForURL(/wallet|PaymentInstruments-List/i, {
                timeout: this.timeouts.navigation,
                waitUntil: 'commit',
            }),
            this.saveButton.click(),
        ]);
    }

    async clickCancel() {
        await this.click(this.cancelLink);
    }

    async fillPaymentForm(cardOwner: string, cardNumber: string, month: string, year: string, cvv: string) {
        await this.enterCardOwner(cardOwner);
        await this.enterCardNumber(cardNumber);
        await this.selectExpirationMonth(month);
        await this.selectExpirationYear(year);
        await this.enterSecurityCode(cvv);
    }

    async addPayment(cardOwner: string, cardNumber: string, month: string, year: string, cvv: string) {
        await this.fillPaymentForm(cardOwner, cardNumber, month, year, cvv);
        await this.clickSave();
    }
}
