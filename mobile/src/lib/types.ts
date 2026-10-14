export type Exam = "IMAT" | "TOLC-I" | "TOLC-F";
export type MistakeReason =
  "" | "knowledge_gap" | "misread" | "calculation" | "time_pressure" | "guess";
export interface Student {
  id: string;
  name: string;
  timezone: string;
  email?: string;
  role: "student" | "admin";
}
export interface Outcome {
  id: string;
  subject: string;
  title: string;
  remember: string;
}
export interface Option {
  id: string;
  text: string;
}
export interface Question {
  id: string;
  exam: Exam;
  type: "single_choice" | "numeric";
  subject: string;
  prompt: string;
  options: Option[];
  outcomes: Outcome[];
  difficulty: string;
}
export interface Submission {
  request_id: string;
  question_id: string;
  option_id?: string;
  value?: number;
  confidence: number;
  duration_seconds: number;
}
export interface Reflection {
  reason: MistakeReason;
  note: string;
}
export interface Attempt extends Submission {
  id: string;
  student_id: string;
  correct: boolean;
  at: string;
  day: string;
  question: Question;
  correct_answer: { option_id?: string; value?: number; tolerance?: number };
  explanation: string;
  misconception: string;
  affected_outcomes: Outcome[];
  reflection: Reflection;
  review_at: string;
}
export interface Mistake extends Attempt {
  resolved: boolean;
}
export interface Daily {
  day: string;
  exam: Exam;
  goal: number;
  completed: number;
  questions: Question[];
}
export interface OutcomeStat extends Outcome {
  attempts: number;
  correct: number;
  accuracy: number;
}
export interface DayStat {
  day: string;
  attempts: number;
  correct: number;
}
export interface Performance {
  attempts: number;
  correct: number;
  accuracy: number;
  streak: number;
  unresolved: number;
  average_seconds: number;
  outcomes: OutcomeStat[];
  week: DayStat[];
}
export const reasons: { id: MistakeReason; title: string }[] = [
  { id: "knowledge_gap", title: "I didn’t know the concept" },
  { id: "misread", title: "I misread the question" },
  { id: "calculation", title: "I made a calculation error" },
  { id: "time_pressure", title: "I felt rushed" },
  { id: "guess", title: "I guessed" },
];

export interface ImportSummary {
  id: string;
  title: string;
  source: string;
  files: string[];
  status: "pending" | "approved" | "rejected";
  uploader_id: string;
  uploader_name: string;
  question_count: number;
  outcome_count: number;
  exams: string[];
  created_at: string;
  reviewed_at?: string;
  review_note: string;
}
export interface BankQuestion extends Omit<Question, "outcomes" | "options"> {
  options?: (Option & { misconception?: string; outcome_ids?: string[] })[];
  answer: { option_id?: string; value?: number; tolerance?: number };
  outcome_ids: string[];
  explanation: string;
}
export interface QuestionBank {
  version: number;
  outcomes: Outcome[];
  questions: BankQuestion[];
}
export interface ImportDetail {
  summary: ImportSummary;
  bank: QuestionBank;
}
