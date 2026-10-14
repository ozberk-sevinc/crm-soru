package practice

import (
	"fmt"
	"math"
	"sort"
	"time"
)

func day(at time.Time, zone string) string {
	loc, err := time.LoadLocation(zone)
	if err != nil {
		loc = time.UTC
	}
	return at.In(loc).Format("2006-01-02")
}
func assignmentKey(student Student, exam string, at time.Time) string {
	return student.ID + "/" + exam + "/" + day(at, student.Timezone)
}
func latestAttempts(s State, studentID, exam string) map[string]Attempt {
	latest := map[string]Attempt{}
	for _, a := range s.Attempts {
		if a.StudentID == studentID && (exam == "" || a.Question.Exam == exam) {
			latest[a.QuestionID] = a
		}
	}
	return latest
}
func (b Bank) daily(s *State, student Student, exam string, now time.Time) Daily {
	key := assignmentKey(student, exam, now)
	ids, ok := s.Assignments[key]
	if !ok {
		latest := latestAttempts(*s, student.ID, exam)
		questions := []Question{}
		for _, q := range b.Questions {
			if q.Exam == exam {
				questions = append(questions, q)
			}
		}
		priority := func(q Question) int {
			a, seen := latest[q.ID]
			if seen && !a.Correct && !a.ReviewAt.After(now) {
				return 0
			}
			if !seen {
				return 1
			}
			if !a.ReviewAt.After(now) {
				return 2
			}
			return 3
		}
		sort.SliceStable(questions, func(i, j int) bool {
			pi, pj := priority(questions[i]), priority(questions[j])
			if pi != pj {
				return pi < pj
			}
			return hash(key+questions[i].ID) < hash(key+questions[j].ID)
		})
		ids = []string{}
		for _, q := range questions {
			if len(ids) < 5 {
				ids = append(ids, q.ID)
			}
		}
		s.Assignments[key] = ids
	}
	result := Daily{Day: day(now, student.Timezone), Exam: exam, Goal: len(ids), Questions: []PublicQuestion{}}
	done := map[string]bool{}
	for _, a := range s.Attempts {
		if a.StudentID == student.ID && a.Day == result.Day {
			done[a.QuestionID] = true
		}
	}
	for _, id := range ids {
		if done[id] {
			result.Completed++
		}
		if q, ok := b.Question(id); ok && !done[id] {
			result.Questions = append(result.Questions, b.Public(q))
		}
	}
	return result
}
func (b Bank) submit(s *State, student Student, in Submission, now time.Time) (Attempt, error) {
	if len(in.RequestID) < 16 || len(in.RequestID) > 100 {
		return Attempt{}, fmt.Errorf("request_id must be 16–100 characters")
	}
	for _, a := range s.Attempts {
		if a.StudentID == student.ID && a.RequestID == in.RequestID {
			av, bv := a.Value, in.Value
			sameValue := av == nil && bv == nil || av != nil && bv != nil && *av == *bv
			if a.QuestionID != in.QuestionID || a.OptionID != in.OptionID || !sameValue || a.Confidence != in.Confidence || a.DurationSeconds != in.DurationSeconds {
				return Attempt{}, fmt.Errorf("request_id already used for a different submission")
			}
			return a, nil
		}
	}
	q, ok := b.Question(in.QuestionID)
	if !ok {
		return Attempt{}, fmt.Errorf("unknown question")
	}
	if in.Confidence < 1 || in.Confidence > 3 || in.DurationSeconds < 0 || in.DurationSeconds > 86400 {
		return Attempt{}, fmt.Errorf("invalid confidence or duration")
	}
	correct := false
	misconception := ""
	affected := q.OutcomeIDs
	if q.Type == "single_choice" {
		if in.Value != nil {
			return Attempt{}, fmt.Errorf("numeric value not allowed for a choice question")
		}
		found := false
		for _, o := range q.Options {
			if o.ID == in.OptionID {
				found = true
				correct = o.ID == q.Answer.OptionID
				if !correct {
					misconception = o.Misconception
					if len(o.OutcomeIDs) > 0 {
						affected = o.OutcomeIDs
					}
				}
			}
		}
		if !found {
			return Attempt{}, fmt.Errorf("select one valid option")
		}
	} else {
		if in.OptionID != "" || in.Value == nil || math.IsNaN(*in.Value) || math.IsInf(*in.Value, 0) {
			return Attempt{}, fmt.Errorf("enter a finite numeric answer")
		}
		correct = math.Abs(*in.Value-*q.Answer.Value) <= q.Answer.Tolerance
	}
	if !correct && misconception == "" {
		misconception = "Review the method in the explanation and tell us what made this question difficult."
	}
	id, err := secret()
	if err != nil {
		return Attempt{}, err
	}
	interval := 1
	if correct {
		consecutive := 0
		for i := len(s.Attempts) - 1; i >= 0; i-- {
			a := s.Attempts[i]
			if a.StudentID == student.ID && a.QuestionID == q.ID {
				if !a.Correct {
					break
				}
				consecutive++
			}
		}
		intervals := []int{1, 3, 7, 14}
		if consecutive > 3 {
			consecutive = 3
		}
		interval = intervals[consecutive]
	}
	snapshot := b.Public(q)
	snapshot.Outcomes = b.Resolve(q.OutcomeIDs)
	a := Attempt{ID: id, StudentID: student.ID, Submission: in, Correct: correct, At: now, Day: day(now, student.Timezone), Question: snapshot, CorrectAnswer: q.Answer, Explanation: q.Explanation, Misconception: misconception, AffectedOutcomes: b.Resolve(affected), ReviewAt: now.AddDate(0, 0, interval)}
	s.Attempts = append(s.Attempts, a)
	return a, nil
}
func mistakes(s State, studentID, exam string) []Mistake {
	latest := latestAttempts(s, studentID, exam)
	lastWrong := map[string]Attempt{}
	for _, a := range s.Attempts {
		if a.StudentID == studentID && a.Question.Exam == exam && !a.Correct {
			lastWrong[a.QuestionID] = a
		}
	}
	result := []Mistake{}
	for id, a := range lastWrong {
		result = append(result, Mistake{Attempt: a, Resolved: latest[id].Correct})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Resolved != result[j].Resolved {
			return !result[i].Resolved
		}
		return result[i].At.After(result[j].At)
	})
	return result
}
func percent(correct, total int) int {
	if total == 0 {
		return 0
	}
	return int(math.Round(100 * float64(correct) / float64(total)))
}
func (b Bank) performance(s State, student Student, exam string, now time.Time) Performance {
	p := Performance{Outcomes: []OutcomeStat{}, Week: []DayStat{}}
	days := map[string]DayStat{}
	totalSeconds := 0
	for _, a := range s.Attempts {
		if a.StudentID != student.ID || a.Question.Exam != exam {
			continue
		}
		p.Attempts++
		totalSeconds += a.DurationSeconds
		if a.Correct {
			p.Correct++
		}
		d := day(a.At, student.Timezone)
		stat := days[d]
		stat.Day = d
		stat.Attempts++
		if a.Correct {
			stat.Correct++
		}
		days[d] = stat
	}
	p.Accuracy = percent(p.Correct, p.Attempts)
	if p.Attempts > 0 {
		p.AverageSeconds = totalSeconds / p.Attempts
	}
	latest := latestAttempts(s, student.ID, exam)
	stats := map[string]OutcomeStat{}
	for _, q := range b.Questions {
		if q.Exam == exam {
			for _, o := range b.Resolve(q.OutcomeIDs) {
				stats[o.ID] = OutcomeStat{Outcome: o}
			}
		}
	}
	for _, a := range latest {
		if !a.Correct {
			p.Unresolved++
		}
		for _, o := range a.Question.Outcomes {
			stat := stats[o.ID]
			stat.Outcome = o
			stat.Attempts++
			if a.Correct {
				stat.Correct++
			}
			stat.Accuracy = percent(stat.Correct, stat.Attempts)
			stats[o.ID] = stat
		}
	}
	for _, stat := range stats {
		p.Outcomes = append(p.Outcomes, stat)
	}
	sort.Slice(p.Outcomes, func(i, j int) bool {
		a, c := p.Outcomes[i], p.Outcomes[j]
		if (a.Attempts > 0) != (c.Attempts > 0) {
			return a.Attempts > 0
		}
		if a.Accuracy != c.Accuracy {
			return a.Accuracy < c.Accuracy
		}
		return a.ID < c.ID
	})
	loc, _ := time.LoadLocation(student.Timezone)
	if loc == nil {
		loc = time.UTC
	}
	today := now.In(loc)
	for i := 6; i >= 0; i-- {
		d := today.AddDate(0, 0, -i).Format("2006-01-02")
		stat := days[d]
		stat.Day = d
		p.Week = append(p.Week, stat)
	}
	start := today
	if days[start.Format("2006-01-02")].Attempts == 0 {
		start = start.AddDate(0, 0, -1)
	}
	for i := 0; ; i++ {
		if days[start.AddDate(0, 0, -i).Format("2006-01-02")].Attempts == 0 {
			break
		}
		p.Streak++
	}
	return p
}
