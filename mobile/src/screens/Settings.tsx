import React, { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import {
  Button,
  Card,
  ErrorNotice,
  Field,
  Label,
  Screen,
  Section,
  styles,
} from "../components/ui";
import { loadReminder, saveReminder } from "../lib/reminders";
import type { Reminder } from "../lib/reminders";
import type { Student } from "../lib/types";

export function Settings({
  student,
  onLogout,
  onUploads,
  onReview,
}: {
  student: Student;
  onLogout: () => void;
  onUploads: () => void;
  onReview: () => void;
}) {
  const [reminder, setReminder] = useState<Reminder>({
    enabled: false,
    hour: 19,
    minute: 0,
  });
  const [hour, setHour] = useState("19");
  const [minute, setMinute] = useState("00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    loadReminder()
      .then((r) => {
        setReminder(r);
        setHour(String(r.hour).padStart(2, "0"));
        setMinute(String(r.minute).padStart(2, "0"));
      })
      .catch(() => setError("Could not load reminder settings."));
  }, []);
  async function save(enabled: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute))
        throw new Error("Enter hours 0–23 and minutes 0–59.");
      const r = await saveReminder(enabled, Number(hour), Number(minute));
      setReminder(r);
      setMessage(
        enabled ? "Daily reminder saved." : "Daily reminder disabled.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update reminders.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Card>
        <Label strong size={22}>
          Questions & contributions
        </Label>
        <Button title="Upload a question package" onPress={onUploads} />
        {student.role === "admin" && (
          <Button
            title="Review pending question packages"
            quiet
            onPress={onReview}
          />
        )}
        <Label muted size={13}>
          {student.email ? `Signed in as ${student.email}` : student.name} ·{" "}
          {student.role}
        </Label>
      </Card>
      <Section eyebrow={student.name} title="Your daily rhythm">
        <Label muted>Account timezone: {student.timezone}</Label>
      </Section>
      <Card>
        <Label strong size={22}>
          A gentle nudge to practise
        </Label>
        <Label>
          Choose when your phone reminds you to answer your daily questions.
          Reminders use your phone’s local time and work without opening the
          app.
        </Label>
        <Label strong>
          {reminder.enabled
            ? `Enabled at ${String(reminder.hour).padStart(2, "0")}:${String(reminder.minute).padStart(2, "0")}`
            : "Reminders are off"}
        </Label>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Label muted>Hour (0–23)</Label>
            <Field
              accessibilityLabel="Reminder hour"
              keyboardType="number-pad"
              maxLength={2}
              value={hour}
              onChangeText={setHour}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Label muted>Minute (0–59)</Label>
            <Field
              accessibilityLabel="Reminder minute"
              keyboardType="number-pad"
              maxLength={2}
              value={minute}
              onChangeText={setMinute}
            />
          </View>
        </View>
        <Button
          title={
            reminder.enabled ? "Update reminder time" : "Enable daily reminder"
          }
          loading={busy}
          onPress={() => void save(true)}
        />
        {reminder.enabled && (
          <Button
            quiet
            title="Turn reminders off"
            disabled={busy}
            onPress={() => void save(false)}
          />
        )}
        <Button
          quiet
          title="Open notification settings"
          disabled={busy}
          onPress={() => {
            Linking.openSettings().catch(() =>
              setError("Open your phone’s Settings manually."),
            );
          }}
        />
      </Card>
      {error && <ErrorNotice message={error} />}
      {message && <Label strong>{message}</Label>}
      <Label muted size={13}>
        Delivery depends on notification permission and your device settings.
        The reminder continues every day, even after you complete a session.
      </Label>
      <Card>
        <Label strong>About your data</Label>
        <Label size={14}>
          Your answers, confidence, answer times and reflections are stored by
          your consultancy’s Go API. Login tokens are kept in your phone’s
          secure storage. Ask your consultancy to export or delete your history.
        </Label>
        <Label size={14}>
          This app currently includes sample questions, not official exam
          papers. TOLC-I and TOLC-F have separate practice banks.
        </Label>
      </Card>
      <Button quiet title="Sign out" disabled={busy} onPress={onLogout} />
    </Screen>
  );
}
