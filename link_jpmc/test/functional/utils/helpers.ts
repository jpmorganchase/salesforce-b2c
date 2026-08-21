import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export async function takeScreenshot(page: Page, screenshotName: string) {
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(screenshotsDir, `${screenshotName}_${timestamp}.png`);
    const screenshotTimeout = 60000;

    try {
        await page.screenshot({
            path: filePath,
            fullPage: true,
            timeout: screenshotTimeout,
            animations: 'disabled',
        });
    } catch {
        await page.screenshot({
            path: filePath,
            fullPage: false,
            timeout: screenshotTimeout,
            animations: 'disabled',
        });
    }
}

export function generateRandomEmail(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `test_${timestamp}_${random}@yopmail.com`;
}

export function logStep(stepDescription: string) {
    console.log(`\n[STEP] ${stepDescription}`);
}
