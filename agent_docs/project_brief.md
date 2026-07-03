# Project Brief

- **Product vision:** Empowering rural farmers with offline-first, on-device AI diagnostics to bridge the agricultural connectivity gap.
- **Target Audience:** Smallholder farmers in India using low-end Android devices in zero-connectivity fields.

## Conventions
- **Naming:** kebab-case for files, PascalCase for React components, camelCase for variables/functions.
- **File Structure:** Feature-based organization (e.g., `features/scanner/`, `features/history/`).
- **Models:** All AI models must be stored in `public/models/` and pre-cached by the service worker.

## Key Principles
- **Offline-First:** All core functionality (diagnosis, report viewing) must work with zero data connection.
- **Resilience:** Handle low memory (OOM), high heat, and blurry images gracefully (See Tech Design Section 6).
- **Simplicity:** Minimize text; maximize icons and visual guides for mixed literacy levels.
- **Privacy:** Diagnostics happen entirely on-device. No images leave the phone without consent.
