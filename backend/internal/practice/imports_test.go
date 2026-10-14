package practice

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"google.golang.org/api/idtoken"
)

func newImportBank(t *testing.T, a *API, id string) Bank {
	t.Helper()
	q := a.Bank.Questions[0]
	q.ID = id
	return Bank{Version: 1, Outcomes: a.Bank.Resolve(q.OutcomeIDs), Questions: []Question{q}}
}
func upload(t *testing.T, a *API, token, requestID string, files map[string][]byte) *httptest.ResponseRecorder {
	t.Helper()
	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)
	if err := writer.WriteField("title", "Biology practice"); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("request_id", requestID); err != nil {
		t.Fatal(err)
	}
	for name, content := range files {
		part, err := writer.CreateFormFile("files", name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = part.Write(content); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("POST", "/v1/imports", &buffer)
	r.Header.Set("Content-Type", writer.FormDataContentType())
	r.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	return w
}
func marshal(t *testing.T, value any) []byte {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return data
}
func archive(t *testing.T, files map[string][]byte) []byte {
	t.Helper()
	var b bytes.Buffer
	w := zip.NewWriter(&b)
	for name, data := range files {
		f, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = f.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}
func adminSession(t *testing.T, a *API) string {
	t.Helper()
	a.GoogleAdminSubjects = map[string]bool{"admin-google-sub": true}
	err := a.Store.Transaction(func(s *State) error {
		s.Students["admin"] = Student{ID: "admin", Name: "Admin", Timezone: "Europe/Rome", GoogleSubject: "admin-google-sub"}
		s.Sessions[hash("admin-token")] = Session{StudentID: "admin", ExpiresAt: a.now().AddDate(0, 0, 1)}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return "admin-token"
}
func TestImportApprovalPublishesOnlyAfterReviewAndSurvivesRestart(t *testing.T) {
	a, _ := fixture(t)
	admin := adminSession(t, a)
	bank := newImportBank(t, a, "uploaded-biology-01")
	w := upload(t, a, "token-a", "upload-request-00001", map[string][]byte{"biology/questions.json": marshal(t, bank)})
	if w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	summary := read[ImportSummary](t, w)
	if summary.Status != "pending" || summary.Files[0] != "biology/questions.json" {
		t.Fatal("pending package/path not recorded")
	}
	if strings.Contains(w.Body.String(), "explanation") || strings.Contains(w.Body.String(), "remember") {
		t.Fatal("bank content leaked in summary")
	}
	submission := Submission{RequestID: "uploaded-answer-001", QuestionID: "uploaded-biology-01", OptionID: "B", Confidence: 2}
	if call(t, a, "POST", "/v1/attempts", "token-a", submission).Code != 400 {
		t.Fatal("pending question was active")
	}
	if call(t, a, "GET", "/v1/admin/imports", "token-a", nil).Code != 403 {
		t.Fatal("student accessed admin queue")
	}
	if call(t, a, "GET", "/v1/admin/imports/"+summary.ID, "token-a", nil).Code != 403 {
		t.Fatal("student accessed answer preview")
	}
	if call(t, a, "POST", "/v1/admin/imports/"+summary.ID+"/decision", "token-a", map[string]string{"decision": "approved"}).Code != 403 {
		t.Fatal("student approved upload")
	}
	preview := call(t, a, "GET", "/v1/admin/imports/"+summary.ID, admin, nil)
	if preview.Code != 200 || !strings.Contains(preview.Body.String(), "explanation") {
		t.Fatal("admin cannot preview bank")
	}
	decision := map[string]string{"decision": "approved", "note": "Checked all kazanımlar"}
	w = call(t, a, "POST", "/v1/admin/imports/"+summary.ID+"/decision", admin, decision)
	if w.Code != 200 || read[ImportSummary](t, w).Status != "approved" {
		t.Fatal(w.Body.String())
	}
	if call(t, a, "POST", "/v1/admin/imports/"+summary.ID+"/decision", admin, decision).Code != 200 {
		t.Fatal("decision retry failed")
	}
	w = call(t, a, "POST", "/v1/attempts", "token-a", submission)
	if w.Code != 200 || !read[Attempt](t, w).Correct {
		t.Fatal("approved question not gradeable")
	}
	reopened, err := OpenStore(a.Store.path)
	if err != nil {
		t.Fatal(err)
	}
	a.Store = reopened
	if err = a.ValidatePublished(); err != nil {
		t.Fatal(err)
	}
	a.Store.Read(func(s State) {
		if len(s.Published.Questions) != 1 {
			t.Fatal("approval duplicated/lost question")
		}
		if s.Imports[summary.ID].ReviewedBy != "admin" {
			t.Fatal("missing reviewer audit")
		}
	})
}
func TestZIPFragmentsRejectionAndImportIdempotency(t *testing.T) {
	a, _ := fixture(t)
	admin := adminSession(t, a)
	bank := newImportBank(t, a, "zip-biology-01")
	files := map[string][]byte{"outcomes.json": marshal(t, Bank{Version: 1, Outcomes: bank.Outcomes, Questions: []Question{}}), "questions/part.json": marshal(t, Bank{Version: 1, Outcomes: []Outcome{}, Questions: bank.Questions})}
	zipFiles := map[string][]byte{"package.zip": archive(t, files)}
	w := upload(t, a, "token-a", "zip-upload-0000001", zipFiles)
	if w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	summary := read[ImportSummary](t, w)
	second := upload(t, a, "token-a", "zip-upload-0000001", zipFiles)
	if second.Code != 201 || read[ImportSummary](t, second).ID != summary.ID {
		t.Fatal("retry duplicated package")
	}
	if upload(t, a, "token-a", "zip-upload-0000001", map[string][]byte{"bank.json": marshal(t, bank)}).Code != 409 {
		t.Fatal("same request reused with new source")
	}
	if call(t, a, "POST", "/v1/admin/imports/"+summary.ID+"/decision", admin, map[string]string{"decision": "rejected"}).Code != 400 {
		t.Fatal("rejection requires reason")
	}
	w = call(t, a, "POST", "/v1/admin/imports/"+summary.ID+"/decision", admin, map[string]string{"decision": "rejected", "note": "Please correct the explanation"})
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	a.Store.Read(func(s State) {
		if len(s.Published.Questions) != 0 {
			t.Fatal("rejected questions were published")
		}
	})
	mine := read[[]ImportSummary](t, call(t, a, "GET", "/v1/imports", "token-a", nil))
	if len(mine) != 1 || mine[0].ReviewNote != "Please correct the explanation" {
		t.Fatal("review reason missing")
	}
	if len(read[[]ImportSummary](t, call(t, a, "GET", "/v1/imports", admin, nil))) != 0 {
		t.Fatal("another uploader's history leaked")
	}
}
func TestRejectUnsafeArchivesAndInvalidBanks(t *testing.T) {
	a, _ := fixture(t)
	valid := marshal(t, newImportBank(t, a, "safe-01"))
	for i, name := range []string{"../bank.json", "/bank.json", "C:/bank.json", "questions\\bank.json", "bank.exe"} {
		w := upload(t, a, "token-a", fmt.Sprintf("unsafe-upload-%03d", i), map[string][]byte{"package.zip": archive(t, map[string][]byte{name: valid})})
		if w.Code != 400 {
			t.Fatalf("unsafe path accepted: %s", name)
		}
	}
	for i, data := range [][]byte{[]byte(`{"version":1,"questions":[],"outcomes":[]}`), []byte(`{"version":1,"questionz":[]}`), append(valid, []byte(` {"extra":true}`)...)} {
		if upload(t, a, "token-a", fmt.Sprintf("invalid-json-%04d", i), map[string][]byte{"bank.json": data}).Code != 400 {
			t.Fatal("invalid bank accepted")
		}
	}
	large := archive(t, map[string][]byte{"bank.json": bytes.Repeat([]byte(" "), int(MaxJSONBytes)+1)})
	if upload(t, a, "token-a", "oversize-zip-0001", map[string][]byte{"a.zip": large}).Code != 400 {
		t.Fatal("expanded-size bound missing")
	}
	var b bytes.Buffer
	writer := zip.NewWriter(&b)
	header := &zip.FileHeader{Name: "bank.json", Method: zip.Deflate}
	header.SetMode(os.ModeSymlink | 0777)
	f, _ := writer.CreateHeader(header)
	_, _ = f.Write(valid)
	_ = writer.Close()
	if upload(t, a, "token-a", "symlink-zip-00001", map[string][]byte{"a.zip": b.Bytes()}).Code != 400 {
		t.Fatal("symlink allowed")
	}
}
func TestApprovalConflictAndFailedWriteLeavePackagePending(t *testing.T) {
	a, _ := fixture(t)
	admin := adminSession(t, a)
	bank := newImportBank(t, a, a.Bank.Questions[0].ID)
	summary := read[ImportSummary](t, upload(t, a, "token-a", "conflict-upload-001", map[string][]byte{"bank.json": marshal(t, bank)}))
	if call(t, a, "POST", "/v1/admin/imports/"+summary.ID+"/decision", admin, map[string]string{"decision": "approved"}).Code != 409 {
		t.Fatal("existing question overwritten")
	}
	a.Store.Read(func(s State) {
		if s.Imports[summary.ID].Status != "pending" || len(s.Published.Questions) != 0 {
			t.Fatal("conflict partially published")
		}
	})
	bank.Questions[0].ID = "disk-write-test"
	summary = read[ImportSummary](t, upload(t, a, "token-a", "failed-write-upload01", map[string][]byte{"bank.json": marshal(t, bank)}))
	bad := filepath.Join(t.TempDir(), "file")
	_ = os.WriteFile(bad, []byte("x"), 0600)
	a.Store.path = filepath.Join(bad, "state.json")
	if call(t, a, "POST", "/v1/admin/imports/"+summary.ID+"/decision", admin, map[string]string{"decision": "approved"}).Code != 500 {
		t.Fatal("failed write acknowledged")
	}
	a.Store.Read(func(s State) {
		if s.Imports[summary.ID].Status != "pending" || len(s.Published.Questions) != 0 {
			t.Fatal("disk failure partially published")
		}
	})
}
func TestGoogleSignInLinkingAndRoles(t *testing.T) {
	a, _ := fixture(t)
	a.GoogleAdminEmails = map[string]bool{"admin@gmail.com": true}
	a.VerifyGoogle = func(_ context.Context, token string) (GoogleIdentity, error) {
		if token == "invalid" {
			return GoogleIdentity{}, fmt.Errorf("bad token")
		}
		if token == "admin" {
			return GoogleIdentity{Subject: "google-admin", Email: "admin@gmail.com", Name: "Admin", EmailAuthoritative: true}, nil
		}
		if token == "external" {
			return GoogleIdentity{Subject: "external-google", Email: "admin@gmail.com", Name: "External", EmailAuthoritative: false}, nil
		}
		return GoogleIdentity{Subject: "google-student", Email: "student@gmail.com", Name: "Google Student", EmailAuthoritative: true}, nil
	}
	login := func(token, invite string) *httptest.ResponseRecorder {
		return call(t, a, "POST", "/v1/auth/google", "", map[string]string{"id_token": token, "invite_code": invite, "timezone": "Europe/Rome"})
	}
	if login("invalid", "").Code != 401 {
		t.Fatal("invalid Google credential accepted")
	}
	w := call(t, a, "POST", "/v1/admin/students", a.AdminToken, map[string]string{"student_id": "crm-google-student", "name": "Existing student", "timezone": "Europe/Rome"})
	code := read[map[string]string](t, w)["invite_code"]
	result := read[struct {
		Token   string  `json:"token"`
		Student Student `json:"student"`
	}](t, login("student", code))
	if result.Student.ID != "crm-google-student" || result.Student.Role != "student" || result.Student.GoogleSubject != "" {
		t.Fatal("invite linking or public profile failed")
	}
	second := read[struct {
		Student Student `json:"student"`
	}](t, login("student", ""))
	if second.Student.ID != result.Student.ID {
		t.Fatal("Google re-login created new account")
	}
	admin := read[struct {
		Token   string  `json:"token"`
		Student Student `json:"student"`
	}](t, login("admin", ""))
	if admin.Student.Role != "admin" || call(t, a, "GET", "/v1/admin/imports", admin.Token, nil).Code != 200 {
		t.Fatal("configured admin cannot review")
	}
	external := read[struct {
		Student Student `json:"student"`
	}](t, login("external", ""))
	if external.Student.Role != "student" {
		t.Fatal("untrusted email granted admin")
	}
	delete(a.GoogleAdminEmails, "admin@gmail.com")
	if call(t, a, "GET", "/v1/admin/imports", admin.Token, nil).Code != 403 {
		t.Fatal("removed admin still authorised")
	}
	// Client-supplied role/email are never accepted by the Google endpoint.
	if call(t, a, "POST", "/v1/auth/google", "", map[string]string{"id_token": "student", "timezone": "Europe/Rome", "role": "admin"}).Code != 400 {
		t.Fatal("client role accepted")
	}
}
func TestGoogleClaimsAndMalformedSignatures(t *testing.T) {
	now := time.Now()
	allowed := map[string]bool{"our-client": true}
	base := idtoken.Payload{Issuer: "https://accounts.google.com", Audience: "our-client", Subject: "123", Expires: now.Add(time.Hour).Unix(), IssuedAt: now.Unix(), Claims: map[string]any{"email": "admin@gmail.com", "email_verified": true}}
	if _, err := googleClaims(&base, allowed, now); err != nil {
		t.Fatal(err)
	}
	for _, change := range []func(*idtoken.Payload){func(p *idtoken.Payload) { p.Issuer = "https://attacker.test" }, func(p *idtoken.Payload) { p.Audience = "other-client" }, func(p *idtoken.Payload) { p.Expires = now.Add(-time.Second).Unix() }, func(p *idtoken.Payload) { p.Subject = "" }, func(p *idtoken.Payload) { p.IssuedAt = now.Add(time.Hour).Unix() }, func(p *idtoken.Payload) {
		p.Claims = map[string]any{"email": "admin@gmail.com", "email_verified": false}
	}} {
		p := base
		change(&p)
		if _, err := googleClaims(&p, allowed, now); err == nil {
			t.Fatal("invalid Google claims accepted")
		}
	}
	verify, err := NewGoogleVerifier([]string{"our-client"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = verify(context.Background(), "malformed-token"); err == nil {
		t.Fatal("malformed token accepted by real verifier")
	}
}
func TestOldStateMigratesWithoutLosingProgress(t *testing.T) {
	a, _ := fixture(t)
	var legacy map[string]any
	a.Store.Read(func(s State) { _ = json.Unmarshal(marshal(t, s), &legacy) })
	delete(legacy, "imports")
	delete(legacy, "published")
	path := filepath.Join(t.TempDir(), "legacy.json")
	if err := os.WriteFile(path, marshal(t, legacy), 0600); err != nil {
		t.Fatal(err)
	}
	store, err := OpenStore(path)
	if err != nil {
		t.Fatal(err)
	}
	store.Read(func(s State) {
		if s.Imports == nil || s.Published.Version != 1 || len(s.Students) != 1 {
			t.Fatal("legacy state migration failed")
		}
	})
}
