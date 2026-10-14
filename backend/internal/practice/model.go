package practice

import "time"

type Outcome struct {
	ID       string `json:"id"`
	Subject  string `json:"subject"`
	Title    string `json:"title"`
	Remember string `json:"remember"`
}
type Option struct {
	ID            string   `json:"id"`
	Text          string   `json:"text"`
	Misconception string   `json:"misconception,omitempty"`
	OutcomeIDs    []string `json:"outcome_ids,omitempty"`
}
type Answer struct {
	OptionID  string   `json:"option_id,omitempty"`
	Value     *float64 `json:"value,omitempty"`
	Tolerance float64  `json:"tolerance,omitempty"`
}
type Question struct {
	ID          string   `json:"id"`
	Exam        string   `json:"exam"`
	Type        string   `json:"type"`
	Subject     string   `json:"subject"`
	Prompt      string   `json:"prompt"`
	Options     []Option `json:"options,omitempty"`
	Answer      Answer   `json:"answer"`
	Explanation string   `json:"explanation"`
	OutcomeIDs  []string `json:"outcome_ids"`
	Difficulty  string   `json:"difficulty"`
}
type PublicOption struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}
type PublicQuestion struct {
	ID         string         `json:"id"`
	Exam       string         `json:"exam"`
	Type       string         `json:"type"`
	Subject    string         `json:"subject"`
	Prompt     string         `json:"prompt"`
	Options    []PublicOption `json:"options"`
	Outcomes   []Outcome      `json:"outcomes"`
	Difficulty string         `json:"difficulty"`
}
type Bank struct {
	Version   int        `json:"version"`
	Outcomes  []Outcome  `json:"outcomes"`
	Questions []Question `json:"questions"`
}
type Student struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Timezone   string `json:"timezone"`
	InviteHash string `json:"invite_hash,omitempty"`
}
type Session struct {
	StudentID string    `json:"student_id"`
	ExpiresAt time.Time `json:"expires_at"`
}
type Reflection struct {
	Reason string `json:"reason"`
	Note   string `json:"note"`
}
type Submission struct {
	RequestID       string   `json:"request_id"`
	QuestionID      string   `json:"question_id"`
	OptionID        string   `json:"option_id,omitempty"`
	Value           *float64 `json:"value,omitempty"`
	Confidence      int      `json:"confidence"`
	DurationSeconds int      `json:"duration_seconds"`
}
type Attempt struct {
	ID        string `json:"id"`
	StudentID string `json:"student_id"`
	Submission
	Correct          bool           `json:"correct"`
	At               time.Time      `json:"at"`
	Day              string         `json:"day"`
	Question         PublicQuestion `json:"question"`
	CorrectAnswer    Answer         `json:"correct_answer"`
	Explanation      string         `json:"explanation"`
	Misconception    string         `json:"misconception"`
	AffectedOutcomes []Outcome      `json:"affected_outcomes"`
	Reflection       Reflection     `json:"reflection"`
	ReviewAt         time.Time      `json:"review_at"`
}
type Daily struct {
	Day       string           `json:"day"`
	Exam      string           `json:"exam"`
	Goal      int              `json:"goal"`
	Completed int              `json:"completed"`
	Questions []PublicQuestion `json:"questions"`
}
type OutcomeStat struct {
	Outcome
	Attempts int `json:"attempts"`
	Correct  int `json:"correct"`
	Accuracy int `json:"accuracy"`
}
type DayStat struct {
	Day      string `json:"day"`
	Attempts int    `json:"attempts"`
	Correct  int    `json:"correct"`
}
type Performance struct {
	Attempts       int           `json:"attempts"`
	Correct        int           `json:"correct"`
	Accuracy       int           `json:"accuracy"`
	Streak         int           `json:"streak"`
	Unresolved     int           `json:"unresolved"`
	AverageSeconds int           `json:"average_seconds"`
	Outcomes       []OutcomeStat `json:"outcomes"`
	Week           []DayStat     `json:"week"`
}
type Mistake struct {
	Attempt
	Resolved bool `json:"resolved"`
}
