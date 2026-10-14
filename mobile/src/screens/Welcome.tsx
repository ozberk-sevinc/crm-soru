import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import {
  Button,
  Card,
  ErrorNotice,
  Field,
  Label,
  Screen,
  Section,
} from "../components/ui";
import { api, configurationError } from "../lib/api";
import { saveToken } from "../lib/storage";
import type { Student } from "../lib/types";

export function Welcome({
  onEnroll,
}: {
  onEnroll: (token: string, student: Student) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const result = await api.enroll(code.trim());
      await saveToken(result.token);
      onEnroll(result.token, result.student);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in. Retry.");
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
        <View style={{ paddingTop: 36 }}>
          <Section
            eyebrow="Otranto Soru"
            title="Small sessions. Stronger understanding."
          >
            <Label muted>
              Daily IMAT & TOLC practice, built around what you need to learn
              next.
            </Label>
          </Section>
        </View>
        <Card tint>
          <Label size={22} strong>
            Five questions. One clear next step.
          </Label>
          <Label>
            Answer, understand your mistakes, and see your progress by kazanım.
          </Label>
        </Card>
        <Section title="Join your study space">
          <Label muted>
            Enter the one-time invite code provided by your consultancy.
          </Label>
        </Section>
        <Field
          accessibilityLabel="Invite code"
          placeholder="Your invite code"
          autoCapitalize="none"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (code && !busy) void enroll();
          }}
        />
        {(error || configurationError()) && (
          <ErrorNotice message={error || configurationError()!} />
        )}
        <Button
          title="Start learning"
          loading={busy}
          disabled={!code.trim() || !!configurationError()}
          onPress={() => void enroll()}
        />
        <Label size={13} muted>
          Includes original sample practice questions. These are not official
          exam papers or an exam score prediction.
        </Label>
      </Screen>
    </KeyboardAvoidingView>
  );
}
