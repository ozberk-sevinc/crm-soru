import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import * as Crypto from "expo-crypto";
import {
  Button,
  Card,
  Choice,
  ErrorNotice,
  Field,
  Label,
  Screen,
  Section,
  styles,
  useTheme,
} from "../components/ui";
import {
  hasAnswer,
  numericAnswer,
  answerLabel,
  studentAnswer,
} from "../lib/answer";
import { api } from "../lib/api";
import { savePending, clearPending } from "../lib/storage";
import { reasons } from "../lib/types";
import type {
  Attempt,
  MistakeReason,
  Question,
  Student,
  Submission,
} from "../lib/types";

export function Feedback({
  attempt,
  token,
  onNext,
}: {
  attempt: Attempt;
  token: string;
  onNext: () => void;
}) {
  const t = useTheme();
  const [reason, setReason] = useState<MistakeReason>(
    attempt.reflection.reason,
  );
  const [note, setNote] = useState(attempt.reflection.note);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function reflect(): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      await api.reflect(token, attempt.id, { reason, note });
      setSaved(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save reflection.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function continuePractice() {
    if (!attempt.correct && !saved && (reason || note.trim())) {
      if (!(await reflect())) return;
    }
    onNext();
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <Section
          eyebrow={attempt.question.exam}
          title={
            attempt.correct
              ? "Correct. Keep building."
              : "Let’s understand this one."
          }
        >
          <Label muted>{attempt.question.subject} · Answer recorded</Label>
        </Section>
        <Card tint>
          <Label size={20} strong>
            {attempt.question.prompt}
          </Label>
          <Label>Your answer: {studentAnswer(attempt)}</Label>
          <Label strong color={attempt.correct ? t.accent : t.danger}>
            {attempt.correct ? "Correct answer" : "Answer to remember"}:{" "}
            {answerLabel(attempt)}
          </Label>
          <Label>{attempt.explanation}</Label>
        </Card>
        {!attempt.correct && (
          <>
            <Section title="What might have gone wrong?">
              <Label>{attempt.misconception}</Label>
              <Label size={13} muted>
                This is a clue based on your answer, not a certainty about your
                reasoning.
              </Label>
            </Section>
            <Section title="What happened for you?">
              <Label muted>
                Record the reason so your mistake notebook stays useful.
              </Label>
            </Section>
            {reasons.map((r) => (
              <Choice
                key={r.id}
                title={r.title}
                selected={reason === r.id}
                onPress={() => {
                  setReason(r.id);
                  setSaved(false);
                }}
              />
            ))}
            <Field
              accessibilityLabel="Mistake reflection note"
              placeholder="What will you do differently next time? (optional)"
              multiline
              maxLength={1000}
              value={note}
              onChangeText={(value) => {
                setNote(value);
                setSaved(false);
              }}
            />
            {error && <ErrorNotice message={error} />}
            <Button
              title={saved ? "Reflection saved" : "Save reflection"}
              disabled={!reason || saved}
              loading={busy}
              quiet
              onPress={() => void reflect()}
            />
          </>
        )}
        <Section title="Kazanım · remember this" />
        {attempt.affected_outcomes.map((o) => (
          <Card key={o.id}>
            <Label size={13} muted>
              {o.subject}
            </Label>
            <Label strong>{o.title}</Label>
            <Label>{o.remember}</Label>
          </Card>
        ))}
        <Label muted size={13}>
          Scheduled for review from{" "}
          {new Date(attempt.review_at).toLocaleDateString()}.
        </Label>
        <Button
          title="Continue"
          disabled={busy}
          onPress={() => void continuePractice()}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
export function Practice({
  question,
  token,
  student,
  onAnswered,
  onExit,
  onProtect,
}: {
  question: Question;
  token: string;
  student: Student;
  onAnswered: (attempt: Attempt) => void;
  onExit: () => void;
  onProtect: (protectedAnswer: boolean) => void;
}) {
  const [option, setOption] = useState("");
  const [number, setNumber] = useState("");
  const [confidence, setConfidence] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const started = useRef(Date.now());
  const submission = useRef<Submission | null>(null);
  async function submit() {
    setBusy(true);
    setError("");
    onProtect(true);
    let persisted = locked;
    if (!submission.current)
      submission.current = {
        request_id: Crypto.randomUUID(),
        question_id: question.id,
        confidence,
        duration_seconds: Math.min(
          86400,
          Math.max(0, Math.round((Date.now() - started.current) / 1000)),
        ),
        ...(question.type === "single_choice"
          ? { option_id: option }
          : { value: numericAnswer(number) }),
      };
    try {
      await savePending(student.id, submission.current);
      setLocked(true);
      persisted = true;
      const attempt = await api.submit(token, submission.current);
      await clearPending(student.id);
      onAnswered(attempt);
    } catch (e) {
      if (!persisted) {
        submission.current = null;
        onProtect(false);
      }
      setError(
        e instanceof Error ? e.message : "Answer could not be saved. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <Button
          quiet
          title="Back to today"
          disabled={busy || locked}
          onPress={onExit}
        />
        <Section
          eyebrow={`${question.exam} · ${question.subject}`}
          title="One question at a time"
        >
          <Label muted>
            {question.difficulty} ·{" "}
            {question.type === "numeric"
              ? "Enter a number"
              : "Choose one answer"}
          </Label>
        </Section>
        <Card>
          <Label size={22} strong>
            {question.prompt}
          </Label>
        </Card>
        <View
          style={{ gap: 12, opacity: locked ? 0.7 : 1 }}
          pointerEvents={locked ? "none" : "auto"}
        >
          {question.type === "single_choice" ? (
            question.options.map((o) => (
              <Choice
                key={o.id}
                title={`${o.id}. ${o.text}`}
                selected={option === o.id}
                onPress={() => setOption(o.id)}
              />
            ))
          ) : (
            <Field
              accessibilityLabel="Numeric answer"
              value={number}
              onChangeText={setNumber}
              placeholder="Your answer, e.g. 0.5"
              keyboardType="numbers-and-punctuation"
              editable={!locked}
            />
          )}
          <Label strong>How confident are you?</Label>
          <View style={styles.row}>
            {["Guessing", "Unsure", "Confident"].map((title, i) => (
              <View key={title} style={{ flexGrow: 1 }}>
                <Choice
                  title={title}
                  selected={confidence === i + 1}
                  onPress={() => setConfidence(i + 1)}
                />
              </View>
            ))}
          </View>
        </View>
        {error && <ErrorNotice message={error} />}
        {locked && (
          <Label muted size={13}>
            Your answer is held safely on this device. Retry to confirm it was
            recorded; it will count once.
          </Label>
        )}
        <Button
          title={locked ? "Retry this answer" : "Check my answer"}
          loading={busy}
          disabled={!hasAnswer(question, option, number)}
          onPress={() => void submit()}
        />
        <Label size={13} muted>
          Kazanımlar: {question.outcomes.map((o) => o.title).join(" · ")}
        </Label>
      </Screen>
    </KeyboardAvoidingView>
  );
}
