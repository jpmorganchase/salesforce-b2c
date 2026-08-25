import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export type EnvironmentType = 'dev' | 'staging' | 'production';

export interface EnvironmentConfig {
    environment: EnvironmentType;
    baseUrl: string;
    loginUrl: string;
    homeUrl: string;
    testUser: { email: string; password: string };
    invalidUser: { email: string; password: string };
    headless: boolean;
    isCI: boolean;
    timeouts: { default: number; navigation: number; action: number; expect: number };
    waits: { short: number; medium: number; long: number };
}

function getEnvironmentConfig(): EnvironmentConfig {
    const testEnv = (process.env.TEST_ENV || 'dev') as EnvironmentType;
    const validEnvironments: EnvironmentType[] = ['dev', 'staging', 'production'];
    if (!validEnvironments.includes(testEnv)) {
        throw new Error(`Invalid TEST_ENV: ${testEnv}. Must be one of: ${validEnvironments.join(', ')}`);
    }

    const prefix = testEnv.toUpperCase();
    const baseUrl = process.env[`${prefix}_BASE_URL`];
    const loginUrl = process.env[`${prefix}_LOGIN_URL`];
    const homeUrl = process.env[`${prefix}_HOME_URL`];
    const testUserEmail = process.env[`${prefix}_TEST_USER_EMAIL`];
    const testUserPassword = process.env[`${prefix}_TEST_USER_PASSWORD`];

    const required = { [`${prefix}_BASE_URL`]: baseUrl, [`${prefix}_LOGIN_URL`]: loginUrl, [`${prefix}_HOME_URL`]: homeUrl, [`${prefix}_TEST_USER_EMAIL`]: testUserEmail, [`${prefix}_TEST_USER_PASSWORD`]: testUserPassword };
    const missing = Object.entries(required).filter(([_, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
        throw new Error(`Missing required env vars for ${testEnv}:\n${missing.join('\n')}\n\nEnsure your .env file is configured.`);
    }

    return {
        environment: testEnv,
        baseUrl: baseUrl!,
        loginUrl: loginUrl!,
        homeUrl: homeUrl!,
        testUser: { email: testUserEmail!, password: testUserPassword! },
        invalidUser: {
            email: process.env[`${prefix}_INVALID_USER_EMAIL`] || 'invalid@test.com',
            password: process.env[`${prefix}_INVALID_USER_PASSWORD`] || 'WrongPassword123',
        },
        headless: process.env.HEADLESS === 'true',
        isCI: process.env.CI === 'true',
        timeouts: {
            default: parseInt(process.env.DEFAULT_TIMEOUT || '30000', 10),
            navigation: parseInt(process.env.NAVIGATION_TIMEOUT || '60000', 10),
            action: parseInt(process.env.ACTION_TIMEOUT || '15000', 10),
            expect: parseInt(process.env.EXPECT_TIMEOUT || '15000', 10),
        },
        waits: {
            short: parseInt(process.env.WAIT_SHORT || '500', 10),
            medium: parseInt(process.env.WAIT_MEDIUM || '1500', 10),
            long: parseInt(process.env.WAIT_LONG || '3000', 10),
        },
    };
}

export const envConfig = getEnvironmentConfig();

export function logEnvironmentConfig(): void {
    console.log(`[Config] env=${envConfig.environment} baseUrl=${envConfig.baseUrl} headless=${envConfig.headless} CI=${envConfig.isCI}`);
}

export default envConfig;
