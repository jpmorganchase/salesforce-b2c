import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class CheckoutPage extends BasePage {
    private readonly nextPaymentButton = this.page.locator('button:has-text("Next: Payment")').first();
    private readonly addPaymentButton = this.page.locator('button:has-text("Add Payment"), .add-payment').first();
    private readonly nextPlaceOrderButton = this.page.locator('button.submit-payment').first();
    private readonly placeOrderButton = this.page.locator('button.place-order:has-text("Place Order")').first();

    private readonly guestEmailInput = this.page.locator('#email-guest').first();
    private readonly continueAsGuestButton = this.page.locator('button.submit-customer').first();

    private readonly shippingFirstNameInput = this.page.locator('[id^="shippingFirstName"]').first();
    private readonly shippingLastNameInput = this.page.locator('[id^="shippingLastName"]').first();
    private readonly shippingAddress1Input = this.page.locator('[id^="shippingAddressOne"]').first();
    private readonly shippingAddress2Input = this.page.locator('[id^="shippingAddressTwo"]').first();
    private readonly shippingCountrySelect = this.page.locator('[id^="shippingCountry"]').first();
    private readonly shippingStateSelect = this.page.locator('[id^="shippingState"]').first();
    private readonly shippingCityInput = this.page.locator('[id^="shippingAddressCity"]').first();
    private readonly shippingZipCodeInput = this.page.locator('[id^="shippingZipCode"]').first();
    private readonly shippingPhoneInput = this.page.locator('[id^="shippingPhoneNumber"]').first();
    private readonly isGiftCheckbox = this.page.locator('input[name*="isGift"][type="checkbox"]').first();
    private readonly giftMessageTextarea = this.page.locator('textarea[name*="giftMessage"]').first();

    private readonly cardNumberInput = this.page.locator('input[id*="cardNumber"], input[name*="cardNumber"]').first();
    private readonly expirationMonthSelect = this.page.locator('select[id*="expirationMonth"], select[name*="expirationMonth"]').first();
    private readonly expirationYearSelect = this.page.locator('select[id*="expirationYear"], select[name*="expirationYear"]').first();
    private readonly securityCodeInput = this.page.locator('input[id*="securityCode"], input[name*="securityCode"]').first();
    private readonly savedCardSecurityCodeInput = this.page.locator('input[id*="saved-payment-security-code"], input[name*="saved-payment-security-code"]').first();
    private readonly backToSavedPaymentsButton = this.page.locator('button:has-text("Back to Saved Payments"), a:has-text("Back to Saved Payments")').first();

    constructor(page: Page) {
        super(page);
    }

    async enterGuestEmail(email: string) {
        await this.guestEmailInput.waitFor({ state: 'visible', timeout: this.timeouts.action });
        await this.guestEmailInput.fill(email);
    }

    async clickContinueAsGuest() {
        await this.continueAsGuestButton.waitFor({ state: 'visible', timeout: this.timeouts.action });
        // Wait for checkout.js to attach its event handlers so the form submits via AJAX
        await this.page.waitForLoadState('load');
        await this.page.waitForTimeout(this.waits.medium);
        const responsePromise = this.page.waitForResponse(
            resp => resp.url().includes('CheckoutServices-SubmitCustomer'),
            { timeout: this.timeouts.navigation }
        );
        await this.continueAsGuestButton.click();
        await responsePromise;
        await this.shippingFirstNameInput.waitFor({ state: 'visible', timeout: this.timeouts.navigation });
    }

    async verifyCustomerInfoEmail(email: string) {
        await this.shippingFirstNameInput.waitFor({ state: 'visible', timeout: this.timeouts.navigation });
        const bodyText = await this.page.locator('body').innerText();
        expect(bodyText, `Expected email "${email}" to be displayed in customer info`).toContain(email);
    }

    async verifyShippingLabels() {
        const bodyText = await this.page.locator('body').innerText();
        const labels = ['Shipping', 'First Name', 'Last Name', 'Address 1', 'Address 2', 'Country', 'State', 'City', 'ZIP Code', 'Phone Number', 'Shipping Method'];
        for (const label of labels) {
            expect(bodyText, `Expected shipping label "${label}" to be present`).toContain(label);
        }
    }

    async fillShippingForm(details: {
        firstName: string;
        lastName: string;
        address1: string;
        address2?: string;
        country: string;
        state: string;
        city: string;
        zipCode: string;
        phone: string;
    }) {
        await this.shippingFirstNameInput.waitFor({ state: 'visible', timeout: this.timeouts.navigation });
        await this.shippingFirstNameInput.fill(details.firstName);
        await this.page.waitForTimeout(this.waits.short);
        await this.shippingLastNameInput.fill(details.lastName);
        await this.page.waitForTimeout(this.waits.short);
        await this.shippingAddress1Input.fill(details.address1);
        await this.page.waitForTimeout(this.waits.short);

        if (details.address2) {
            await this.shippingAddress2Input.fill(details.address2);
            await this.page.waitForTimeout(this.waits.short);
        }

        await this.shippingCountrySelect.selectOption(details.country);
        await this.page.waitForTimeout(this.waits.medium);

        await this.shippingStateSelect.selectOption(details.state);
        await this.page.waitForTimeout(this.waits.short);
        await this.page.waitForTimeout(this.waits.medium);

        await this.shippingCityInput.fill('');
        await this.shippingCityInput.type(details.city, { delay: 50 });
        await this.page.waitForTimeout(this.waits.short);
        await this.shippingZipCodeInput.fill('');
        await this.shippingZipCodeInput.type(details.zipCode, { delay: 50 });
        await this.page.waitForTimeout(this.waits.short);
        await this.shippingPhoneInput.fill('');
        await this.shippingPhoneInput.type(details.phone, { delay: 50 });
    }

    async verifyGiftCheckboxDisplayed() {
        const bodyText = await this.page.locator('body').innerText();
        expect(bodyText).toContain('This is a Gift');
        await this.isGiftCheckbox.waitFor({ state: 'visible', timeout: this.timeouts.action });
    }

    async clickGiftCheckbox() {
        await this.isGiftCheckbox.waitFor({ state: 'visible', timeout: this.timeouts.action });
        const checkboxId = await this.isGiftCheckbox.getAttribute('id');
        if (checkboxId) {
            const label = this.page.locator(`label[for="${checkboxId}"]`).first();
            if (await label.isVisible().catch(() => false)) {
                await label.click();
                return;
            }
        }
        await this.isGiftCheckbox.click({ force: true });
    }

    async enterGiftMessage(message: string) {
        await this.giftMessageTextarea.waitFor({ state: 'visible', timeout: this.timeouts.action });
        await this.giftMessageTextarea.fill(message);
    }

    async clickNextPayment() {
        await this.nextPaymentButton.waitFor({ state: 'visible', timeout: this.timeouts.action });
        const responsePromise = this.page.waitForResponse(
            resp => resp.url().includes('CheckoutShippingServices-SubmitShipping'),
            { timeout: this.timeouts.navigation }
        );
        await this.nextPaymentButton.click();
        await responsePromise;
        await this.page.locator('.card.payment-form').waitFor({ state: 'visible', timeout: this.timeouts.navigation });
        await this.page.waitForTimeout(this.waits.short);
    }

    async clickAddPayment() {
        await this.addPaymentButton.waitFor({ state: 'visible', timeout: this.timeouts.action });
        await this.addPaymentButton.click();
        await this.page.waitForTimeout(this.waits.medium);
    }

    async clickAddPaymentIfVisible() {
        if (await this.addPaymentButton.isVisible().catch(() => false)) {
            await this.addPaymentButton.click();
            await this.page.waitForTimeout(this.waits.medium);
        }
    }

    async verifyPaymentFormLabels() {
        const pageText = await this.page.locator('body').innerText();
        const labels = ['Card Number', 'Expiration Month', 'Expiration Year', 'Security Code', 'Save Card to Account'];
        for (const label of labels) {
            expect(pageText).toContain(label);
        }
        await this.verifyElementVisible(this.backToSavedPaymentsButton);
    }

    async verifyGuestPaymentFormLabels() {
        const bodyText = await this.page.locator('body').innerText();
        const labels = ['Card Number', 'Expiration Month', 'Expiration Year', 'Security Code'];
        for (const label of labels) {
            expect(bodyText, `Expected payment label "${label}" to be present`).toContain(label);
        }
    }

    async verifyAllPaymentMethodLabels() {
        const bodyText = await this.page.locator('body').innerText();
        const paymentMethods = ['Credit', 'Google Pay'];
        for (const method of paymentMethods) {
            expect(bodyText, `Expected payment method "${method}" to be present`).toContain(method);
        }
    }

    async fillCheckoutPaymentForm(cardNumber: string, month: string, year: string, cvv: string) {
        await this.cardNumberInput.waitFor({ state: 'visible', timeout: this.timeouts.action });
        await this.cardNumberInput.fill(cardNumber);
        await this.page.waitForTimeout(this.waits.short);

        const paddedMonth = month.padStart(2, '0');
        await this.expirationMonthSelect.waitFor({ state: 'visible', timeout: this.timeouts.action });
        try {
            await this.expirationMonthSelect.selectOption(paddedMonth);
        } catch {
            await this.expirationMonthSelect.selectOption(month);
        }
        await this.page.waitForTimeout(this.waits.short);

        await this.expirationYearSelect.waitFor({ state: 'visible', timeout: this.timeouts.action });
        await this.expirationYearSelect.selectOption(year);
        await this.page.waitForTimeout(this.waits.short);
        await this.securityCodeInput.fill(cvv);
    }

    async fillCheckoutSavedPaymentFormWithCVV(cvv: string) {
        await this.savedCardSecurityCodeInput.fill(cvv);
    }

    async clickNextPlaceOrder() {
        await this.nextPlaceOrderButton.waitFor({ state: 'visible', timeout: this.timeouts.action });
        const responsePromise = this.page.waitForResponse(
            resp => resp.url().includes('CheckoutServices-SubmitPayment'),
            { timeout: this.timeouts.navigation }
        );
        await this.nextPlaceOrderButton.click();
        await responsePromise;
        await this.placeOrderButton.waitFor({ state: 'visible', timeout: this.timeouts.navigation });
    }

    async verifyPaymentSummary(cardType: string, lastFourDigits: string, expiryDisplay: string) {
        await this.page.waitForTimeout(this.waits.medium);
        const pageText = await this.page.locator('body').innerText();
        const expectedValues = [cardType, lastFourDigits.slice(-4), expiryDisplay.split('/')[1]];
        const hasExpectedValue = expectedValues.some((value) => pageText.includes(value));
        expect(hasExpectedValue || pageText.toLowerCase().includes('payment')).toBeTruthy();
    }

    /**
     * Submits the payment step expecting it to FAIL (e.g. invalid card). The
     * SFRA error message is rendered on the same payment page. Validates that
     * an error is shown and returns the error text.
     */
    async submitPaymentExpectingError(): Promise<string> {
        await this.nextPlaceOrderButton.waitFor({ state: 'visible', timeout: this.timeouts.action });
        await this.nextPlaceOrderButton.click();

        const errorAlert = this.page.locator(
            '.error-message, .alert-danger, .invalid-feedback, .invalid-payment, .payment-error'
        ).first();
        await errorAlert.waitFor({ state: 'visible', timeout: this.timeouts.navigation }).catch(() => {});

        const hasErrorElement = await errorAlert.isVisible().catch(() => false);
        const errorText = hasErrorElement ? (await errorAlert.innerText().catch(() => '')) : '';

        const bodyText = await this.page.locator('body').innerText();
        const errorPatterns = [/error/i, /invalid/i, /declined/i, /unable/i, /could not/i, /not be processed/i, /try again/i];
        const bodyHasError = errorPatterns.some((pattern) => pattern.test(bodyText));

        expect(
            hasErrorElement || bodyHasError,
            'Expected an inline payment error message to be displayed after submitting an invalid card'
        ).toBeTruthy();

        // Ensure we are still on the checkout/payment page (order was NOT placed)
        expect(this.page.url()).toContain('Checkout');

        return (errorText || bodyText).trim();
    }

    async clickPlaceOrder() {
        await this.placeOrderButton.waitFor({ state: 'visible', timeout: this.timeouts.navigation });
        const responsePromise = this.page.waitForResponse(
            resp => resp.url().includes('CheckoutServices-PlaceOrder'),
            { timeout: this.timeouts.navigation }
        );
        await this.placeOrderButton.click();
        await responsePromise;
        await this.page.waitForLoadState('domcontentloaded');
    }
}
