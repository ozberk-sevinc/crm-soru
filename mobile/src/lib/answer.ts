import type { Question, Attempt } from "./types.ts";

export function numericAnswer(text: string): number | undefined {
  const cleaned = text.trim().replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}
export function answerLabel(attempt: Attempt): string {
  const answer = attempt.correct_answer;
  if (attempt.question.type === "numeric") return String(answer.value);
  const option = attempt.question.options.find(
    (o) => o.id === answer.option_id,
  );
  return option ? `${option.id}. ${option.text}` : (answer.option_id ?? "");
}
export function studentAnswer(attempt: Attempt): string {
  if (attempt.question.type === "numeric") return String(attempt.value);
  const option = attempt.question.options.find(
    (o) => o.id === attempt.option_id,
  );
  return option ? `${option.id}. ${option.text}` : (attempt.option_id ?? "");
}
export function hasAnswer(
  question: Question,
  option: string,
  number: string,
): boolean {
  return question.type === "single_choice"
    ? question.options.some((o) => o.id === option)
    : numericAnswer(number) !== undefined;
}
