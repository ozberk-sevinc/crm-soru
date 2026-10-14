package practice

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"google.golang.org/api/idtoken"
)

type GoogleIdentity struct {
	Subject, Email, Name string
	EmailAuthoritative   bool
}
type GoogleVerifier func(context.Context, string) (GoogleIdentity, error)

// Google's validator checks cryptographic signatures, expiry and key rotation.
// Additional issuer/audience/email checks are required for this app's accounts.
func NewGoogleVerifier(clientIDs []string) (GoogleVerifier, error) {
	allowed := map[string]bool{}
	for _, id := range clientIDs {
		if id = strings.TrimSpace(id); id != "" {
			allowed[id] = true
		}
	}
	if len(allowed) == 0 {
		return nil, nil
	}
	validator, err := idtoken.NewValidator(context.Background(), idtoken.WithHTTPClient(&http.Client{Timeout: 10 * time.Second}))
	if err != nil {
		return nil, err
	}
	return func(ctx context.Context, token string) (GoogleIdentity, error) {
		payload, err := validator.Validate(ctx, token, "")
		if err != nil {
			return GoogleIdentity{}, err
		}
		return googleClaims(payload, allowed, time.Now())
	}, nil
}
func googleClaims(p *idtoken.Payload, allowed map[string]bool, now time.Time) (GoogleIdentity, error) {
	if p == nil || !allowed[p.Audience] || (p.Issuer != "https://accounts.google.com" && p.Issuer != "accounts.google.com") || p.Subject == "" || p.Expires <= now.Unix() || p.IssuedAt > now.Add(time.Minute).Unix() {
		return GoogleIdentity{}, errors.New("invalid Google identity claims")
	}
	verified, _ := p.Claims["email_verified"].(bool)
	email, _ := p.Claims["email"].(string)
	name, _ := p.Claims["name"].(string)
	hd, _ := p.Claims["hd"].(string)
	if !verified || email == "" || len(email) > 254 || len(p.Subject) > 255 {
		return GoogleIdentity{}, errors.New("verified Google email is required")
	}
	if name == "" {
		name = strings.Split(email, "@")[0]
	}
	if len(name) > 100 {
		name = "Google student"
	}
	email = strings.ToLower(strings.TrimSpace(email))
	return GoogleIdentity{Subject: p.Subject, Email: email, Name: name, EmailAuthoritative: strings.HasSuffix(email, "@gmail.com") || hd != ""}, nil
}
func (a *API) roleFor(student Student) string {
	if student.GoogleSubject != "" && (a.GoogleAdminSubjects[student.GoogleSubject] || student.GoogleEmailAuthoritative && a.GoogleAdminEmails[strings.ToLower(student.Email)]) {
		return "admin"
	}
	return "student"
}
func (a *API) publicStudent(student Student) Student {
	student.Role = a.roleFor(student)
	student.InviteHash = ""
	student.GoogleSubject = ""
	student.GoogleEmailAuthoritative = false
	return student
}
func (a *API) googleLogin(w http.ResponseWriter, r *http.Request) {
	if a.VerifyGoogle == nil {
		fail(w, 503, "Google sign-in has not been configured by your consultancy yet.")
		return
	}
	var in struct {
		IDToken    string `json:"id_token"`
		InviteCode string `json:"invite_code,omitempty"`
		Timezone   string `json:"timezone"`
	}
	if decode(w, r, &in) != nil || in.IDToken == "" || len(in.IDToken) > 12000 || len(in.InviteCode) > 100 {
		fail(w, 400, "Invalid Google sign-in request")
		return
	}
	if _, err := time.LoadLocation(in.Timezone); err != nil {
		fail(w, 400, "A valid account timezone is required")
		return
	}
	identity, err := a.VerifyGoogle(r.Context(), in.IDToken)
	if err != nil {
		fail(w, 401, "Google identity could not be verified. Please sign in again.")
		return
	}
	token, err := secret()
	if err != nil {
		fail(w, 500, "Could not create session")
		return
	}
	var student Student
	err = a.Store.Transaction(func(s *State) error {
		found := false
		for _, existing := range s.Students {
			if existing.GoogleSubject == identity.Subject {
				student = existing
				found = true
				break
			}
		}
		if in.InviteCode != "" {
			var invited Student
			valid := false
			for _, candidate := range s.Students {
				if candidate.InviteHash != "" && candidate.InviteHash == hash(in.InviteCode) {
					invited = candidate
					valid = true
					break
				}
			}
			if !valid {
				return apiError{401, "This invite code is invalid or already used."}
			}
			if invited.GoogleSubject != "" && invited.GoogleSubject != identity.Subject || found && invited.ID != student.ID {
				return apiError{409, "This invitation belongs to an account already linked to another Google identity. Ask your consultancy to recover it."}
			}
			student = invited
			student.InviteHash = ""
			found = true
		}
		if !found {
			student = Student{ID: "google-" + hash(identity.Subject), Name: identity.Name, Timezone: in.Timezone}
		}
		student.GoogleSubject = identity.Subject
		student.Email = identity.Email
		student.GoogleEmailAuthoritative = identity.EmailAuthoritative
		student.Role = a.roleFor(student)
		s.Students[student.ID] = student
		for key, session := range s.Sessions {
			if !session.ExpiresAt.After(a.now()) {
				delete(s.Sessions, key)
			}
		}
		s.Sessions[hash(token)] = Session{StudentID: student.ID, ExpiresAt: a.now().AddDate(0, 0, 90)}
		return nil
	})
	if err != nil {
		a.operationError(w, err, "Could not save Google session")
		return
	}
	respond(w, 200, map[string]any{"token": token, "student": a.publicStudent(student)})
}
func (a *API) operationError(w http.ResponseWriter, err error, fallback string) {
	var e apiError
	if errors.As(err, &e) {
		fail(w, e.Status, e.Message)
	} else {
		fail(w, 500, fallback)
	}
}
