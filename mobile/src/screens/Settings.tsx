import React, { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  FolderUp,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react-native";
import {
  ActionRow,
  Badge,
  Display,
  Eyebrow,
  IconTile,
  useTheme,
} from "../components/ui";
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
  const t = useTheme();
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
      <Section eyebrow="Your study space" title="Make it yours.">
        <Label muted size={14}>
          A rhythm that works for you.
        </Label>
      </Section>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 20,
              backgroundColor: t.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Display size={24}>
              {student.name
                .split(" ")
                .filter(Boolean)
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </Display>
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Label strong size={22}>
              {student.name}
            </Label>
            <Label muted size={12}>
              {student.email || student.timezone}
            </Label>
            <Badge>
              {student.role === "admin" ? "Admin account" : "Student account"}
            </Badge>
          </View>
        </View>
      </Card>
      <View style={{ gap: 3 }}>
        <Eyebrow>QUESTIONS & CONTRIBUTIONS</Eyebrow>
        <ActionRow
          icon={FolderUp}
          title="Upload a question package"
          subtitle="ZIP, folder, or multiple JSON files"
          onPress={onUploads}
        />
        {student.role === "admin" && (
          <ActionRow
            icon={ShieldCheck}
            title="Review pending question packages"
            subtitle="Approve the questions that join the bank"
            onPress={onReview}
          />
        )}
      </View>
      <Card>
        <View style={styles.between}>
          <IconTile icon={Bell} />
          <Badge tone={reminder.enabled ? "success" : "neutral"}>
            {reminder.enabled ? "Reminder on" : "Reminder off"}
          </Badge>
        </View>
        <Display size={25}>{"A little nudge.\nAt the right time."}</Display>
        <Label muted size={14}>
          Your phone can remind you daily, even when the app is closed. Choose a
          time in your phone’s local timezone.
        </Label>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 7 }}>
            <Label muted size={12}>
              Hour · 0–23
            </Label>
            <Field
              accessibilityLabel="Reminder hour"
              keyboardType="number-pad"
              maxLength={2}
              value={hour}
              onChangeText={setHour}
            />
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <Label muted size={12}>
              Minute · 0–59
            </Label>
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
          icon={SlidersHorizontal}
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
      {message && (
        <View accessibilityLiveRegion="polite">
          <Badge tone="success">{message}</Badge>
        </View>
      )}
      <Label muted size={12}>
        Account timezone: {student.timezone}. Delivery depends on notification
        permission and device settings. Reminders continue after completing a
        session.
      </Label>
      <View
        style={{
          gap: 12,
          borderTopWidth: 1,
          borderColor: t.border,
          paddingTop: 23,
        }}
      >
        <View style={styles.inline}>
          <ShieldCheck color={t.accent} size={20} />
          <Label strong size={17}>
            Your progress, protected.
          </Label>
        </View>
        <Label muted size={13}>
          Answers, confidence, answer times and reflections are stored by your
          consultancy. Login tokens use your phone’s secure storage. Ask your
          consultancy to export or delete your history.
        </Label>
        <View style={styles.inline}>
          <BookOpen color={t.muted} size={17} />
          <Label muted size={12}>
            Original sample questions. IMAT, TOLC-I and TOLC-F have separate
            practice banks.
          </Label>
        </View>
      </View>
      <Button
        quiet
        icon={LogOut}
        title="Sign out"
        disabled={busy}
        onPress={onLogout}
      />
    </Screen>
  );
}
