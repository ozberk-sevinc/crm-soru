# Native release QA

Implementation target: Expo SDK 57 / React Native 0.86, iOS and Android. Design dials: variance **5**, motion **2**, density **4**. The visual system uses a warm neutral background, one green brand accent, semantic error colour, system typography and 4-point spacing. No animated decorative content is required. Phone/tablet content is capped at 680–720 points and bottom navigation wraps when space is limited.

Automated Go tests, TypeScript checks and JS bundle exports do not replace these native checks. Run on small and large phones, a tablet/window, light and dark mode, and large text.

1. Enroll with a fresh invite. Relaunch and confirm the same account/history loads. Check a reused invite is rejected. Reissue an invite for the same student and confirm the previous token stops working while history survives.
2. Confirm five questions load for each exam. Submit one choice and one numeric answer; check correct answers, distractor explanations, decimal-comma entry and confidence. Empty numeric input must not count as zero.
3. Submit a wrong answer, choose a reason and write a note. Save or continue; confirm the reflection remains in the notebook. Edit it from the notebook. Retry correctly and confirm the question becomes resolved while the original wrong attempt remains.
4. Disconnect the network while submitting, or kill the app immediately after a tap. Relaunch, recover the saved pending answer and verify the server counts it once. The app holds one pending answer rather than presenting a misleading offline success state.
5. Confirm totals, daily completion, seven-day activity and streaks. Check repeated retries increase submission counts but leave the kazanım sample count based on distinct questions. Compare near midnight in Europe/Rome and Europe/Istanbul.
6. Allow local notification permission, choose a near-future time and verify actual delivery with the app closed. Tap the reminder and confirm Today opens. Change the time; verify there is only one schedule. Disable reminders and sign out; verify the schedule is removed.
7. Deny notifications, then open Settings through the app and recover. Check Android battery scheduling and iOS provisional permission behaviour on the target OS. Change device timezone and confirm displayed reminder time matches device behaviour.
8. Check notch/home-indicator/system navigation insets, rotations, tablet widths, large text, multiline prompts/options, keyboard visibility, and back navigation. Read each core flow with VoiceOver and TalkBack; verify radio selection states, tab names and progress labels.
9. Check loading, empty bank/exam, zero performance, network errors, invalid answers, expired sessions and disabled controls. No exam should display another account’s history or old data from a different selected exam.
10. Set the production HTTPS API URL, confirm package/bundle IDs, configure real app-store accounts, review privacy disclosures and store assets, then test signed preview builds before submitting production builds.

At five seconds, students should recognise **Today’s next question**, **the reason and concept behind a mistake**, or **their exam-scoped progress**. Native reminders and actual signed binaries require real-device/build-account verification.

11. Complete the Google identity/admin and ZIP/folder upload checks in `docs/google-and-imports.md`, including linking existing history, denial of student approval, package previews, rejection reasons, conflicting approval, timeout recovery and published content after restart.
