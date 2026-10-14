# Implementation verification

## Automated scope

- Go API tests cover bank validation, grading, numeric tolerance, daily-plan stability/completion, pre-submission answer/redacted-reminder disclosure, exam filtering, overdue review priority, user isolation, reflection ownership, one-time invitation use, logout revocation, restart persistence, failed-write rollback, corrupt-state rejection, invalid payloads and concurrent idempotent retries.
- Mobile unit tests cover strict numeric parsing (including decimal commas and an empty field) and choice membership validation.
- TypeScript checks, Expo SDK dependency checks, native project generation and Android/iOS JavaScript bundle exports verify type consistency, installed module resolution and plugin configuration. They do not validate signed native builds or notification delivery.
- A live HTTP smoke check exercises enrollment, daily questions, submission and the resulting performance against a running Go API.

## Dependency audit

An npm audit of the installed Expo 57 toolchain reports upstream advisories for **braces**, **node-forge**, and the older **uuid** used by native project tooling. The high-severity root findings affect build/tool dependencies, and npm currently reports no patched versions for braces/node-forge. Its proposed forced fix downgrades Expo to SDK 44, which is incompatible with this application and was not applied. Do not claim that the dependency audit is clean. Dependabot is configured so compatible upstream updates can be reviewed.

Before release, rerun `npm audit`, review the advisories in the actual build environment, and update to a supported patched SDK/dependency set when available. SDK compatibility checks and bundle exports are separate from that audit result.

## Not verified here

No native device or simulator screenshots, VoiceOver/TalkBack run, actual daily notification delivery, signed APK/AAB/IPA, App Store/TestFlight upload, Play Store submission, or production backend deployment has been completed. Those require the native runtime, hosting endpoint and relevant project/signing accounts. Follow `docs/device-qa.md` and the README build steps.
