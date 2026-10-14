package practice

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path"
	"reflect"
	"sort"
	"strings"
	"time"
)

const MaxUploadBytes int64 = 8 * 1024 * 1024
const MaxExpandedBytes int64 = 16 * 1024 * 1024
const MaxJSONBytes int64 = 2 * 1024 * 1024
const MaxImportFiles = 100

type QuestionImport struct {
	ID           string     `json:"id"`
	RequestID    string     `json:"request_id"`
	Digest       string     `json:"digest"`
	UploaderID   string     `json:"uploader_id"`
	UploaderName string     `json:"uploader_name"`
	Title        string     `json:"title"`
	Source       string     `json:"source"`
	Files        []string   `json:"files"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
	ReviewedAt   *time.Time `json:"reviewed_at,omitempty"`
	ReviewedBy   string     `json:"reviewed_by,omitempty"`
	ReviewNote   string     `json:"review_note"`
	Bank         Bank       `json:"bank"`
}
type ImportSummary struct {
	ID            string     `json:"id"`
	Title         string     `json:"title"`
	Source        string     `json:"source"`
	Files         []string   `json:"files"`
	Status        string     `json:"status"`
	UploaderID    string     `json:"uploader_id"`
	UploaderName  string     `json:"uploader_name"`
	QuestionCount int        `json:"question_count"`
	OutcomeCount  int        `json:"outcome_count"`
	Exams         []string   `json:"exams"`
	CreatedAt     time.Time  `json:"created_at"`
	ReviewedAt    *time.Time `json:"reviewed_at,omitempty"`
	ReviewNote    string     `json:"review_note"`
}

func (in QuestionImport) summary() ImportSummary {
	exams := []string{}
	seen := map[string]bool{}
	for _, q := range in.Bank.Questions {
		if !seen[q.Exam] {
			seen[q.Exam] = true
			exams = append(exams, q.Exam)
		}
	}
	sort.Strings(exams)
	return ImportSummary{ID: in.ID, Title: in.Title, Source: in.Source, Files: in.Files, Status: in.Status, UploaderID: in.UploaderID, UploaderName: in.UploaderName, QuestionCount: len(in.Bank.Questions), OutcomeCount: len(in.Bank.Outcomes), Exams: exams, CreatedAt: in.CreatedAt, ReviewedAt: in.ReviewedAt, ReviewNote: in.ReviewNote}
}

// Nothing is extracted to disk. Reject unsafe paths even when just reading ZIP entries.
func safeImportPath(name string) bool {
	return name != "" && len(name) <= 240 && !strings.ContainsAny(name, "\\:\x00") && !strings.HasPrefix(name, "/") && path.Clean(name) == name && name != ".." && !strings.HasPrefix(name, "../") && len(strings.Split(name, "/")) <= 12
}
func decodeFragment(data []byte) (Bank, error) {
	var b Bank
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&b); err != nil {
		return b, err
	}
	if decoder.Decode(new(any)) != io.EOF {
		return b, fmt.Errorf("expected one JSON bank object")
	}
	if b.Version != 1 {
		return b, fmt.Errorf("each JSON file must have version 1")
	}
	return b, nil
}
func combineBanks(banks ...Bank) (Bank, error) {
	result := Bank{Version: 1, Outcomes: []Outcome{}, Questions: []Question{}}
	outcomes := map[string]Outcome{}
	questions := map[string]bool{}
	for _, bank := range banks {
		for _, o := range bank.Outcomes {
			if old, exists := outcomes[o.ID]; exists {
				if old != o {
					return result, fmt.Errorf("conflicting learning outcome %q", o.ID)
				}
				continue
			}
			outcomes[o.ID] = o
			result.Outcomes = append(result.Outcomes, o)
		}
		for _, q := range bank.Questions {
			if questions[q.ID] {
				return result, fmt.Errorf("question ID %q already exists; use a new unique ID", q.ID)
			}
			questions[q.ID] = true
			result.Questions = append(result.Questions, q)
		}
	}
	return result, nil
}
func (a *API) activeBank(s State) Bank {
	b, _ := combineBanks(a.Bank, s.Published)
	return b
}
func (a *API) ValidatePublished() error {
	var err error
	a.Store.Read(func(s State) {
		var b Bank
		b, err = combineBanks(a.Bank, s.Published)
		if err == nil {
			err = b.Validate()
		}
	})
	return err
}
func parseArchive(data []byte) (Bank, []string, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return Bank{}, nil, fmt.Errorf("invalid ZIP archive")
	}
	if len(reader.File) > MaxImportFiles*2 {
		return Bank{}, nil, fmt.Errorf("too many ZIP entries")
	}
	files := []string{}
	banks := []Bank{}
	seen := map[string]bool{}
	var expanded int64
	for _, file := range reader.File {
		name := file.Name
		if file.FileInfo().IsDir() {
			name = strings.TrimSuffix(name, "/")
		}
		if !safeImportPath(name) {
			return Bank{}, nil, fmt.Errorf("unsafe ZIP path %q", file.Name)
		}
		if file.FileInfo().IsDir() {
			continue
		}
		if !file.Mode().IsRegular() {
			return Bank{}, nil, fmt.Errorf("only regular JSON files are allowed")
		}
		if strings.HasPrefix(name, "__MACOSX/") || path.Base(name) == ".DS_Store" {
			continue
		}
		if !strings.EqualFold(path.Ext(name), ".json") {
			return Bank{}, nil, fmt.Errorf("only JSON question-bank files are supported: %s", name)
		}
		if seen[name] || len(files) >= MaxImportFiles {
			return Bank{}, nil, fmt.Errorf("duplicate filenames or too many files")
		}
		seen[name] = true
		if file.UncompressedSize64 > uint64(MaxJSONBytes) {
			return Bank{}, nil, fmt.Errorf("JSON file exceeds 2 MiB")
		}
		stream, e := file.Open()
		if e != nil {
			return Bank{}, nil, e
		}
		content, e := io.ReadAll(io.LimitReader(stream, MaxJSONBytes+1))
		closeErr := stream.Close()
		if e != nil || closeErr != nil || int64(len(content)) > MaxJSONBytes {
			return Bank{}, nil, fmt.Errorf("cannot read bounded ZIP content")
		}
		expanded += int64(len(content))
		if expanded > MaxExpandedBytes {
			return Bank{}, nil, fmt.Errorf("expanded content exceeds 16 MiB")
		}
		bank, e := decodeFragment(content)
		if e != nil {
			return Bank{}, nil, fmt.Errorf("%s: %w", name, e)
		}
		files = append(files, name)
		banks = append(banks, bank)
	}
	bank, err := combineBanks(banks...)
	if err != nil {
		return bank, nil, err
	}
	return bank, files, nil
}
func readUpload(w http.ResponseWriter, r *http.Request) (Bank, []string, string, string, string, error) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadBytes+256*1024)
	reader, err := r.MultipartReader()
	if err != nil {
		return Bank{}, nil, "", "", "", fmt.Errorf("use multipart/form-data")
	}
	files := []string{}
	fragments := []Bank{}
	source := "files"
	title := ""
	requestID := ""
	seen := map[string]bool{}
	var total int64
	for {
		part, e := reader.NextPart()
		if e == io.EOF {
			break
		}
		if e != nil {
			return Bank{}, nil, "", "", "", fmt.Errorf("invalid or oversized upload")
		}
		name := part.FormName()
		if part.FileName() == "" {
			content, e := io.ReadAll(io.LimitReader(part, 1025))
			if e != nil || len(content) > 1024 {
				return Bank{}, nil, "", "", "", fmt.Errorf("invalid metadata")
			}
			if name == "title" && title == "" {
				title = strings.TrimSpace(string(content))
			} else if name == "request_id" && requestID == "" {
				requestID = string(content)
			} else {
				return Bank{}, nil, "", "", "", fmt.Errorf("unexpected or duplicate metadata")
			}
			continue
		}
		if name != "files" {
			return Bank{}, nil, "", "", "", fmt.Errorf("file field must be named files")
		}
		// Read the original filename: preserve safe folder-relative paths, reject traversal.
		_, parameters, e := mime.ParseMediaType(part.Header.Get("Content-Disposition"))
		if e != nil {
			return Bank{}, nil, "", "", "", fmt.Errorf("invalid file metadata")
		}
		filename := parameters["filename"]
		if !safeImportPath(filename) || seen[filename] || len(files) >= MaxImportFiles {
			return Bank{}, nil, "", "", "", fmt.Errorf("unsafe/duplicate filenames or too many files")
		}
		seen[filename] = true
		content, e := io.ReadAll(io.LimitReader(part, MaxUploadBytes+1))
		if e != nil {
			return Bank{}, nil, "", "", "", fmt.Errorf("could not read upload")
		}
		total += int64(len(content))
		if total > MaxUploadBytes {
			return Bank{}, nil, "", "", "", fmt.Errorf("upload exceeds 8 MiB")
		}
		if strings.EqualFold(path.Ext(filename), ".zip") {
			if len(files) > 0 || len(fragments) > 0 {
				return Bank{}, nil, "", "", "", fmt.Errorf("upload one ZIP or a selection of JSON files")
			}
			bank, names, e := parseArchive(content)
			if e != nil {
				return Bank{}, nil, "", "", "", e
			}
			fragments = append(fragments, bank)
			files = names
			source = "zip"
		} else {
			if source == "zip" || !strings.EqualFold(path.Ext(filename), ".json") || int64(len(content)) > MaxJSONBytes {
				return Bank{}, nil, "", "", "", fmt.Errorf("select JSON files (2 MiB each) or one ZIP")
			}
			bank, e := decodeFragment(content)
			if e != nil {
				return Bank{}, nil, "", "", "", fmt.Errorf("%s: %w", filename, e)
			}
			fragments = append(fragments, bank)
			files = append(files, filename)
		}
	}
	bank, err := combineBanks(fragments...)
	if err != nil {
		return bank, nil, "", "", "", err
	}
	if len(bank.Questions) > 2000 || len(bank.Outcomes) > 500 {
		return bank, nil, "", "", "", fmt.Errorf("a package supports at most 2000 questions and 500 learning outcomes")
	}
	if err = bank.Validate(); err != nil {
		return bank, nil, "", "", "", err
	}
	if title == "" || len(title) > 120 || len(requestID) < 16 || len(requestID) > 100 {
		return bank, nil, "", "", "", fmt.Errorf("title (1–120 bytes) and request_id (16–100 characters) are required")
	}
	return bank, files, source, title, requestID, nil
}
func (a *API) uploadQuestions(w http.ResponseWriter, r *http.Request, student Student) {
	bank, files, source, title, requestID, err := readUpload(w, r)
	if err != nil {
		fail(w, 400, err.Error())
		return
	}
	canonical, _ := json.Marshal(bank)
	digest := hash(string(canonical))
	var result QuestionImport
	err = a.Store.Transaction(func(s *State) error {
		for _, existing := range s.Imports {
			if existing.UploaderID == student.ID && existing.RequestID == requestID {
				if existing.Digest != digest || existing.Title != title || existing.Source != source || !reflect.DeepEqual(existing.Files, files) {
					return apiError{409, "This upload request ID was already used for a different package"}
				}
				result = existing
				return nil
			}
		}
		pending := 0
		for _, existing := range s.Imports {
			if existing.UploaderID == student.ID && existing.Status == "pending" {
				pending++
			}
		}
		if pending >= 10 {
			return apiError{409, "You already have 10 pending packages. Wait for an admin review."}
		}
		id, e := secret()
		if e != nil {
			return e
		}
		result = QuestionImport{ID: id, RequestID: requestID, Digest: digest, UploaderID: student.ID, UploaderName: student.Name, Title: title, Source: source, Files: files, Status: "pending", CreatedAt: a.now(), Bank: bank}
		s.Imports[id] = result
		return nil
	})
	if err != nil {
		a.operationError(w, err, "Could not save the pending package. Retry the same upload.")
		return
	}
	respond(w, 201, result.summary())
}
func (a *API) listImports(w http.ResponseWriter, r *http.Request, student Student, admin bool) {
	result := []ImportSummary{}
	a.Store.Read(func(s State) {
		for _, in := range s.Imports {
			if admin || in.UploaderID == student.ID {
				result = append(result, in.summary())
			}
		}
	})
	sort.Slice(result, func(i, j int) bool { return result[i].CreatedAt.After(result[j].CreatedAt) })
	respond(w, 200, result)
}
func (a *API) adminImport(w http.ResponseWriter, r *http.Request, student Student) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/admin/imports/")
	if r.Method == "GET" {
		var result QuestionImport
		found := false
		a.Store.Read(func(s State) { result, found = s.Imports[id] })
		if !found {
			fail(w, 404, "Package not found")
			return
		}
		respond(w, 200, map[string]any{"summary": result.summary(), "bank": result.Bank})
		return
	}
	if r.Method != "POST" || !strings.HasSuffix(id, "/decision") {
		fail(w, 404, "Endpoint not found")
		return
	}
	id = strings.TrimSuffix(id, "/decision")
	var in struct {
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}
	if decode(w, r, &in) != nil || (in.Decision != "approved" && in.Decision != "rejected") || len(in.Note) > 1000 || in.Decision == "rejected" && strings.TrimSpace(in.Note) == "" {
		fail(w, 400, "Choose approved/rejected and provide a rejection reason (maximum 1000 bytes)")
		return
	}
	var result QuestionImport
	err := a.Store.Transaction(func(s *State) error {
		candidate, exists := s.Imports[id]
		if !exists {
			return apiError{404, "Package not found"}
		}
		if candidate.Status != "pending" {
			if candidate.Status == in.Decision && candidate.ReviewNote == strings.TrimSpace(in.Note) {
				result = candidate
				return nil
			}
			return apiError{409, "This package has already been reviewed"}
		}
		if in.Decision == "approved" {
			active, err := combineBanks(a.Bank, s.Published, candidate.Bank)
			if err != nil {
				return apiError{409, err.Error()}
			}
			if err = active.Validate(); err != nil {
				return apiError{409, err.Error()}
			}
			published, err := combineBanks(s.Published, candidate.Bank)
			if err != nil {
				return err
			}
			s.Published = published
		}
		now := a.now()
		candidate.Status = in.Decision
		candidate.ReviewNote = strings.TrimSpace(in.Note)
		candidate.ReviewedAt = &now
		candidate.ReviewedBy = student.ID
		s.Imports[id] = candidate
		result = candidate
		return nil
	})
	if err != nil {
		a.operationError(w, err, "Could not save review. No questions were published.")
		return
	}
	respond(w, 200, result.summary())
}
