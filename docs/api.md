# API contracts

All `/v1` responses are JSON with `Cache-Control: no-store`. Student endpoints require `Authorization: Bearer <device-token>`. Verified Google sign-in and moderated uploads are documented in [google-and-imports.md](google-and-imports.md). Students cannot select another student ID to read or alter progress. Unknown/missing exams return 400; missing/expired sessions return 401. Error bodies contain an `error` string.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Process health |
| POST | `/v1/admin/students` | Trusted admin creates/reissues an invite for a stable student ID |
| POST | `/v1/enroll` | Consume an invite code, return token and student |
| GET | `/v1/me` | Current student profile |
| GET | `/v1/daily?exam=IMAT` | Persist and fetch today’s plan and unanswered public questions |
| POST | `/v1/attempts` | Validate, grade and persist an answer, return complete feedback |
| PATCH | `/v1/attempts/{attemptId}/reflection` | Update the current student’s reflection |
| GET | `/v1/mistakes?exam=IMAT` | Most recent wrong attempt per question, with current resolution status |
| GET | `/v1/performance?exam=IMAT` | Exam-scoped overall and kazanım statistics |
| DELETE | `/v1/session` | Revoke current device session |

## Enrollment

```json
{ "code": "one-time-invite-from-consultancy" }
```

Returns `{ "token": "opaque-secret", "student": { "id": "crm-student-123", "name": "Deniz", "timezone": "Europe/Istanbul" } }`. Tokens and invites are hashed in the state file; no user passwords are involved.

## Answer submission

```json
{
  "request_id": "random-uuid-retained-for-retry",
  "question_id": "imat-cell-01",
  "option_id": "A",
  "confidence": 2,
  "duration_seconds": 32
}
```

Numeric submissions send `value` instead of `option_id`. `confidence` is 1–3, `duration_seconds` is 0–86400, and `request_id` is 16–100 characters. The exact same payload and request ID return the original attempt; reusing the ID with different content returns 400. This includes concurrent requests and retries after an API restart.

Feedback includes `correct`, the question snapshot, `correct_answer`, `explanation`, `misconception`, `affected_outcomes`, `review_at` and `reflection`. The server computes correctness; clients cannot submit a correctness flag. Duration and confidence are student/device-reported, not proctoring evidence.

Reflections use `reason` (`knowledge_gap`, `misread`, `calculation`, `time_pressure`, `guess`, or empty) and an optional `note` of at most 1000 UTF-8 bytes. The UI caps input at 1000 characters; multibyte text may reach the API byte limit earlier.

## Deployment limits

- One API process per state file. File locking is process-local; do not share one volume between API replicas.
- Put the API behind HTTPS, set `ADMIN_TOKEN` securely, and restrict `/v1/admin/*` at the reverse proxy to trusted administrative access where possible.
- Request bodies and headers are bounded; the API uses timeouts and an in-process 120 requests/minute limiter. This is basic protection, not a substitute for edge rate limits. It does not trust forwarded client-IP headers.
- No browser CORS is enabled. The app is native iOS/Android; a future browser client needs an explicit permitted-origin design.
- Moderated ZIP/folder JSON imports are implemented. No consultant dashboard, CRM SSO, remote push service or multi-tenant firm management. These are separate extensions to this focused student application.
- Invites remain valid until consumed or rotated; device sessions expire after 90 days. Google-linked users can sign in again; consultants reissue invites for invite-only recovery/renewal. There is no automatic refresh-token flow.
- Progress and question snapshots are stored until the consultancy removes them. Back up the volume and define your own retention policy before onboarding real students.
