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
import { googleConfigured, googleIDToken } from "../lib/google";
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
  async function google() {
    setBusy(true);
    setError("");
    try {
      const idToken = await googleIDToken();
      if (!idToken) return;
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome";
      const result = await api.google(idToken, code.trim(), timezone);
      await saveToken(result.token);
      onEnroll(result.token, result.student);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Google sign-in failed. Please retry.",
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
            Use Google to sign in. If you already have a consultancy account,
            enter its invite code below before your first Google sign-in to keep
            your history.
          </Label>
        </Section>
        <Button
          title="Continue with Google"
          loading={busy}
          disabled={!googleConfigured() || !!configurationError()}
          onPress={() => void google()}
        />
        {!googleConfigured() && (
          <Label muted size={13}>
            Google sign-in needs the consultancy’s OAuth configuration. Invite
            sign-in is available below.
          </Label>
        )}
        <Field
          accessibilityLabel="Invite code"
          placeholder="Invite code (optional for Google)"
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
          title="Continue with invite code"
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
