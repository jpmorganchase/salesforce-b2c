import { envConfig } from '../config/environment';
import { generateRandomEmail } from '../utils/helpers';

export interface TestCard {
    cardOwner: string;
    cardNumber: string;
    expirationMonth: string;
    expirationYear: string;
    cvv: string;
    displayMonth: string;
    displayYear: string;
    lastFourDigits: string;
    cardType: string;
    expiryDisplay: string;
}

const visaCard: TestCard = {
    cardOwner: 'User Alpha',
    cardNumber: '4111111111111111',
    expirationMonth: '3',
    expirationYear: '2031',
    cvv: '737',
    displayMonth: '03',
    displayYear: '2031',
    lastFourDigits: '************1111',
    cardType: 'Credit Visa',
    expiryDisplay: '3/2031',
};

const visaCardForDeletion: TestCard = {
    cardOwner: 'User Delta',
    cardNumber: '4111111111111111',
    expirationMonth: '3',
    expirationYear: '2031',
    cvv: '733',
    displayMonth: '03',
    displayYear: '2031',
    lastFourDigits: '************1111',
    cardType: 'Credit Visa',
    expiryDisplay: '3/2031',
};

const mastercardCard: TestCard = {
    cardOwner: 'User Beta',
    cardNumber: '5555555555554444',
    expirationMonth: '12',
    expirationYear: '2030',
    cvv: '123',
    displayMonth: '12',
    displayYear: '2030',
    lastFourDigits: '************4444',
    cardType: 'Credit Master Card',
    expiryDisplay: '12/2030',
};

const amexCard: TestCard = {
    cardOwner: 'User Gamma',
    cardNumber: '378282246310005',
    expirationMonth: '6',
    expirationYear: '2029',
    cvv: '1234',
    displayMonth: '06',
    displayYear: '2029',
    lastFourDigits: '***********0005',
    cardType: 'Credit Amex',
    expiryDisplay: '6/2029',
};

const invalidCard: TestCard = {
    cardOwner: 'User Invalid',
    cardNumber: '4444441111111110',
    expirationMonth: '3',
    expirationYear: '2031',
    cvv: '737',
    displayMonth: '03',
    displayYear: '2031',
    lastFourDigits: '************1110',
    cardType: 'Credit Visa',
    expiryDisplay: '3/2031',
};

export const TestData = {
    urls: {
        loginPage: envConfig.loginUrl,
        baseUrl: envConfig.baseUrl,
        homePage: envConfig.homeUrl,
    },
    users: {
        validUser: {
            email: envConfig.testUser.email,
            password: envConfig.testUser.password,
        },
        invalidUser: {
            email: envConfig.invalidUser.email,
            password: envConfig.invalidUser.password,
        },
        guestEmail: (): string => generateRandomEmail(),
    },
    shippingDetails: {
        firstName: 'Avery',
        lastName: 'Taylor',
        address1: '123 Main Street',
        address2: '',
        country: 'US',
        state: 'NY',
        city: 'New York',
        zipCode: '10001',
        phone: '9234567890',
        giftMessage: 'Functional test gift message',
    },
    paymentCards: {
        visaCard,
        visaCard2: visaCardForDeletion,
        mastercardCard,
        amexCard,
        invalidCard,
    },
    checkout: {
        defaultCard: visaCard,
    },
    products: {
        modernSportCoat: {
            name: 'Modern Sport Coat',
            size: '40',
            category: 'Mens',
        },
    },
} as const;
