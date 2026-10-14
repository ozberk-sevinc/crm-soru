import React, { useState } from "react";
import { FlatList, View } from "react-native";
import {
  Button,
  Card,
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
  return (
    <FlatList
      data={visible}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.screen,
        { maxWidth: 720, width: "100%", alignSelf: "center", gap: 16 },
      ]}
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 16 }}>
          <Section eyebrow="Your learning history" title="Mistake notebook">
            <Label muted>Understand the pattern. Practise the next step.</Label>
          </Section>
          <Button
            quiet
            title={all ? "Show unresolved only" : "Include resolved questions"}
            onPress={() => setAll(!all)}
          />
        </View>
      }
      ListEmptyComponent={
        <Card>
          <Label strong>
            {all ? "No mistakes recorded yet." : "No unresolved mistakes."}
          </Label>
          <Label muted>
            Wrong answers appear here with the explanation, kazanımlar and your
            reflection.
          </Label>
        </Card>
      }
      renderItem={({ item }) => (
        <Card>
          <Label strong color={item.resolved ? t.accent : t.danger}>
            {item.resolved
              ? "Resolved by a later correct answer"
              : "Needs another look"}{" "}
            · {item.question.subject}
          </Label>
          <Label size={19} strong>
            {item.question.prompt}
          </Label>
          <Label>Your answer: {studentAnswer(item)}</Label>
          <Label strong>Correct: {answerLabel(item)}</Label>
          <Label>{item.explanation}</Label>
          <Label muted>{item.misconception}</Label>
          {item.affected_outcomes.map((o) => (
            <View key={o.id} style={{ gap: 4 }}>
              <Label strong>{o.title}</Label>
              <Label size={14}>{o.remember}</Label>
            </View>
          ))}
          <Label size={14} muted>
            Your reason:{" "}
            {reasons.find((r) => r.id === item.reflection.reason)?.title ??
              "Not recorded yet"}
          </Label>
          {!!item.reflection.note && (
            <Label size={14}>{item.reflection.note}</Label>
          )}
          <Button
            quiet
            title="Edit my reflection"
            onPress={() => onReflect(item)}
          />
          <Button
            title="Try this question again"
            onPress={() => onRetry(item.question)}
          />
        </Card>
      )}
    />
  );
}
