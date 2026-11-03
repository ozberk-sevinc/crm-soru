import React from "react";
import { View } from "react-native";
import { Clock3, Flame, Target } from "lucide-react-native";
import {
  Badge,
  Card,
  Display,
  Eyebrow,
  IconTile,
  Label,
  Progress,
  Screen,
  Section,
  styles,
  useTheme,
} from "../components/ui";
import { ActivityBars } from "../components/study";
import type { Performance as Stats } from "../lib/types";
export function Performance({ performance: p }: { performance: Stats }) {
  const t = useTheme();
  return (
    <Screen>
      <Section
        eyebrow="Your learning, in focus"
        title={"Look how far\nyou’ve come."}
      >
        <Label muted size={14}>
          Every answer tells you where to go next.
        </Label>
      </Section>
      <View
        style={{
          padding: 24,
          backgroundColor: t.hero,
          borderRadius: 26,
          gap: 18,
        }}
      >
        <View style={styles.between}>
          <Eyebrow color={t.heroMuted}>OVERALL ACCURACY</Eyebrow>
          <Target size={23} color={t.lime} />
        </View>
        <Display size={60} color={t.heroInk}>
          {p.attempts ? `${p.accuracy}%` : "—"}
        </Display>
        <Progress hero value={p.accuracy} label="Overall accuracy" />
        <Label size={13} color={t.heroMuted}>
          {p.correct} correct out of {p.attempts} answers, including retries.
        </Label>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          { icon: Flame, value: String(p.streak), label: "day streak" },
          {
            icon: Clock3,
            value: `${p.average_seconds}s`,
            label: "average per answer",
          },
        ].map((m) => (
          <View key={m.label} style={{ flex: 1 }}>
            <Card>
              <IconTile icon={m.icon} />
              <Display size={28}>{m.value}</Display>
              <Label muted size={12}>
                {m.label}
              </Label>
            </Card>
          </View>
        ))}
      </View>
      <View style={{ gap: 16 }}>
        <Label strong size={21}>
          Showing up adds up.
        </Label>
        <Card>
          <ActivityBars week={p.week} />
        </Card>
      </View>
      <View style={{ gap: 8 }}>
        <Eyebrow>YOUR KNOWLEDGE MAP</Eyebrow>
        <Display size={27}>One concept at a time.</Display>
        <Label muted size={13}>
          Kazanım accuracy uses your latest answer to each distinct question.
        </Label>
      </View>
      {p.outcomes.map((o) => (
        <Card key={o.id}>
          <View style={styles.between}>
            <Badge>{o.subject}</Badge>
            <Label strong size={17}>
              {o.attempts ? `${o.accuracy}%` : "—"}
            </Label>
          </View>
          <Label strong size={19}>
            {o.title}
          </Label>
          <Progress value={o.accuracy} label={`${o.title} accuracy`} />
          <Label size={13} muted>
            {o.remember}
          </Label>
          <Label muted size={11}>
            {o.attempts
              ? `${o.correct} of ${o.attempts} distinct questions correct${o.attempts < 3 ? " · keep practising for a fuller picture" : ""}`
              : "Your first question starts this story."}
          </Label>
        </Card>
      ))}
      {p.attempts === 0 && (
        <Label muted>Your first answer will begin your progress history.</Label>
      )}
    </Screen>
  );
}
