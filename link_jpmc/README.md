# JPMorgan Chase Payment Cartridge for Salesforce Commerce Cloud

The JPMorgan Chase Payment Cartridge integrates the JPMorgan Payments Modern API with Salesforce Commerce Cloud (SFCC) to provide a comprehensive payment solution for e-commerce merchants.

## Overview

This cartridge enables seamless integration of JPMorgan Chase payment services with SFCC, offering secure and reliable payment processing capabilities for online merchants.

It supports both:
- **Direct API implementation** (merchant-controlled payment flow)
- **Drop-In implementation** (prebuilt payment components for faster integration)

## Features

### Integration Modes
- **Direct API**: Full control over checkout/payment orchestration
- **Drop-In**: Faster implementation with hosted/prebuilt payment UI components

### Payment Methods
- **Credit Card Payments**: Full credit card processing with enhanced security
- **Google Pay**: Digital wallet integration for web
- **Apple Pay**: Digital wallet integration for web (Safari)

### Credit Card Features
- **Page Encryption**: Client-side encryption for enhanced security
- **Tokenization**: Secure token-based payment processing
- **AVS (Address Verification System)**: Address verification for fraud prevention
- **Saved Card Payments**: Secure storage and reuse of customer payment methods
- **Authorization**: Payment authorization processing
- **Capture**: Payment capture functionality
- **Refund**: Full and partial refund capabilities
- **Void**: Transaction void operations

### Security & Compliance
- PCI DSS-compliant payment processing
- End-to-end encryption
- Secure tokenization
- Fraud prevention tools

## Supported Payment Types

- Credit Cards (Visa, Mastercard, American Express, Discover, etc.)
- Google Pay (Web)
- Apple Pay (Web — Safari)

## Technical Requirements

- Salesforce Commerce Cloud B2C Commerce
- SFRA version: 7.0.1
- Compatibility mode: 21.2+
- Node.js 14+ for development
- SGMF scripts for build processes

## Supported Locales

- en_US (English — United States)
- en_CA (English — Canada)
- Locales supported by SFRA (Multi-Merchant feature)

## Installation

### Development Setup

1. Clone the repository
2. Install dependencies (development):
   ```bash
   npm install
   ```
3. Build the cartridge:
   ```bash
   npm run build
   ```
4. Upload to SFCC:
   ```bash
   npm run uploadCartridge
   ```

### Production/CI Setup (Recommended)

For production builds and CI/CD pipelines, use `npm ci` instead of `npm install`:

```bash
npm ci
npm run build
npm run uploadCartridge
```

**Why `npm ci`?**
- Installs exact versions from `package-lock.json` (not semver ranges)
- Ensures reproducible builds across environments
- Prevents unexpected dependency updates that could introduce vulnerabilities
- Faster and more reliable in CI environments
- Required for security compliance

**Important:** Always commit `package-lock.json` to version control.

## Development Scripts

- `npm run build` - Build JavaScript and SCSS files
- `npm run watch` - Watch for changes and rebuild
- `npm run lint` - Run linting for JavaScript and CSS
- `npm run test` - Run unit tests
- `npm run uploadCartridge` - Upload cartridge to SFCC

## Cartridge Structure

- `int_jpmc_core` - Core payment functionality and API integration
- `int_jpmc_sfra` - SFRA-specific templates and controllers
- `bm_jpmc` - Business Manager components, templates, controllers, and integrations for Admin/CSC users

## Configuration

Configure the payment settings in Business Manager:

1. Navigate to **Merchant Tools > Site Preferences > Custom Preferences**
2. Configure JPMorgan Chase payment credentials
3. Enable desired payment methods
4. Select/enable the required integration mode (**Direct API** or **Drop-In**) where applicable
5. Configure service profiles and credentials

## Failover & Recovery

When the JPMorgan Chase payment service is unavailable, the cartridge handles failures as follows:

- **Service Framework Circuit Breaker**: All API calls use the SFCC Service Framework (`LocalServiceRegistry`), which provides automatic circuit-breaker protection. After repeated failures, the framework stops calling the service for a configurable cooldown period, preventing cascading timeouts.
- **Authorization Failure**: If the payment authorization call fails or times out, the order is not placed. The customer sees a payment error message and can retry or choose a different payment method.
- **3DS Authentication**: If the 3DS orchestration service is unreachable, the authentication step fails gracefully and the customer is returned to checkout with an error message.
- **Capture/Refund/Void (BM Operations)**: If a post-authorization operation fails, the CSC agent sees an error banner in Business Manager. The operation can be retried once the service recovers.
- **Fraud Check (Kount)**: If the fraud check service is unreachable, payment proceeds without a fraud score (configurable behavior via Site Preferences).
- **Logging**: All service failures are logged with error-level severity to `customerror_*` log files for monitoring and alerting.

## Security

This cartridge follows industry best practices for payment security and undergoes regular security audits.

### Security Features

- **PCI DSS Compliance**: No PAN storage, tokenization, TLS 1.2+ encryption
- **3DS 2.0**: Server-side validation with nonce protection
- **CSRF Protection**: All state-changing endpoints require CSRF tokens
- **Input Validation**: Comprehensive validation on all user inputs
- **Secure Logging**: No sensitive data in application logs

### Security Monitoring

- **Automated Scanning**: Weekly Dependabot security updates
- **CI/CD Gates**: `npm audit` checks on all pull requests
- **Vulnerability Threshold**: No high/critical production vulnerabilities allowed

### Reporting Security Issues

**Do not** create public GitHub issues for security vulnerabilities.

## Support

This cartridge is fully supported by JPMorgan Chase Payments.

For technical support and documentation, contact your JPMorgan Chase representative.

## License

Copyright © 2026 JPMorgan Chase & Co. All rights reserved.