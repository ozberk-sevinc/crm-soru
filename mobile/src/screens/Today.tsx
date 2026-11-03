import React from "react";
import { Pressable, View } from "react-native";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronRight,
  Flame,
  RotateCcw,
} from "lucide-react-native";
import {
  Badge,
  Button,
  Card,
  Display,
  Eyebrow,
  IconTile,
  Label,
  Progress,
  Screen,
  styles,
  useTheme,
} from "../components/ui";
import { Orbit } from "../components/study";
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
  const t = useTheme();
  const next = daily.questions[0];
  const weak = [...performance.outcomes]
    .filter((o) => o.attempts > 0 && o.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy)[0];
  const complete = daily.goal > 0 && daily.completed >= daily.goal;
  const day = new Date(`${daily.day}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <Screen>
      <View style={{ gap: 7 }}>
        <Eyebrow>{day.toUpperCase()}</Eyebrow>
        <Display>
          Make room to grow,{"\n"}
          {student.name.split(" ")[0]}.
        </Display>
        <Label muted size={14}>
          A little focus. A clearer understanding.
        </Label>
      </View>
      <View
        style={{
          padding: 24,
          borderRadius: 26,
          backgroundColor: t.hero,
          gap: 21,
          overflow: "hidden",
        }}
      >
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 10 }}>
            <Eyebrow color={t.heroMuted}>YOUR DAILY SESSION</Eyebrow>
            <Display size={32} color={t.heroInk}>
              {complete ? "Today,\nwell spent." : "Small steps.\nBig futures."}
            </Display>
          </View>
          <Orbit size={90} />
        </View>
        <View style={{ gap: 12 }}>
          <View style={styles.between}>
            <Label strong size={14} color={t.heroInk}>
              {daily.completed} of {daily.goal} complete
            </Label>
            <Label size={12} color={t.heroMuted}>
              {daily.exam}
            </Label>
          </View>
          <Progress
            hero
            value={daily.goal ? (daily.completed / daily.goal) * 100 : 0}
            label="Daily session progress"
          />
        </View>
        {next ? (
          <Button
            tone="hero"
            title={daily.completed ? "Continue my session" : "Start my session"}
            onPress={() => onPractice(next)}
          />
        ) : (
          <Label color={t.heroInk} strong>
            {daily.goal === 0
              ? "Questions are on their way."
              : "You’re all set. See you tomorrow."}
          </Label>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          {
            icon: Flame,
            value: performance.streak,
            title: "day streak",
            tone: "warning" as const,
          },
          {
            icon: RotateCcw,
            value: performance.unresolved,
            title: "to revisit",
            tone: "neutral" as const,
          },
        ].map(({ icon: Icon, value, title, tone }) => (
          <View key={title} style={{ flex: 1 }}>
            <Card>
              <IconTile icon={Icon} tone={tone} />
              <View>
                <Display size={29}>{value}</Display>
                <Label muted size={12}>
                  {title}
                </Label>
              </View>
            </Card>
          </View>
        ))}
      </View>
      {weak && (
        <View style={{ gap: 12 }}>
          <View style={styles.between}>
            <Label strong size={19}>
              A little extra attention
            </Label>
            <ArrowUpRight size={20} color={t.muted} />
          </View>
          <Card>
            <View style={styles.between}>
              <Badge tone="warning">{weak.subject}</Badge>
              <Label strong size={13} color={t.gold}>
                {weak.accuracy}% accuracy
              </Label>
            </View>
            <Label strong size={19}>
              {weak.title}
            </Label>
            <Label muted size={14}>
              {weak.remember}
            </Label>
            <Progress value={weak.accuracy} label={`${weak.title} accuracy`} />
            <Label muted size={11}>
              Based on {weak.attempts} distinct questions · a learning signal.
            </Label>
          </Card>
        </View>
      )}
      {daily.questions.length > 0 && (
        <View style={{ gap: 15 }}>
          <View style={styles.between}>
            <Label strong size={20}>
              Up next
            </Label>
            <Label size={12} muted>
              {daily.questions.length} remaining
            </Label>
          </View>
          {daily.questions.map((q, i) => (
            <Pressable
              key={q.id}
              accessibilityRole="button"
              accessibilityLabel={`Practise ${q.subject}: ${q.prompt}`}
              onPress={() => onPractice(q)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 13,
                borderBottomWidth: 1,
                borderColor: t.border,
                gap: 13,
                opacity: pressed ? 0.6 : 1,
                minHeight: 70,
              })}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: t.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Label strong size={13} color={t.accent}>
                  {String(i + 1).padStart(2, "0")}
                </Label>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Label strong size={15}>
                  {q.subject}
                </Label>
                <Label size={12} muted>
                  {q.outcomes.map((o) => o.title).join(" · ") || q.difficulty}
                </Label>
              </View>
              <ChevronRight size={18} color={t.muted} />
            </Pressable>
          ))}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Set a daily reminder"
        onPress={onReminders}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          minHeight: 60,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Bell size={21} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Label strong size={14}>
            Find your daily rhythm
          </Label>
          <Label muted size={12}>
            Choose a reminder time that works for you.
          </Label>
        </View>
        <ChevronRight size={18} color={t.muted} />
      </Pressable>
      <View style={styles.inline}>
        <BookOpen size={14} color={t.muted} />
        <Label muted size={11}>
          Original sample questions · {daily.exam} practice
        </Label>
      </View>
    </Screen>
  );
}
