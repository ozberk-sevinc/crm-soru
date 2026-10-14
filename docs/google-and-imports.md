# Google sign-in and moderated question packages

## Student and admin flow

1. Sign in with **Google** or an existing consultancy invite. Google creates a student account on first sign-in and restores the same account on later sign-ins.
2. If you already have invite-based progress, enter a new invite for that same student **before your first Google sign-in**. The verified Google identity links to the invited student ID and preserves history. The server never merges accounts just because email addresses match.
3. Open **Account → Upload a question package**. Choose one ZIP, a folder, or multiple JSON files; add a title and send it for approval.
4. The uploader sees **Pending**, **Approved** or **Rejected**, plus the admin’s review note. Pending/rejected questions are never gradeable or included in practice.
5. Configured admins see **Account → Review pending question packages**. They can preview every question, correct answer, explanation, distractor hint and kazanım, then explicitly **Approve and publish** or **Reject package**. Rejection requires a reason.
6. Approval adds the package to the live Go bank without restarting. Existing daily plans stay stable; newly generated plans can use the new questions. Published questions and review history survive an API restart.

Every Google user starts as a student except the explicitly configured admins. Admin roles are rechecked against server configuration on authenticated requests. There is no user-selectable admin role or mobile admin secret. Removing an identity from the allowlist removes review permission on existing sessions after the server reloads its configuration.

## Configure Google OAuth

This uses `@react-native-google-signin/google-signin` with the Google SDKs and the official Go `google.golang.org/api/idtoken` validator. **Google sign-in requires a development/standalone native build; it does not run in Expo Go.** No Firebase project or service-account key is required.

Create a Google Cloud OAuth project / consent configuration, then create:

- A **Web application OAuth client** for the backend audience. Its client ID is used by the mobile SDK as `webClientId` and by the Go server’s allowlist. Do not put a client secret into the app; ID-token validation does not require one.
- An **Android OAuth client** for `com.otrantoconnect.soru` with the certificate SHA-1 of each actual build/signing key (development, EAS preview/release, and Google Play App Signing as applicable). Google uses package/certificate registration to identify the Android app. This Android client ID is not the `webClientId`.
- An **iOS OAuth client** for `com.otrantoconnect.soru`. The app config derives its reversed-client URL scheme and the native SDK receives the iOS client ID.

Set these values locally and in every EAS environment where Google login should work:

```sh
# mobile/.env (local), and equivalent values in EAS
EXPO_PUBLIC_API_URL=https://your-soru-api.example.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client.apps.googleusercontent.com
```

```sh
cd mobile
npx eas-cli@latest env:set preview --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID \
  --value YOUR_WEB_CLIENT_ID --visibility plaintext
npx eas-cli@latest env:set preview --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID \
  --value YOUR_IOS_CLIENT_ID --visibility plaintext
# Repeat for development/production as needed.
npx expo prebuild --clean
```

Rebuild the native app after changing the Google iOS URL scheme or plugin configuration. When both Google IDs are absent, the app keeps invite login and clearly disables Google sign-in; it does not pretend a placeholder credential works. A partly configured Google build fails config validation so it cannot silently ship incomplete native setup.

On the server:

```sh
GOOGLE_CLIENT_IDS=your-web-client.apps.googleusercontent.com
GOOGLE_ADMIN_EMAILS=your-admin@gmail.com,another-admin@your-workspace.example
# Optional: stable Google account subject IDs, independent of email addresses.
GOOGLE_ADMIN_SUBJECTS=
```

`GOOGLE_ADMIN_EMAILS` matches exact normalised addresses only. For email-based admin assignment, the verified Google token must show Gmail or a Google Workspace hosted domain, where Google is authoritative for the email address. For third-party email Google accounts, configure the **stable Google subject** in `GOOGLE_ADMIN_SUBJECTS` instead. Do not use an email domain wildcard.

Production startup requires a configured Google verifier plus an admin allowlist, or a random `ADMIN_TOKEN` of at least 32 characters for trusted server tooling. Google admins can also create/reissue student invitations through `/v1/admin/students` using their app session; the optional master admin token remains server-only.

The API validates Google signatures, expiry, issuer, configured audience and verified email, then issues its own opaque session. Google subject IDs identify accounts; client-supplied names, IDs, emails and roles are not trusted. Tokens are sent over HTTPS and only the app session is persisted in SecureStore. Signing out revokes that app session and clears native Google sign-in state; the same Google account can sign in again without a new invite.

## Package format

Only JSON question-bank content is supported. PDFs/images are not converted into questions. A ZIP can contain nested JSON files. A selected folder is traversed into the same multipart upload contract, with safe relative filenames preserved. iOS/Android directory picking is implemented by Expo FileSystem, but provider availability varies; use ZIP or multi-file selection if the provider refuses folder access.

Each JSON file has `version: 1`, `outcomes` and `questions`. You may supply one complete bank file, or split the arrays across files. Shared identical outcome definitions are deduplicated; conflicting definitions or duplicate question IDs are rejected. The combined package must pass the full question-bank validation. Questions must reference outcomes included in the package, even if the same outcome is already in the live bank.

See **`examples/question-package/`** for a ready-to-upload folder with a new sample question ID and matching kazanım. Upload that folder, select its two JSON files, or make a ZIP:

```sh
cd examples/question-package
zip -r ../biology-package.zip outcomes.json questions
```

The full-bank JSON Schema describes the merged bank. Individual split fragments may have an empty `questions` or `outcomes` array until combined. Do not include `questions.schema.json`, README files or other non-bank content in the upload. macOS `.DS_Store` and `__MACOSX` metadata are ignored in ZIPs.

Limits: 8 MiB of uploaded content, 2 MiB per JSON file, 16 MiB expanded ZIP content, 100 JSON files, 200 ZIP entries, 2000 questions and 500 outcomes per package, and ten pending packages per uploader. Paths cannot be absolute, contain traversal/backslashes/drive prefixes, or exceed the nesting/path limits. Symlinks and non-JSON files are rejected. ZIPs are inspected in memory and are never extracted to disk.

## Review and persistence

The state file stores validated packages, uploader/reviewer IDs, review times, status, notes and the separately published bank. Summaries never include the imported answers; only authenticated admins can fetch full review previews. Uploader listing is scoped to the current account.

Approving a duplicate existing question ID or a conflicting outcome definition returns 409 and leaves the package pending. Use a new question ID for a new or materially changed question. Approval is all-or-nothing: the bank publication and review audit record commit in the same transaction. Concurrent/retried matching decisions cannot publish the package twice. A different decision after review is rejected. There is no silent overwrite or reversal of a reviewed package.

Uploads use a request UUID. Retrying the same UUID and package returns the existing submission; changing its content/title/source with the same UUID is rejected. The mobile composer retains that UUID while retrying after a network failure; after leaving the screen/relaunching, check upload history before resubmitting. No archive payload is saved to AsyncStorage.

The single-instance JSON store remains a pilot implementation. Validated package content adds to state size; back it up and migrate to database/object storage before scaling. Pending content is not a public download and is never imported into the mobile bundle. The initial sample bank can remain read-only in the repository while approved packages live in the persistent volume.

## Added API contracts

| Method | Endpoint | Access / payload |
| --- | --- | --- |
| POST | `/v1/auth/google` | Public; `{id_token, timezone, invite_code?}` → app session and role-bearing student profile |
| POST | `/v1/imports` | Authenticated; multipart `title`, `request_id`, and one or more `files` parts |
| GET | `/v1/imports` | Authenticated; current uploader’s package summaries |
| GET | `/v1/admin/imports` | Admin; all submission summaries |
| GET | `/v1/admin/imports/{id}` | Admin; summary plus full bank preview |
| POST | `/v1/admin/imports/{id}/decision` | Admin; `{decision:"approved"\|"rejected", note}` |

## Verification still required on your accounts/devices

Configure real OAuth client IDs and signing certificate registrations, then test the native Google account picker on iOS and Android, first-time invite linking, returning sign-in, sign-out, revoked admin roles and denied Play Services. Test ZIP, nested-folder and multi-file providers on both platforms, cancellation, network timeout/retry, rejection reasons, conflicting approval, and approved content after restart. Automated tests/bundle exports cannot validate an OAuth consent configuration, real Google login or file-provider permission behaviour without those accounts/devices.

Sources: [native library Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo), [native library Google configuration](https://react-native-google-signin.github.io/docs/original), [Google backend verification](https://developers.google.com/identity/sign-in/ios/backend-auth), [official Go validator](https://pkg.go.dev/google.golang.org/api/idtoken), [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/).
