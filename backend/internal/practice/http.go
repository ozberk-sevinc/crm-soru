package practice

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type API struct {
	Bank       Bank
	Store      *Store
	AdminToken string
	Demo       bool
	Now        func() time.Time
	limitsMu   sync.Mutex
	limits     map[string]limit
}
type limit struct {
	Count int
	Reset time.Time
}
type apiError struct {
	Status  int
	Message string
}

func (e apiError) Error() string { return e.Message }
func (a *API) now() time.Time {
	if a.Now != nil {
		return a.Now()
	}
	return time.Now().UTC()
}
func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, message string) {
	respond(w, status, map[string]string{"error": message})
}
func decode(w http.ResponseWriter, r *http.Request, out any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		return err
	}
	if d.Decode(new(any)) != io.EOF {
		return errors.New("expected one JSON object")
	}
	return nil
}
func (a *API) authenticated(r *http.Request) (Student, bool) {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if token == "" || token == r.Header.Get("Authorization") {
		return Student{}, false
	}
	var student Student
	ok := false
	a.Store.Read(func(s State) {
		session, exists := s.Sessions[hash(token)]
		if exists && session.ExpiresAt.After(a.now()) {
			student, ok = s.Students[session.StudentID]
		}
	})
	student.InviteHash = ""
	return student, ok
}
func (a *API) allowed(r *http.Request) bool {
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	key := host
	if r.Header.Get("Authorization") != "" {
		key = hash(r.Header.Get("Authorization"))
	}
	a.limitsMu.Lock()
	defer a.limitsMu.Unlock()
	if a.limits == nil {
		a.limits = map[string]limit{}
	}
	now := a.now()
	l := a.limits[key]
	if !l.Reset.After(now) {
		l = limit{Reset: now.Add(time.Minute)}
	}
	l.Count++
	a.limits[key] = l
	if len(a.limits) > 1000 {
		for k, v := range a.limits {
			if !v.Reset.After(now) {
				delete(a.limits, k)
			}
		}
	}
	return l.Count <= 120
}
func (a *API) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) { respond(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("POST /v1/admin/students", a.invite)
	mux.HandleFunc("POST /v1/enroll", a.enroll)
	mux.HandleFunc("/v1/", func(w http.ResponseWriter, r *http.Request) {
		student, ok := a.authenticated(r)
		if !ok {
			fail(w, 401, "Your session expired. Ask your consultancy for a new invite code.")
			return
		}
		exam := r.URL.Query().Get("exam")
		if (r.URL.Path == "/v1/daily" || r.URL.Path == "/v1/performance" || r.URL.Path == "/v1/mistakes") && !ValidExam(exam) {
			fail(w, 400, "Choose IMAT, TOLC-I or TOLC-F.")
			return
		}
		switch {
		case r.Method == "GET" && r.URL.Path == "/v1/me":
			respond(w, 200, student)
		case r.Method == "GET" && r.URL.Path == "/v1/daily":
			var result Daily
			err := a.Store.Transaction(func(s *State) error { result = a.Bank.daily(s, student, exam, a.now()); return nil })
			if err != nil {
				fail(w, 500, "Could not save today's plan. Retry.")
				return
			}
			respond(w, 200, result)
		case r.Method == "GET" && r.URL.Path == "/v1/performance":
			var result Performance
			a.Store.Read(func(s State) { result = a.Bank.performance(s, student, exam, a.now()) })
			respond(w, 200, result)
		case r.Method == "GET" && r.URL.Path == "/v1/mistakes":
			var result []Mistake
			a.Store.Read(func(s State) { result = mistakes(s, student.ID, exam) })
			respond(w, 200, result)
		case r.Method == "POST" && r.URL.Path == "/v1/attempts":
			a.attempt(w, r, student)
		case r.Method == "PATCH" && strings.HasPrefix(r.URL.Path, "/v1/attempts/") && strings.HasSuffix(r.URL.Path, "/reflection"):
			a.reflect(w, r, student)
		case r.Method == "DELETE" && r.URL.Path == "/v1/session":
			err := a.Store.Transaction(func(s *State) error {
				delete(s.Sessions, hash(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")))
				return nil
			})
			if err != nil {
				fail(w, 500, "Could not sign out. Retry.")
				return
			}
			respond(w, 200, map[string]bool{"ok": true})
		default:
			fail(w, 404, "Endpoint not found")
		}
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if !a.allowed(r) {
			w.Header().Set("Retry-After", "60")
			fail(w, 429, "Too many requests. Please wait a minute.")
			return
		}
		mux.ServeHTTP(w, r)
	})
}
func (a *API) invite(w http.ResponseWriter, r *http.Request) {
	provided := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if len(a.AdminToken) < 32 || subtle.ConstantTimeCompare([]byte(provided), []byte(a.AdminToken)) != 1 {
		fail(w, 401, "Admin authentication required")
		return
	}
	var in struct {
		StudentID string `json:"student_id"`
		Name      string `json:"name"`
		Timezone  string `json:"timezone"`
	}
	if decode(w, r, &in) != nil || len(in.StudentID) < 1 || len(in.StudentID) > 100 || len(strings.TrimSpace(in.Name)) < 1 || len(in.Name) > 100 {
		fail(w, 400, "student_id and name are required (maximum 100 characters)")
		return
	}
	if _, err := time.LoadLocation(in.Timezone); err != nil {
		fail(w, 400, "A valid IANA timezone is required")
		return
	}
	code, err := secret()
	if err != nil {
		fail(w, 500, "Could not create invite")
		return
	}
	err = a.Store.Transaction(func(s *State) error {
		student := Student{ID: in.StudentID, Name: strings.TrimSpace(in.Name), Timezone: in.Timezone, InviteHash: hash(code)}
		s.Students[in.StudentID] = student
		// Reissuing an invitation revokes the old device sessions for account recovery.
		for token, session := range s.Sessions {
			if session.StudentID == student.ID {
				delete(s.Sessions, token)
			}
		}
		return nil
	})
	if err != nil {
		fail(w, 500, "Could not save invite")
		return
	}
	respond(w, 201, map[string]string{"invite_code": code, "student_id": in.StudentID})
}
func (a *API) enroll(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Code string `json:"code"`
	}
	if decode(w, r, &in) != nil || len(in.Code) > 100 || in.Code == "" {
		fail(w, 400, "Enter your invite code")
		return
	}
	token, err := secret()
	if err != nil {
		fail(w, 500, "Could not create session")
		return
	}
	var student Student
	err = a.Store.Transaction(func(s *State) error {
		if a.Demo && in.Code == "DEMO-STUDENT" {
			id, e := secret()
			if e != nil {
				return e
			}
			student = Student{ID: id, Name: "Demo student", Timezone: "Europe/Rome"}
			s.Students[id] = student
		} else {
			found := false
			for id, candidate := range s.Students {
				if candidate.InviteHash != "" && candidate.InviteHash == hash(in.Code) {
					student = candidate
					student.InviteHash = ""
					s.Students[id] = student
					found = true
					break
				}
			}
			if !found {
				return apiError{401, "This invite code is invalid or already used."}
			}
		}
		for key, session := range s.Sessions {
			if !session.ExpiresAt.After(a.now()) {
				delete(s.Sessions, key)
			}
		}
		s.Sessions[hash(token)] = Session{StudentID: student.ID, ExpiresAt: a.now().AddDate(0, 0, 90)}
		return nil
	})
	if err != nil {
		var e apiError
		if errors.As(err, &e) {
			fail(w, e.Status, e.Message)
		} else {
			fail(w, 500, "Could not save session")
		}
		return
	}
	respond(w, 200, map[string]any{"token": token, "student": student})
}
func (a *API) attempt(w http.ResponseWriter, r *http.Request, student Student) {
	var in Submission
	if err := decode(w, r, &in); err != nil {
		fail(w, 400, "Invalid answer payload")
		return
	}
	var result Attempt
	err := a.Store.Transaction(func(s *State) error {
		var err error
		result, err = a.Bank.submit(s, student, in, a.now())
		if err != nil {
			return apiError{400, err.Error()}
		}
		return nil
	})
	if err != nil {
		var e apiError
		if errors.As(err, &e) {
			fail(w, e.Status, e.Message)
		} else {
			fail(w, 500, "Answer was not saved. Retry the same submission.")
		}
		return
	}
	respond(w, 200, result)
}
func (a *API) reflect(w http.ResponseWriter, r *http.Request, student Student) {
	id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/v1/attempts/"), "/reflection")
	var in Reflection
	if decode(w, r, &in) != nil || len(in.Note) > 1000 {
		fail(w, 400, "Reflection notes must be under 1000 characters")
		return
	}
	valid := false
	for _, reason := range []string{"knowledge_gap", "misread", "calculation", "time_pressure", "guess", ""} {
		if in.Reason == reason {
			valid = true
		}
	}
	if !valid {
		fail(w, 400, "Unknown mistake reason")
		return
	}
	var result Attempt
	err := a.Store.Transaction(func(s *State) error {
		for i, a := range s.Attempts {
			if a.ID == id && a.StudentID == student.ID {
				s.Attempts[i].Reflection = in
				result = s.Attempts[i]
				return nil
			}
		}
		return apiError{404, "Attempt not found"}
	})
	if err != nil {
		var e apiError
		if errors.As(err, &e) {
			fail(w, e.Status, e.Message)
		} else {
			fail(w, 500, "Could not save reflection. Retry.")
		}
		return
	}
	respond(w, 200, result)
}
