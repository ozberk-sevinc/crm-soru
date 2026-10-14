package practice

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func fixture(t *testing.T) (*API, Student) {
	t.Helper()
	bank, err := LoadBank("../../data/questions.json")
	if err != nil {
		t.Fatal(err)
	}
	store, err := OpenStore(filepath.Join(t.TempDir(), "state.json"))
	if err != nil {
		t.Fatal(err)
	}
	student := Student{ID: "student-a", Name: "Student A", Timezone: "Europe/Rome"}
	now := time.Date(2026, 10, 13, 23, 30, 0, 0, time.UTC)
	api := &API{Bank: bank, Store: store, AdminToken: strings.Repeat("a", 32), Demo: true, Now: func() time.Time { return now }}
	if err = store.Transaction(func(s *State) error {
		s.Students[student.ID] = student
		s.Sessions[hash("token-a")] = Session{StudentID: student.ID, ExpiresAt: now.AddDate(0, 0, 1)}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return api, student
}
func call(t *testing.T, a *API, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	r := httptest.NewRequest(method, path, &buf)
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	return w
}
func read[T any](t *testing.T, w *httptest.ResponseRecorder) T {
	t.Helper()
	var value T
	if err := json.Unmarshal(w.Body.Bytes(), &value); err != nil {
		t.Fatal(err)
	}
	return value
}

func TestBankValidation(t *testing.T) {
	a, _ := fixture(t)
	if len(a.Bank.Questions) != 24 {
		t.Fatal("expected 24 sample questions")
	}
	bank := a.Bank
	bank.Questions = append([]Question(nil), a.Bank.Questions...)
	bank.Questions[0].OutcomeIDs = []string{"missing"}
	if bank.Validate() == nil {
		t.Fatal("unknown outcome accepted")
	}
	bank.Questions = append([]Question(nil), a.Bank.Questions...)
	bank.Questions[0].Answer.OptionID = "Z"
	if bank.Validate() == nil {
		t.Fatal("missing correct answer accepted")
	}
	bank.Questions = append([]Question(nil), a.Bank.Questions...)
	bank.Questions[0].Type = "essay"
	if bank.Validate() == nil {
		t.Fatal("unsupported type accepted")
	}
}
func TestDailyDoesNotLeakAnswersAndIsStable(t *testing.T) {
	a, _ := fixture(t)
	w := call(t, a, "GET", "/v1/daily?exam=IMAT", "token-a", nil)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	for _, secret := range []string{"explanation", "misconception", "option_id", "tolerance"} {
		if strings.Contains(w.Body.String(), secret) {
			t.Fatalf("leaked %s", secret)
		}
	}
	d := read[Daily](t, w)
	for _, q := range d.Questions {
		for _, o := range q.Outcomes {
			if o.Remember != "" {
				t.Fatal("learning-outcome reminder leaked before grading")
			}
		}
	}
	if d.Day != "2026-10-14" || d.Goal != 5 || len(d.Questions) != 5 {
		t.Fatalf("bad daily plan %+v", d)
	}
	second := call(t, a, "GET", "/v1/daily?exam=IMAT", "token-a", nil)
	if w.Body.String() != second.Body.String() {
		t.Fatal("daily plan changed")
	}
	if call(t, a, "GET", "/v1/daily?exam=INVALID", "token-a", nil).Code != 400 {
		t.Fatal("unknown exam accepted")
	}
}
func TestGradeIdempotencyMistakeAndReflection(t *testing.T) {
	a, _ := fixture(t)
	in := Submission{RequestID: "request-00000001", QuestionID: "imat-cell-01", OptionID: "A", Confidence: 3, DurationSeconds: 20}
	w := call(t, a, "POST", "/v1/attempts", "token-a", in)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	attempt := read[Attempt](t, w)
	if attempt.Correct || attempt.Misconception == "" || len(attempt.AffectedOutcomes) != 1 {
		t.Fatal("missing mistake diagnosis")
	}
	w = call(t, a, "POST", "/v1/attempts", "token-a", in)
	if read[Attempt](t, w).ID != attempt.ID {
		t.Fatal("retry created another attempt")
	}
	in.OptionID = "B"
	if call(t, a, "POST", "/v1/attempts", "token-a", in).Code != 400 {
		t.Fatal("request ID reused for new answer")
	}
	in.RequestID = "request-00000002"
	if !read[Attempt](t, call(t, a, "POST", "/v1/attempts", "token-a", in)).Correct {
		t.Fatal("correct option failed")
	}
	m := read[[]Mistake](t, call(t, a, "GET", "/v1/mistakes?exam=IMAT", "token-a", nil))
	if len(m) != 1 || !m[0].Resolved {
		t.Fatal("later correct attempt did not resolve mistake")
	}
	p := read[Performance](t, call(t, a, "GET", "/v1/performance?exam=IMAT", "token-a", nil))
	if p.Attempts != 2 || p.Correct != 1 || p.Accuracy != 50 || p.Unresolved != 0 || p.Streak != 1 {
		t.Fatalf("bad metrics %+v", p)
	}
	for _, o := range p.Outcomes {
		if o.ID == "bio.cell" && (o.Attempts != 1 || o.Correct != 1) {
			t.Fatal("retries inflate outcome sample")
		}
	}
	w = call(t, a, "PATCH", "/v1/attempts/"+attempt.ID+"/reflection", "token-a", Reflection{Reason: "misread", Note: "Read every option"})
	if w.Code != 200 || read[Attempt](t, w).Reflection.Reason != "misread" {
		t.Fatal("reflection not saved")
	}
	if call(t, a, "PATCH", "/v1/attempts/"+attempt.ID+"/reflection", "token-a", Reflection{Reason: "invalid"}).Code != 400 {
		t.Fatal("invalid reflection reason accepted")
	}
}
func TestNumericValidationAndTolerance(t *testing.T) {
	a, _ := fixture(t)
	value := 0.5005
	in := Submission{RequestID: "numeric-00000001", QuestionID: "tolcf-electric-01", Value: &value, Confidence: 2}
	w := call(t, a, "POST", "/v1/attempts", "token-a", in)
	if w.Code != 200 || !read[Attempt](t, w).Correct {
		t.Fatal("numeric tolerance failed")
	}
	in.Value = nil
	in.RequestID = "numeric-00000002"
	if call(t, a, "POST", "/v1/attempts", "token-a", in).Code != 400 {
		t.Fatal("missing numeric answer accepted")
	}
	in.Value = &value
	in.OptionID = "A"
	if call(t, a, "POST", "/v1/attempts", "token-a", in).Code != 400 {
		t.Fatal("mixed answer types accepted")
	}
	value = 0.6
	in.OptionID = ""
	w = call(t, a, "POST", "/v1/attempts", "token-a", in)
	if w.Code != 200 || read[Attempt](t, w).Correct {
		t.Fatal("wrong number graded correct")
	}
}
func TestAccountIsolationAndInviteLifecycle(t *testing.T) {
	a, _ := fixture(t)
	if call(t, a, "GET", "/v1/performance?exam=IMAT", "", nil).Code != 401 {
		t.Fatal("unauthenticated access")
	}
	if call(t, a, "POST", "/v1/admin/students", "token-a", map[string]string{}).Code != 401 {
		t.Fatal("student is admin")
	}
	w := call(t, a, "POST", "/v1/admin/students", a.AdminToken, map[string]string{"student_id": "student-b", "name": "Student B", "timezone": "Europe/Istanbul"})
	if w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	code := read[map[string]string](t, w)["invite_code"]
	w = call(t, a, "POST", "/v1/enroll", "", map[string]string{"code": code})
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	token := read[struct {
		Token string `json:"token"`
	}](t, w).Token
	if call(t, a, "POST", "/v1/enroll", "", map[string]string{"code": code}).Code != 401 {
		t.Fatal("invite reused")
	}
	w = call(t, a, "POST", "/v1/attempts", "token-a", Submission{RequestID: "isolated-00000001", QuestionID: "imat-cell-01", OptionID: "A", Confidence: 1})
	attempt := read[Attempt](t, w)
	if call(t, a, "PATCH", "/v1/attempts/"+attempt.ID+"/reflection", token, Reflection{Reason: "guess"}).Code != 404 {
		t.Fatal("another student edited reflection")
	}
	if read[Performance](t, call(t, a, "GET", "/v1/performance?exam=IMAT", token, nil)).Attempts != 0 {
		t.Fatal("another student saw history")
	}
	if len(read[[]Mistake](t, call(t, a, "GET", "/v1/mistakes?exam=IMAT", token, nil))) != 0 {
		t.Fatal("another student saw mistakes")
	}
	call(t, a, "DELETE", "/v1/session", token, nil)
	if call(t, a, "GET", "/v1/me", token, nil).Code != 401 {
		t.Fatal("logged out token remains active")
	}
}
func TestRestartAndFailedWrite(t *testing.T) {
	a, _ := fixture(t)
	in := Submission{RequestID: "persisted-000001", QuestionID: "imat-cell-01", OptionID: "B", Confidence: 2}
	if call(t, a, "POST", "/v1/attempts", "token-a", in).Code != 200 {
		t.Fatal("submit failed")
	}
	reopened, err := OpenStore(a.Store.path)
	if err != nil {
		t.Fatal(err)
	}
	a.Store = reopened
	if read[Performance](t, call(t, a, "GET", "/v1/performance?exam=IMAT", "token-a", nil)).Attempts != 1 {
		t.Fatal("progress lost on restart")
	}
	oldPath := a.Store.path
	bad := filepath.Join(t.TempDir(), "file")
	if err = os.WriteFile(bad, []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	a.Store.path = filepath.Join(bad, "state.json")
	in.RequestID = "unsaved-00000001"
	if call(t, a, "POST", "/v1/attempts", "token-a", in).Code != 500 {
		t.Fatal("failed write acknowledged")
	}
	a.Store.path = oldPath
	if read[Performance](t, call(t, a, "GET", "/v1/performance?exam=IMAT", "token-a", nil)).Attempts != 1 {
		t.Fatal("failed write changed state")
	}
	if err = os.WriteFile(oldPath, []byte("{bad"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = OpenStore(oldPath); err == nil {
		t.Fatal("corrupt file accepted")
	}
}
func TestDailyCompletionAndOverdueReview(t *testing.T) {
	a, student := fixture(t)
	d := read[Daily](t, call(t, a, "GET", "/v1/daily?exam=IMAT", "token-a", nil))
	q, _ := a.Bank.Question(d.Questions[0].ID)
	in := Submission{RequestID: "daily-0000000001", QuestionID: q.ID, Confidence: 2, OptionID: q.Answer.OptionID, Value: q.Answer.Value}
	call(t, a, "POST", "/v1/attempts", "token-a", in)
	d = read[Daily](t, call(t, a, "GET", "/v1/daily?exam=IMAT", "token-a", nil))
	if d.Completed != 1 || len(d.Questions) != 4 {
		t.Fatal("daily completion failed")
	}
	// A deliberately overdue wrong answer is prioritised over unseen questions.
	err := a.Store.Transaction(func(s *State) error {
		_, err := a.Bank.submit(s, student, Submission{RequestID: "review-0000000001", QuestionID: "imat-cell-01", OptionID: "A", Confidence: 1}, a.now().AddDate(0, 0, -2))
		delete(s.Assignments, assignmentKey(student, "IMAT", a.now()))
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	d = read[Daily](t, call(t, a, "GET", "/v1/daily?exam=IMAT", "token-a", nil))
	if d.Questions[0].ID != "imat-cell-01" {
		t.Fatal("overdue mistake not prioritised")
	}
}
func TestConcurrentRetriesCountOnce(t *testing.T) {
	a, student := fixture(t)
	in := Submission{RequestID: "concurrent-00001", QuestionID: "imat-cell-01", OptionID: "B", Confidence: 2}
	var group sync.WaitGroup
	for i := 0; i < 10; i++ {
		group.Go(func() {
			err := a.Store.Transaction(func(s *State) error { _, err := a.Bank.submit(s, student, in, a.now()); return err })
			if err != nil {
				t.Error(err)
			}
		})
	}
	group.Wait()
	a.Store.Read(func(s State) {
		if len(s.Attempts) != 1 {
			t.Fatalf("concurrent retries created %d attempts", len(s.Attempts))
		}
	})
}
func TestRejectTrailingJSONAndOversize(t *testing.T) {
	a, _ := fixture(t)
	for _, payload := range []string{`{"code":"DEMO-STUDENT"} {"extra":true}`, `{"code":"` + strings.Repeat("x", 20000) + `"}`} {
		r := httptest.NewRequest(http.MethodPost, "/v1/enroll", strings.NewReader(payload))
		w := httptest.NewRecorder()
		a.Handler().ServeHTTP(w, r)
		if w.Code != 400 {
			t.Fatal("invalid payload accepted")
		}
	}
}
