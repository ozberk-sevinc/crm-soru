package practice

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type State struct {
	Students    map[string]Student        `json:"students"`
	Sessions    map[string]Session        `json:"sessions"`
	Attempts    []Attempt                 `json:"attempts"`
	Assignments map[string][]string       `json:"assignments"`
	Imports     map[string]QuestionImport `json:"imports"`
	Published   Bank                      `json:"published"`
}
type Store struct {
	mu    sync.Mutex
	path  string
	state State
}

func OpenStore(path string) (*Store, error) {
	s := &Store{path: path, state: State{Students: map[string]Student{}, Sessions: map[string]Session{}, Attempts: []Attempt{}, Assignments: map[string][]string{}, Imports: map[string]QuestionImport{}, Published: Bank{Version: 1, Outcomes: []Outcome{}, Questions: []Question{}}}}
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(b, &s.state); err != nil {
		return nil, fmt.Errorf("refusing corrupt state: %w", err)
	}
	if s.state.Students == nil || s.state.Sessions == nil || s.state.Assignments == nil || s.state.Attempts == nil {
		return nil, fmt.Errorf("incomplete state file")
	}
	// Migrate progress files created before uploads/Google login were introduced.
	if s.state.Imports == nil {
		s.state.Imports = map[string]QuestionImport{}
	}
	if s.state.Published.Version == 0 {
		s.state.Published = Bank{Version: 1, Outcomes: []Outcome{}, Questions: []Question{}}
	}
	return s, nil
}

// A transaction changes a private copy, writes atomically, then publishes it.
// Failed disk writes never acknowledge or retain an unsaved attempt.
func (s *Store) Transaction(fn func(*State) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, err := json.Marshal(s.state)
	if err != nil {
		return err
	}
	var next State
	if err = json.Unmarshal(b, &next); err != nil {
		return err
	}
	if err = fn(&next); err != nil {
		return err
	}
	b, err = json.MarshalIndent(next, "", "  ")
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(s.path), 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(s.path), ".state-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if err = f.Chmod(0600); err == nil {
		_, err = f.Write(b)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if err = os.Rename(name, s.path); err != nil {
		return err
	}
	s.state = next
	return nil
}
func (s *Store) Read(fn func(State)) { s.mu.Lock(); defer s.mu.Unlock(); fn(s.state) }
func secret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
func hash(v string) string { h := sha256.Sum256([]byte(v)); return hex.EncodeToString(h[:]) }
