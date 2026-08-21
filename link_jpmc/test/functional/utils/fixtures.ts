import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { PaymentPage } from '../pages/PaymentPage';
import { WalletPage } from '../pages/WalletPage';
import { NavigationPage } from '../pages/NavigationPage';
import { ProductListingPage } from '../pages/ProductListingPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { OrderConfirmationPage } from '../pages/OrderConfirmationPage';

type PageFixtures = {
    loginPage: LoginPage;
    dashboardPage: DashboardPage;
    paymentPage: PaymentPage;
    walletPage: WalletPage;
    navigationPage: NavigationPage;
    productListingPage: ProductListingPage;
    productDetailPage: ProductDetailPage;
    checkoutPage: CheckoutPage;
    orderConfirmationPage: OrderConfirmationPage;
};

export const test = base.extend<PageFixtures>({
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },
    dashboardPage: async ({ page }, use) => {
        await use(new DashboardPage(page));
    },
    paymentPage: async ({ page }, use) => {
        await use(new PaymentPage(page));
    },
    walletPage: async ({ page }, use) => {
        await use(new WalletPage(page));
    },
    navigationPage: async ({ page }, use) => {
        await use(new NavigationPage(page));
    },
    productListingPage: async ({ page }, use) => {
        await use(new ProductListingPage(page));
    },
    productDetailPage: async ({ page }, use) => {
        await use(new ProductDetailPage(page));
    },
    checkoutPage: async ({ page }, use) => {
        await use(new CheckoutPage(page));
    },
    orderConfirmationPage: async ({ page }, use) => {
        await use(new OrderConfirmationPage(page));
    },
});

export { expect } from '@playwright/test';
