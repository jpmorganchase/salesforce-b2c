# Functional Tests

Playwright + TypeScript functional tests for JPMC SFRA flows.

## Setup

Run from the link_jpmc root:

```bash
npm run test:functional:setup
cp test/functional/.env.example test/functional/.env
```

Configure sandbox URLs and test credentials in test/functional/.env.

## Run

```bash
npm run test:functional
npm run test:functional:headed
npm run test:functional:ui
npm run test:functional:report
```

## Debug

```bash
cd test/functional
npx playwright test --debug
PWDEBUG=1 npx playwright test
```
