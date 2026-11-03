import React, { useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react-native";
import { Brand } from "../components/chrome";
import { Orbit } from "../components/study";
import { Display, Eyebrow, useTheme, styles } from "../components/ui";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, ErrorNotice, Field, Label, Screen } from "../components/ui";
import { api, configurationError } from "../lib/api";
import { googleConfigured, googleIDToken } from "../lib/google";
import { saveToken } from "../lib/storage";
import type { Student } from "../lib/types";

export function Welcome({
  onEnroll,
}: {
  onEnroll: (token: string, student: Student) => void;
}) {
  const t = useTheme();
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
        <View style={{ paddingTop: 16, paddingBottom: 12 }}>
          <Brand />
        </View>
        <View
          style={{
            padding: 26,
            backgroundColor: t.hero,
            borderRadius: 28,
            gap: 25,
          }}
        >
          <View style={styles.between}>
            <Eyebrow color={t.heroMuted}>A LITTLE EVERY DAY</Eyebrow>
            <Orbit size={86} />
          </View>
          <Display size={43} color={t.heroInk}>
            {"Big dreams.\nSmall daily\nsteps."}
          </Display>
          <Label color={t.heroMuted} size={15}>
            Your IMAT & TOLC journey, one well-understood question at a time.
          </Label>
          <View style={{ flexDirection: "row", gap: 18, paddingTop: 8 }}>
            {["01 / Practise", "02 / Reflect", "03 / Grow"].map((step) => (
              <Label key={step} size={11} color={t.lime}>
                {step}
              </Label>
            ))}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Display size={28}>Your next chapter starts here.</Display>
          <Label muted size={14}>
            Sign in to your personal study space.
          </Label>
        </View>
        <Button
          title="Continue with Google"
          loading={busy}
          disabled={!googleConfigured() || !!configurationError()}
          onPress={() => void google()}
          icon={ArrowRight}
        />
        {!googleConfigured() && (
          <Label muted size={13}>
            Google sign-in needs the consultancy’s OAuth configuration. You can
            use your invite below.
          </Label>
        )}
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <View style={{ height: 1, backgroundColor: t.border, flex: 1 }} />
          <Eyebrow>HAVE AN INVITE?</Eyebrow>
          <View style={{ height: 1, backgroundColor: t.border, flex: 1 }} />
        </View>
        <View style={{ gap: 12 }}>
          <Label size={13} strong>
            Consultancy invite code
          </Label>
          <Field
            accessibilityLabel="Invite code"
            placeholder="Enter your invite code"
            autoCapitalize="none"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
            returnKeyType="go"
            onSubmitEditing={() => {
              if (code && !busy) void enroll();
            }}
          />
          <Label size={12} muted>
            Already a student? Add your invite before your first Google sign-in
            to keep your existing history.
          </Label>
          {(error || configurationError()) && (
            <ErrorNotice message={error || configurationError()!} />
          )}
          <Button
            quiet
            icon={KeyRound}
            title="Continue with invite code"
            loading={busy}
            disabled={!code.trim() || !!configurationError()}
            onPress={() => void enroll()}
          />
        </View>
        <View style={styles.inline}>
          <ShieldCheck size={18} color={t.muted} />
          <Label size={11} muted>
            Your progress belongs to your account. Original sample questions;
            not official exam papers.
          </Label>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
