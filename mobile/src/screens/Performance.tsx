import React from "react";
import { View } from "react-native";
import {
  Card,
  Label,
  Progress,
  Screen,
  Section,
  styles,
  useTheme,
} from "../components/ui";
import type { Performance as Stats } from "../lib/types";

export function Performance({ performance: p }: { performance: Stats }) {
  const t = useTheme();
  return (
    <Screen>
      <Section eyebrow="Patterns, not just points" title="Your performance">
        <Label muted>All results are scoped to the selected exam.</Label>
      </Section>
      <Card tint>
        <Label size={48} strong>
          {p.attempts ? `${p.accuracy}%` : "—"}
        </Label>
        <Label strong>Overall answer accuracy</Label>
        <Label>
          {p.correct} correct / {p.attempts} submissions, including retries.
        </Label>
        <Progress value={p.accuracy} label="Overall accuracy" />
      </Card>
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 130 }}>
          <Card>
            <Label size={30} strong>
              {p.streak}
            </Label>
            <Label muted>day streak</Label>
          </Card>
        </View>
        <View style={{ flex: 1, minWidth: 130 }}>
          <Card>
            <Label size={30} strong>
              {p.average_seconds}s
            </Label>
            <Label muted>average answer time</Label>
          </Card>
        </View>
      </View>
      <Section title="Your last seven days">
        <Label muted>Practice activity in your account timezone.</Label>
      </Section>
      <Card>
        {p.week.map((d) => (
          <View key={d.day} style={{ gap: 6 }}>
            <Label size={14}>
              {d.day} · {d.correct}/{d.attempts} correct
            </Label>
            <View
              style={{ height: 8, borderRadius: 4, backgroundColor: t.border }}
            >
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: t.accent,
                  width: `${Math.round((d.attempts / Math.max(5, ...p.week.map((w) => w.attempts))) * 100)}%`,
                }}
              />
            </View>
          </View>
        ))}
      </Card>
      <Section title="Kazanım breakdown">
        <Label muted>
          Based on the latest answer to each distinct question. Repeating one
          question won’t inflate the sample count.
        </Label>
      </Section>
      {p.outcomes.map((o) => (
        <Card key={o.id}>
          <Label size={13} muted>
            {o.subject}
          </Label>
          <Label strong size={19}>
            {o.title}
          </Label>
          <Label strong>
            {o.attempts
              ? `${o.accuracy}% · ${o.correct}/${o.attempts} questions correct`
              : "Not practised yet"}
          </Label>
          <Progress value={o.accuracy} label={`${o.title} accuracy`} />
          <Label size={14}>{o.remember}</Label>
          {o.attempts > 0 && o.attempts < 3 && (
            <Label size={12} muted>
              Small sample: practise more questions before drawing conclusions.
            </Label>
          )}
        </Card>
      ))}
      {p.attempts === 0 && (
        <Label muted>
          Your first answered question will start your performance history.
        </Label>
      )}
    </Screen>
  );
}
