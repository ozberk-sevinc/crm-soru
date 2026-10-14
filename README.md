# CRM Soru · Otranto Soru

A focused iOS/Android exam-practice app built with **React Native / Expo + TypeScript** and a **Go API**. Students answer daily questions, understand and record mistakes, and track their performance by **kazanım / learning outcome**. The student app stays focused on practice; admins can also review contributed question packages.

## What is implemented

- Separate **IMAT**, **TOLC-I** and **TOLC-F** practice banks: 24 original illustrative questions and 12 learning outcomes. These are sample practice questions, not official exam papers or a complete syllabus.
- A stable five-question daily plan per student, exam and account-local date. Overdue wrong answers come first, then unseen questions, then due and future reviews. Completion tracks distinct questions, not repeat submissions.
- Single-choice and numeric answer types defined in JSON. Numeric answers accept decimal commas in the mobile UI and server-side absolute tolerances.
- Server-side grading. The daily API never sends the answer key, explanation or distractor diagnosis before submission.
- Recorded answer, confidence (guessing / unsure / confident), elapsed seconds, explanation, wrong-option misconception, affected kazanımlar, review date and optional student reflection.
- A mistake notebook with unresolved/resolved filters, reflection editing and retry. A later correct answer resolves the question; the original wrong answer stays in history.
- Overall accuracy, total submissions, answer time, account-local seven-day activity, practice streak, unresolved questions and learning-outcome accuracy. Outcome metrics use the **latest answer to each distinct question**, avoiding repeated-question sample inflation. This is practice evidence, not a validated mastery or official exam score.
- Optional daily **local device notifications** with a configurable time, permission-denied recovery, notification-tap navigation and disable control. No push service or background Go job is needed. Reminders use the device timezone and continue after a daily session is complete.
- Verified **Google sign-in**, optional invite linking to preserve existing student history, server-controlled admin roles, securely stored device sessions and invite fallback.
- **ZIP / folder / multiple JSON uploads**, a pending approval queue, admin previews with answer keys, approve/reject decisions and uploader-visible status/reasons. Approved packages are published atomically and survive restarts.
- Student-scoped progress and idempotent answer submission with interrupted-answer recovery.
- Light/dark themes, safe-area handling, scalable system text, large touch targets, accessible controls, keyboard-aware forms, phone/tablet width limits, loading/empty/error/disabled states. Motion is limited to press feedback and native interactions.

## Start locally

Requirements: **Go 1.26+**, **Node 22.13+**, npm, and an iOS/Android device or simulator compatible with Expo SDK 57.

Terminal 1:

```sh
cd backend
DEMO_MODE=true go run ./cmd/server
```

Terminal 2:

```sh
cd mobile
npm ci
EXPO_PUBLIC_API_URL=http://127.0.0.1:8080 npm start
```

Use invite code **`DEMO-STUDENT`** with `DEMO_MODE=true`. Each enrollment creates a separate demo account; subsequent launches keep that account’s secure token. Demo mode is opt-in and must be off on a student-facing server.

The default API bind is loopback. For a real phone on your development LAN, start the API with `LISTEN_ADDR=0.0.0.0:8080` and use your computer’s LAN IP in `EXPO_PUBLIC_API_URL`. Android emulator uses `http://10.0.2.2:8080`; iOS simulator can use loopback. Standalone release builds require an **HTTPS** API address. For consistent native/notification testing use an Expo development build (`npx expo run:android` or `npx expo run:ios` on a Mac), not just Expo Go. Native cleartext restrictions can block HTTP: use an HTTPS development endpoint if needed.

## Add your questions and kazanımlar

Edit [`backend/data/questions.json`](backend/data/questions.json). The repository bank is loaded and validated at API startup; restart after editing that file. Approved uploads are added from persistent state without a restart. See the complete format, distractor mapping and numerical question example in [`docs/question-bank.md`](docs/question-bank.md). [`backend/data/questions.schema.json`](backend/data/questions.schema.json) provides editor/schema validation, and the Go loader also checks cross-references and unique IDs.

```sh
cd backend
go run ./cmd/server validate-bank
```

Keep question IDs stable for identical content, and use **new IDs for material question/answer changes**. Attempt records keep a content/answer/outcome snapshot for historical feedback. Do not remove assigned questions mid-day; roll over old content between sessions. New exam families and new renderer/grader types require corresponding application support, not an unrecognised type string.

## Invite real students

Leave `DEMO_MODE=false` and configure Google OAuth/admin identities as described in [`docs/google-and-imports.md`](docs/google-and-imports.md), or set `ADMIN_TOKEN` to a random secret of at least 32 characters for trusted invitation tooling. Keep the admin secret on the server / in your administrative tooling; it must never be an `EXPO_PUBLIC_*` variable or part of the mobile app.

```sh
cd backend
export ADMIN_TOKEN="$(openssl rand -hex 32)"
go run ./cmd/server
```

From trusted server tooling, create an invite using the student’s stable CRM ID:

```sh
curl -X POST https://your-soru-api.example.com/v1/admin/students \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"student_id":"crm-student-123","name":"Deniz","timezone":"Europe/Istanbul"}'
```

The response contains a one-time `invite_code`. Share it with that student through your existing process. Enrollment exchanges it for a 90-day opaque device session token. Only hashes of tokens and invite codes are persisted. Reissuing an invite for the same `student_id` revokes previous sessions, updates the student profile and preserves history; this is also the account recovery / session renewal path. Invite-only accounts require a new invite after signing out; linked Google accounts can sign in again with Google. Invites remain valid until used or reissued.

Google sign-in creates a student account on first login and restores it thereafter. Enter an invite before the first Google sign-in to link an existing student ID and preserve history. **Google admin roles come only from server allowlists.** This is app authentication, not CRM SSO or a consultant monitoring screen. The app never stores an admin secret. See [`docs/google-and-imports.md`](docs/google-and-imports.md) for OAuth registration, admin configuration and the upload format.

## Storage and hosting

The Go API uses Google’s official ID-token validator. It stores students, hashed sessions, attempts, daily plans, question submissions, review audit records and the published bank in `STATE_PATH` (default `backend/var/state.json`). Updates use a mutex, a private state copy, synced temporary files and atomic replacement; a failed write does not acknowledge an answer. Corrupt state refuses startup instead of resetting progress.

This file store is designed for a **single API instance and an initial pilot**, not multiple replicas or an unlimited question history. Every transaction rewrites the state file, including validated uploaded package content. Use a backed-up persistent volume, restrict access and run TLS at your reverse proxy. Move the store to PostgreSQL before scaling to multiple API replicas or substantial history; the HTTP contracts and student IDs can remain the same. Deleting/exporting accounts currently requires trusted backend administration; there is no in-app deletion workflow yet.

```sh
docker build -t crm-soru-api backend
docker volume create crm-soru-data
docker run --rm -p 8080:8080 \
  -e ADMIN_TOKEN -e DEMO_MODE=false \
  -v crm-soru-data:/app/var crm-soru-api
```

The container runs as a non-root user. Ensure a bind-mounted directory is writable by UID 10001. See [`docs/api.md`](docs/api.md) for endpoint contracts and deployment limits.

## Google sign-in and question uploads

Open **Account → Upload a question package** to choose a ZIP, folder or JSON files. Submissions stay pending until a configured admin approves them in **Account → Review pending question packages**. Rejected packages stay out of practice, and the uploader sees the reason. A ready-to-upload example folder is included in `examples/question-package/`.

Native Google sign-in requires your actual Web/iOS OAuth client IDs and Android package/signing certificate registrations. Configuration is documented in [`docs/google-and-imports.md`](docs/google-and-imports.md); no fake live credentials are included. Google login requires an Expo development/standalone build.

## Build Android and iOS

[`mobile/eas.json`](mobile/eas.json) contains development, preview and production profiles. Set up your own Expo project with `npx eas-cli@latest init` inside `mobile`; this repository deliberately includes no borrowed project ID or signing credentials.

```sh
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:set preview --name EXPO_PUBLIC_API_URL \
  --value https://your-soru-api.example.com --visibility plaintext
npx eas-cli@latest env:set production --name EXPO_PUBLIC_API_URL \
  --value https://your-soru-api.example.com --visibility plaintext
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

- **Android preview:** installable APK. **Production:** AAB for Google Play.
- **iOS preview:** an internally distributed signed build; register test devices with EAS and provide the Apple Developer signing account. An IPA is not an unrestricted APK-style download. For wider testing use a production build submitted to TestFlight.
- **Production:** `npx eas-cli@latest build --platform all --profile production`, then configure your store accounts and submit with EAS. Bundle/package IDs currently use `com.otrantoconnect.soru`; confirm ownership before distributing.
- Configure notification permissions and test real-device daily delivery before releasing. Local reminders are subject to OS permission, battery and scheduling behaviour.

## Checks and native QA

```sh
cd backend
go test -race ./...
go vet ./...
go run ./cmd/server validate-bank

cd ../mobile
npm ci
npx expo install --check
npm run typecheck
npm test
npm run export:android
npm run export:ios
```

GitHub Actions runs these on PRs and main. Bundle exports verify JavaScript/platform module resolution; **they do not produce signed binaries or verify native runtime/notification behaviour**. Before distribution complete [`docs/device-qa.md`](docs/device-qa.md) on both platforms, including screen readers, large text, offline submission recovery and notification delivery.
