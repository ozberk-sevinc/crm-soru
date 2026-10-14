package practice

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
)

func LoadBank(path string) (Bank, error) {
	f, err := os.Open(path)
	if err != nil {
		return Bank{}, err
	}
	defer f.Close()
	var b Bank
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	if err = d.Decode(&b); err != nil {
		return b, err
	}
	if d.Decode(new(any)) != io.EOF {
		return b, fmt.Errorf("bank must contain one JSON object")
	}
	return b, b.Validate()
}
func (b Bank) Validate() error {
	if b.Version != 1 || len(b.Questions) == 0 {
		return fmt.Errorf("version 1 and questions are required")
	}
	outcomes := map[string]bool{}
	for _, o := range b.Outcomes {
		if o.ID == "" || outcomes[o.ID] || o.Title == "" || o.Subject == "" || o.Remember == "" {
			return fmt.Errorf("invalid or duplicate outcome %q", o.ID)
		}
		outcomes[o.ID] = true
	}
	ids := map[string]bool{}
	for _, q := range b.Questions {
		if q.ID == "" || ids[q.ID] || !ValidExam(q.Exam) || q.Prompt == "" || q.Subject == "" || q.Explanation == "" || len(q.OutcomeIDs) == 0 {
			return fmt.Errorf("invalid question %q", q.ID)
		}
		ids[q.ID] = true
		if q.Difficulty != "easy" && q.Difficulty != "medium" && q.Difficulty != "hard" {
			return fmt.Errorf("invalid difficulty for %s", q.ID)
		}
		seen := map[string]bool{}
		for _, id := range q.OutcomeIDs {
			if !outcomes[id] || seen[id] {
				return fmt.Errorf("invalid outcome %q on %s", id, q.ID)
			}
			seen[id] = true
		}
		if q.Type == "single_choice" {
			options := map[string]bool{}
			if len(q.Options) < 2 || q.Answer.Value != nil || q.Answer.Tolerance != 0 {
				return fmt.Errorf("invalid choice question %s", q.ID)
			}
			for _, o := range q.Options {
				if o.ID == "" || options[o.ID] || o.Text == "" {
					return fmt.Errorf("invalid option on %s", q.ID)
				}
				options[o.ID] = true
				for _, id := range o.OutcomeIDs {
					if !seen[id] {
						return fmt.Errorf("option outcome must belong to question %s", q.ID)
					}
				}
			}
			if !options[q.Answer.OptionID] {
				return fmt.Errorf("answer not in options on %s", q.ID)
			}
		} else if q.Type == "numeric" {
			if len(q.Options) != 0 || q.Answer.OptionID != "" || q.Answer.Value == nil || math.IsNaN(*q.Answer.Value) || math.IsInf(*q.Answer.Value, 0) || q.Answer.Tolerance < 0 {
				return fmt.Errorf("invalid numeric answer on %s", q.ID)
			}
		} else {
			return fmt.Errorf("unsupported question type %q", q.Type)
		}
	}
	return nil
}
func ValidExam(exam string) bool { return exam == "IMAT" || exam == "TOLC-I" || exam == "TOLC-F" }
func (b Bank) Question(id string) (Question, bool) {
	for _, q := range b.Questions {
		if q.ID == id {
			return q, true
		}
	}
	return Question{}, false
}
func (b Bank) Resolve(ids []string) []Outcome {
	result := []Outcome{}
	for _, id := range ids {
		for _, o := range b.Outcomes {
			if id == o.ID {
				result = append(result, o)
			}
		}
	}
	return result
}
func (b Bank) Public(q Question) PublicQuestion {
	options := []PublicOption{}
	for _, o := range q.Options {
		options = append(options, PublicOption{ID: o.ID, Text: o.Text})
	}
	outcomes := b.Resolve(q.OutcomeIDs)
	// Remember text can itself contain the answer: disclose it only after grading.
	for i := range outcomes {
		outcomes[i].Remember = ""
	}
	return PublicQuestion{ID: q.ID, Exam: q.Exam, Type: q.Type, Subject: q.Subject, Prompt: q.Prompt, Options: options, Outcomes: outcomes, Difficulty: q.Difficulty}
}
