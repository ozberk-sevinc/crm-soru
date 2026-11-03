import React, { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import {
  BookOpenCheck,
  CheckCheck,
  PencilLine,
  RotateCcw,
} from "lucide-react-native";
import {
  Badge,
  Button,
  Card,
  Display,
  EmptyState,
  Eyebrow,
  Label,
  Section,
  styles,
  useTheme,
} from "../components/ui";
import { answerLabel, studentAnswer } from "../lib/answer";
import { reasons } from "../lib/types";
import type { Mistake, Question } from "../lib/types";
export function Mistakes({
  mistakes,
  onRetry,
  onReflect,
}: {
  mistakes: Mistake[];
  onRetry: (q: Question) => void;
  onReflect: (attempt: Mistake) => void;
}) {
  const [all, setAll] = useState(false);
  const t = useTheme();
  const visible = mistakes.filter((m) => all || !m.resolved);
  const unresolved = mistakes.filter((m) => !m.resolved).length;
  return (
    <FlatList
      data={visible}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.screen,
        { maxWidth: 724, width: "100%", alignSelf: "center", gap: 18 },
      ]}
      ListHeaderComponent={
        <View style={{ gap: 22, marginBottom: 4 }}>
          <Section
            eyebrow="The mistake notebook"
            title={"Wrong today.\nWiser tomorrow."}
          >
            <Label muted size={14}>
              Your mistakes are a starting point. Let’s use them.
            </Label>
          </Section>
          <View
            style={{
              padding: 20,
              backgroundColor: t.accentSoft,
              borderRadius: 22,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
          >
            <BookOpenCheck color={t.accent} size={32} strokeWidth={1.5} />
            <View style={{ flex: 1 }}>
              <Display size={27}>{unresolved} to revisit</Display>
              <Label muted size={12}>
                {mistakes.filter((m) => m.resolved).length} resolved through
                practice
              </Label>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { label: "To revisit", value: false },
              { label: "All mistakes", value: true },
            ].map((f) => (
              <Pressable
                key={f.label}
                accessibilityRole="button"
                accessibilityState={{ selected: all === f.value }}
                onPress={() => setAll(f.value)}
                style={({ pressed }) => ({
                  minHeight: 48,
                  paddingHorizontal: 18,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: all === f.value ? t.accent : t.surface,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Label
                  size={13}
                  strong
                  color={all === f.value ? t.onAccent : t.muted}
                >
                  {f.label}
                </Label>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon={CheckCheck}
          title={all ? "A fresh notebook." : "All caught up."}
          message={
            all
              ? "When an answer misses the mark, its explanation and your reflection will live here."
              : "No questions need another look. Your next session is a fresh opportunity."
          }
        />
      }
      renderItem={({ item }) => (
        <Card>
          <View style={styles.between}>
            <Badge tone={item.resolved ? "success" : "warning"}>
              {item.resolved ? "Resolved" : "To revisit"}
            </Badge>
            <Eyebrow>{item.question.subject.toUpperCase()}</Eyebrow>
          </View>
          <Label size={19} strong>
            {item.question.prompt}
          </Label>
          <View
            style={{
              backgroundColor: t.background,
              borderRadius: 14,
              padding: 14,
              gap: 7,
            }}
          >
            <Label size={13} color={t.danger}>
              Your answer · {studentAnswer(item)}
            </Label>
            <Label size={13} strong color={t.accent}>
              Correct answer · {answerLabel(item)}
            </Label>
          </View>
          <Label size={14}>{item.explanation}</Label>
          {!!item.misconception && (
            <Label size={13} muted>
              {item.misconception}
            </Label>
          )}
          {item.affected_outcomes.map((o) => (
            <View
              key={o.id}
              style={{
                borderLeftWidth: 2,
                borderColor: t.accent,
                paddingLeft: 12,
                gap: 5,
              }}
            >
              <Label strong size={13}>
                {o.title}
              </Label>
              <Label size={12} muted>
                {o.remember}
              </Label>
            </View>
          ))}
          <View style={{ gap: 5 }}>
            <Eyebrow>YOUR REFLECTION</Eyebrow>
            <Label size={13}>
              {reasons.find((r) => r.id === item.reflection.reason)?.title ??
                "Add a reason to spot the pattern."}
            </Label>
            {!!item.reflection.note && (
              <Label size={13} muted>
                {item.reflection.note}
              </Label>
            )}
          </View>
          <Button
            quiet
            icon={PencilLine}
            title="Edit my reflection"
            onPress={() => onReflect(item)}
          />
          <Button
            icon={RotateCcw}
            title="Try this question again"
            onPress={() => onRetry(item.question)}
          />
        </Card>
      )}
    />
  );
}
