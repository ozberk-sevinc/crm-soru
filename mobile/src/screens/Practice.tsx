import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Lightbulb,
  PencilLine,
  RotateCcw,
} from "lucide-react-native";
import { Badge, Display, Eyebrow, IconTile } from "../components/ui";
import * as Crypto from "expo-crypto";
import {
  Button,
  Card,
  Choice,
  ErrorNotice,
  Field,
  Label,
  Screen,
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
        <View style={{ paddingTop: 14, gap: 16 }}>
          <View style={styles.between}>
            <Badge tone={attempt.correct ? "success" : "warning"}>
              {attempt.correct
                ? "Answer recorded · correct"
                : "Answer recorded · revisit"}
            </Badge>
            <Label size={12} muted>
              {attempt.question.exam}
            </Label>
          </View>
          <IconTile
            icon={attempt.correct ? Check : Lightbulb}
            tone={attempt.correct ? "neutral" : "warning"}
          />
          <Display size={35}>
            {attempt.correct
              ? "That’s one more\nconcept connected."
              : "Every mistake\nhas something to teach."}
          </Display>
          <Label muted size={14}>
            {attempt.question.subject} · {attempt.duration_seconds}s spent
          </Label>
        </View>
        <Card tint>
          <Eyebrow>THE QUESTION</Eyebrow>
          <Label strong size={19}>
            {attempt.question.prompt}
          </Label>
          <View style={{ gap: 8 }}>
            <Label size={13} color={attempt.correct ? t.accent : t.danger}>
              Your answer · {studentAnswer(attempt)}
            </Label>
            <Label strong size={15} color={t.accent}>
              Correct answer · {answerLabel(attempt)}
            </Label>
          </View>
        </Card>
        <View style={{ gap: 12 }}>
          <View style={styles.inline}>
            <Lightbulb size={22} color={t.accent} />
            <Label strong size={21}>
              The reasoning
            </Label>
          </View>
          <Label size={16}>{attempt.explanation}</Label>
        </View>
        {!attempt.correct && (
          <>
            {!!attempt.misconception && (
              <View
                style={{
                  borderLeftWidth: 3,
                  borderColor: t.gold,
                  paddingLeft: 15,
                  gap: 7,
                }}
              >
                <Eyebrow>AN ANSWER CLUE</Eyebrow>
                <Label size={14}>{attempt.misconception}</Label>
                <Label size={11} muted>
                  This is a clue from your answer, rather than a diagnosis of
                  your reasoning.
                </Label>
              </View>
            )}
            <View style={{ gap: 8 }}>
              <Display size={27}>What happened for you?</Display>
              <Label muted size={14}>
                Notice the pattern. Make the next attempt count.
              </Label>
            </View>
            <View style={{ gap: 9 }}>
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
            </View>
            <View style={{ gap: 9 }}>
              <Label strong size={13}>
                A note to your future self
              </Label>
              <Field
                accessibilityLabel="Mistake reflection note"
                placeholder="Next time, I’ll… (optional)"
                multiline
                maxLength={1000}
                value={note}
                onChangeText={(value) => {
                  setNote(value);
                  setSaved(false);
                }}
              />
            </View>
            {error && <ErrorNotice message={error} />}
            <Button
              title={saved ? "Reflection saved" : "Save reflection"}
              icon={saved ? Check : PencilLine}
              disabled={!reason || saved}
              loading={busy}
              quiet
              onPress={() => void reflect()}
            />
          </>
        )}
        <View style={{ gap: 12 }}>
          <View style={styles.inline}>
            <BookOpen size={20} color={t.accent} />
            <Label strong size={20}>
              Take this with you.
            </Label>
          </View>
          <Eyebrow>KAZANIM · YOUR KNOWLEDGE LINK</Eyebrow>
        </View>
        {attempt.affected_outcomes.map((o) => (
          <Card key={o.id}>
            <Badge>{o.subject}</Badge>
            <Label strong size={18}>
              {o.title}
            </Label>
            <Label size={14}>{o.remember}</Label>
          </Card>
        ))}
        <View style={styles.inline}>
          <RotateCcw size={15} color={t.muted} />
          <Label muted size={12}>
            Scheduled for review from{" "}
            {new Date(attempt.review_at).toLocaleDateString()}.
          </Label>
        </View>
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
  const t = useTheme();
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
        <View style={{ paddingTop: 12, gap: 22 }}>
          <View style={styles.between}>
            <Button
              quiet
              icon={ArrowLeft}
              title="Back to today"
              disabled={busy || locked}
              onPress={onExit}
            />
            <Eyebrow>{question.exam}</Eyebrow>
          </View>
          <View style={styles.between}>
            <Badge>{question.subject}</Badge>
            <Label muted size={12}>
              {question.difficulty} ·{" "}
              {question.type === "numeric" ? "Numeric answer" : "Single choice"}
            </Label>
          </View>
        </View>
        <View style={{ gap: 15, paddingVertical: 8 }}>
          <Eyebrow>TAKE YOUR TIME. THINK IT THROUGH.</Eyebrow>
          <Display size={28}>{question.prompt}</Display>
          <Label muted size={13}>
            {question.type === "numeric"
              ? "Enter your answer below."
              : "Choose the one answer that fits best."}
          </Label>
        </View>
        <View
          style={{ gap: 12, opacity: locked ? 0.7 : 1 }}
          pointerEvents={locked ? "none" : "auto"}
        >
          {question.type === "single_choice" ? (
            question.options.map((o) => (
              <Choice
                key={o.id}
                letter={o.id}
                title={o.text}
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
          <View
            style={{
              gap: 10,
              marginTop: 15,
              paddingTop: 20,
              borderTopWidth: 1,
              borderColor: t.border,
            }}
          >
            <Label strong size={15}>
              How sure do you feel?
            </Label>
            <Label muted size={12}>
              There’s no wrong answer here. This helps you reflect.
            </Label>
            <View style={styles.row}>
              {["Guessing", "Unsure", "Confident"].map((title, i) => (
                <View key={title} style={{ flexGrow: 1, minWidth: 85 }}>
                  <Choice
                    title={title}
                    selected={confidence === i + 1}
                    onPress={() => setConfidence(i + 1)}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>
        {error && <ErrorNotice message={error} />}
        {locked && (
          <Label muted size={13}>
            Your answer is saved on this device. Retry to confirm it was
            recorded; it will count once.
          </Label>
        )}
        <Button
          title={locked ? "Retry this answer" : "Check my answer"}
          loading={busy}
          disabled={!hasAnswer(question, option, number)}
          onPress={() => void submit()}
        />
        <View style={{ gap: 5 }}>
          <Eyebrow>CONNECTED KAZANIMLAR</Eyebrow>
          <Label size={12} muted>
            {question.outcomes.map((o) => o.title).join(" · ")}
          </Label>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
