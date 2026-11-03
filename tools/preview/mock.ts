import bank from "../../backend/data/questions.json";
export const student = {
  id: "preview-student",
  name: "Deniz",
  timezone: "Europe/Rome",
  role: "admin",
  email: "deniz@example.com",
};
export const publicQuestion = (q: any) => ({
  ...q,
  options: q.options ?? [],
  outcomes: bank.outcomes.filter((o) => q.outcome_ids.includes(o.id)),
});
export const questions = bank.questions.map(publicQuestion);
export const attempts: any[] = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 3, 4, 6, 7].map(
  (n, i) => {
    const q: any = bank.questions[n];
    const correct = ![0, 2, 5, 8].includes(i);
    const option = correct
      ? q.answer.option_id
      : q.options?.find((o) => o.id !== q.answer.option_id)?.id;
    return {
      id: "attempt-" + i,
      student_id: student.id,
      request_id: "request-" + i,
      question_id: q.id,
      option_id: option,
      value: q.answer.value,
      confidence: correct ? 3 : 2,
      duration_seconds: 24 + i,
      correct,
      at: `2026-11-${String(1 + Math.floor(i / 4)).padStart(2, "0")}T15:00:00Z`,
      day: "2026-11-03",
      question: publicQuestion(q),
      correct_answer: q.answer,
      explanation: q.explanation,
      misconception: correct
        ? ""
        : (q.options?.find((o) => o.id === option)?.misconception ??
          "Review the method in the explanation."),
      affected_outcomes: bank.outcomes.filter((o) =>
        q.outcome_ids.includes(o.id),
      ),
      reflection: {
        reason: correct ? "" : "knowledge_gap",
        note: correct ? "" : "Check the rule before choosing an answer.",
      },
      review_at: "2026-11-04T15:00:00Z",
    };
  },
);
export function makeAttempt(answer: any) {
  const q: any = bank.questions.find((q) => q.id === answer.question_id);
  const correct =
    q.type === "numeric"
      ? Math.abs(answer.value - q.answer.value) <= (q.answer.tolerance ?? 0)
      : answer.option_id === q.answer.option_id;
  const a = {
    ...attempts[0],
    ...answer,
    id: "preview-" + Date.now(),
    question: publicQuestion(q),
    correct_answer: q.answer,
    correct,
    explanation: q.explanation,
    affected_outcomes: bank.outcomes.filter((o) =>
      q.outcome_ids.includes(o.id),
    ),
    misconception: correct
      ? ""
      : (q.options?.find((o) => o.id === answer.option_id)?.misconception ??
        "Review the method in the explanation."),
    reflection: { reason: "", note: "" },
  };
  attempts.push(a);
  return a;
}
export const exampleBank = {
  version: 1,
  outcomes: [bank.outcomes[0]],
  questions: [{ ...bank.questions[0], id: "import-demo-cell-01" }],
};
let packages: any[] = [
  {
    id: "demo-package",
    title: "IMAT Biology · Cell organelles",
    source: "zip",
    files: ["outcomes.json", "questions/biology.json"],
    status: "pending",
    uploader_id: student.id,
    uploader_name: student.name,
    question_count: 1,
    outcome_count: 1,
    exams: ["IMAT"],
    created_at: "2026-11-03T08:15:00Z",
    review_note: "",
  },
];
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export const configurationError = () => null;
export const api = {
  enroll: async () => ({ token: "preview", student }),
  google: async () => ({ token: "preview", student }),
  submit: async (answerToken: any, answer: any) => makeAttempt(answer),
  reflect: async (token: any, id: any, reflection: any) => {
    const a = attempts.find((a) => a.id === id);
    if (a) a.reflection = reflection;
    return a;
  },
  imports: async () => [...packages],
  importDetail: async (_token: string, id: string) => ({
    summary: { ...packages.find((p) => p.id === id) },
    bank: exampleBank,
  }),
  reviewImport: async (token: any, id: any, status: any, note: any) => {
    packages = packages.map((p) =>
      p.id === id
        ? {
            ...p,
            status,
            review_note: note,
            reviewed_at: new Date().toISOString(),
          }
        : p,
    );
    return packages.find((p) => p.id === id);
  },
};
export const googleConfigured = () => true;
export const googleIDToken = async () => "preview";
export const saveToken = async () => {};
export const savePending = async () => {};
export const clearPending = async () => {};
export const loadReminder = async () => ({
  enabled: true,
  hour: 19,
  minute: 0,
});
export const saveReminder = async (enabled: any, hour: any, minute: any) => ({
  enabled,
  hour,
  minute,
});
export const pickQuestionFiles = async () => [
  { uri: "demo", name: "biology-package.zip", size: 1680 },
];
export const pickQuestionFolder = async () => [
  { uri: "demo", name: "outcomes.json", size: 460 },
  { uri: "demo", name: "questions/biology.json", size: 1220 },
];
export const uploadQuestions = async (
  token: any,
  title: any,
  id: any,
  files: any,
) => {
  const p = {
    ...packages[0],
    id: "upload-" + Date.now(),
    title,
    files: files.map((f: any) => f.name),
    status: "pending",
    review_note: "",
  };
  packages = [p, ...packages];
  return p;
};

export const samplePackage = () => ({
  summary: { ...packages.find((p) => p.id === "demo-package") },
  bank: exampleBank,
});
