import React from "react";
import {
  Button,
  Card,
  Label,
  Progress,
  Screen,
  Section,
  styles,
} from "../components/ui";
import { View } from "react-native";
import type { Daily, Performance, Question, Student } from "../lib/types";

export function Today({
  student,
  daily,
  performance,
  onPractice,
  onReminders,
}: {
  student: Student;
  daily: Daily;
  performance: Performance;
  onPractice: (q: Question) => void;
  onReminders: () => void;
}) {
  const next = daily.questions[0];
  const weak = performance.outcomes.find(
    (o) => o.attempts > 0 && o.accuracy < 70,
  );
  return (
    <Screen>
      <Section
        eyebrow={`Daily practice · ${daily.exam}`}
        title={`Your next step, ${student.name}.`}
      >
        <Label muted>
          {daily.day} · {student.timezone}
        </Label>
      </Section>
      <Card tint>
        <Label size={14} strong>
          TODAY’S SESSION
        </Label>
        <Label size={38} strong>
          {daily.completed} / {daily.goal}
        </Label>
        <Label>
          {daily.goal === 0
            ? "No questions in this exam yet."
            : daily.completed === daily.goal
              ? "Daily session complete. A little consistency goes a long way."
              : "Five focused questions. Understand each answer before moving on."}
        </Label>
        <Progress
          value={daily.goal ? (daily.completed / daily.goal) * 100 : 0}
          label="Daily session progress"
        />
        {next ? (
          <Button
            title="Answer the next question"
            onPress={() => onPractice(next)}
          />
        ) : (
          <Label strong>Come back tomorrow for your next set.</Label>
        )}
      </Card>
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 130 }}>
          <Card>
            <Label size={30} strong>
              {performance.streak}
            </Label>
            <Label muted>day practice streak</Label>
          </Card>
        </View>
        <View style={{ flex: 1, minWidth: 130 }}>
          <Card>
            <Label size={30} strong>
              {performance.unresolved}
            </Label>
            <Label muted>questions to revisit</Label>
          </Card>
        </View>
      </View>
      {weak && (
        <Section eyebrow="A useful focus" title={weak.title}>
          <Label>{weak.remember}</Label>
          <Label muted size={13}>
            {weak.accuracy}% across the latest answers to {weak.attempts}{" "}
            distinct questions. A learning signal, not a mastery guarantee.
          </Label>
        </Section>
      )}
      {daily.questions.length > 0 && (
        <Section title="In today’s set">
          <Label muted>
            {Array.from(new Set(daily.questions.map((q) => q.subject))).join(
              " · ",
            )}
          </Label>
          <Label size={13} muted>
            Overdue mistakes come first, then new questions and scheduled
            reviews.
          </Label>
        </Section>
      )}
      <Button quiet title="Set a daily reminder" onPress={onReminders} />
      <Label muted size={13}>
        Original sample questions · IMAT, TOLC-I & TOLC-F practice
      </Label>
    </Screen>
  );
}
