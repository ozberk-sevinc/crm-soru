# Inspect the real app screens

This preview renders the mobile screen components through React Native Web. Authentication, storage, notifications, file picking, and API calls use in-memory demo adapters. No live student account or question bank is changed.

The selector exposes 12 views: Today, multiple-choice practice, numeric practice, correct feedback, incorrect feedback and reflection, mistake notebook, progress, account and reminders, uploads, admin queue, package inspection, and sign-in. The IMAT/TOLC selector and bottom navigation also work.

```sh
npm ci --prefix mobile
npm ci --prefix tools/preview
node tools/preview/build.cjs
```

Open `docs/design-preview.html` in a browser. Build again after changing the mobile screens. An optional absolute output path can be passed to the build command.

To exercise all screens, narrow layouts, dark mode, answer submission, reflections, upload status, rejection validation, approval, and demo Google sign-in:

```sh
npx --prefix tools/preview playwright install chromium
node tools/preview/check.cjs
```

Screenshots are written to the ignored `tools/preview/artifacts/` directory. `PREVIEW_ARTIFACT_DIR` changes that location. A local Chromium executable can be supplied with `PREVIEW_CHROMIUM_PATH`. Signed builds, actual Google authentication, reminder delivery, native document providers, VoiceOver/TalkBack, and OS text scaling still require native-device QA.
