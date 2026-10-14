import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Pressable,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import {
  Button,
  ErrorNotice,
  Label,
  Screen,
  ThemeProvider,
  useTheme,
} from "./src/components/ui";
import { api, ApiError } from "./src/lib/api";
import {
  clearPending,
  deleteToken,
  loadExam,
  loadPending,
  loadToken,
  saveExam,
} from "./src/lib/storage";
import { disableReminder } from "./src/lib/reminders";
import type {
  Attempt,
  Daily,
  Exam,
  Mistake,
  Performance as Stats,
  Question,
  Student,
  Submission,
} from "./src/lib/types";
import { Welcome } from "./src/screens/Welcome";
import { Practice, Feedback } from "./src/screens/Practice";
import { Today } from "./src/screens/Today";
import { Mistakes } from "./src/screens/Mistakes";
import { Performance } from "./src/screens/Performance";
import { Uploads, ReviewQueue } from "./src/screens/Uploads";
import { signOutGoogle } from "./src/lib/google";
import { Settings } from "./src/screens/Settings";

type Tab =
  "today" | "mistakes" | "progress" | "settings" | "uploads" | "reviews";
function Application() {
  const t = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [exam, setExam] = useState<Exam>("IMAT");
  const [tab, setTab] = useState<Tab>("today");
  const [data, setData] = useState<{
    studentId: string;
    daily: Daily;
    stats: Stats;
    mistakes: Mistake[];
  } | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [pending, setPending] = useState<Submission | null>(null);
  const [protectedAnswer, setProtectedAnswer] = useState(false);

  const handleError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : "Something went wrong. Retry.");
    if (e instanceof ApiError && e.status === 401) setExpired(true);
  }, []);
  const boot = useCallback(async () => {
    setBooting(true);
    setError("");
    try {
      const [savedToken, savedExam] = await Promise.all([
        loadToken(),
        loadExam(),
      ]);
      setExam(savedExam);
      if (savedToken) {
        setToken(savedToken);
        const me = await api.me(savedToken);
        setStudent(me);
        setPending(await loadPending(me.id));
      }
    } catch (e) {
      handleError(e);
    } finally {
      setBooting(false);
    }
  }, [handleError]);
  useEffect(() => {
    void boot();
  }, [boot]);
  const refresh = useCallback(async () => {
    if (!token || !student) return;
    setBusy(true);
    setError("");
    try {
      const [daily, stats, mistakes, answer] = await Promise.all([
        api.daily(token, exam),
        api.performance(token, exam),
        api.mistakes(token, exam),
        loadPending(student.id),
      ]);
      setData({ studentId: student.id, daily, stats, mistakes });
      setPending(answer);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }, [token, student, exam, handleError]);
  useEffect(() => {
    setData(null);
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const response = Notifications.addNotificationResponseReceivedListener(() =>
      setTab("today"),
    );
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active" && !question && !attempt) void refresh();
    });
    return () => {
      response.remove();
      app.remove();
    };
  }, [refresh, question, attempt]);
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (protectedAnswer) {
        Alert.alert(
          "Your answer is being recorded",
          "Wait for the result or retry this answer before leaving.",
        );
        return true;
      }
      if (question || attempt) {
        Alert.alert(
          "Leave this question?",
          "Saved answers are kept. An unsubmitted answer will be cleared.",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Leave",
              onPress: () => {
                setQuestion(null);
                setAttempt(null);
                void refresh();
              },
            },
          ],
        );
        return true;
      }
      if (tab !== "today") {
        setTab("today");
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [question, attempt, tab, refresh, protectedAnswer]);
  async function resetSession() {
    try {
      await disableReminder();
      await deleteToken();
      await signOutGoogle().catch(() => {});
      setTab("today");
      setToken(null);
      setStudent(null);
      setData(null);
      setExpired(false);
      setQuestion(null);
      setAttempt(null);
      setProtectedAnswer(false);
      setError("");
    } catch (e) {
      handleError(e);
    }
  }
  async function logout() {
    if (!token) return;
    Alert.alert(
      "Sign out?",
      "You can sign in with Google again. Invite-only accounts need a new invite code. Your saved history stays with your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          onPress: () => {
            setBusy(true);
            api
              .logout(token)
              .then(resetSession)
              .catch(handleError)
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }
  async function retryPending() {
    if (!token || !student || !pending) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.submit(token, pending);
      await clearPending(student.id);
      setPending(null);
      setAttempt(result);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function selectExam(next: Exam) {
    try {
      await saveExam(next);
      setExam(next);
    } catch (e) {
      handleError(e);
    }
  }
  let content: React.ReactNode;
  if (booting)
    content = (
      <Screen>
        <ActivityIndicator color={t.accent} />
        <Label>Opening your study space…</Label>
      </Screen>
    );
  else if (expired)
    content = (
      <Screen>
        <ErrorNotice message={error || "Your session expired."} />
        <Label>
          Sign in with Google again, or ask your consultancy for a new invite
          code. Your saved history is retained.
        </Label>
        <Button title="Return to sign-in" onPress={() => void resetSession()} />
      </Screen>
    );
  else if (token && !student)
    content = (
      <Screen>
        <ErrorNotice
          message={error || "Could not load your account."}
          onRetry={() => void boot()}
        />
      </Screen>
    );
  else if (!token || !student)
    content = (
      <Welcome
        onEnroll={(nextToken, nextStudent) => {
          setToken(nextToken);
          setStudent(nextStudent);
          setError("");
        }}
      />
    );
  else if (attempt)
    content = (
      <Feedback
        key={attempt.id}
        token={token}
        attempt={attempt}
        onNext={() => {
          setAttempt(null);
          setQuestion(null);
          void refresh();
        }}
      />
    );
  else if (question)
    content = (
      <Practice
        key={question.id}
        question={question}
        token={token}
        student={student}
        onProtect={setProtectedAnswer}
        onAnswered={(result) => {
          setProtectedAnswer(false);
          setAttempt(result);
          setQuestion(null);
        }}
        onExit={() => setQuestion(null)}
      />
    );
  else if (pending)
    content = (
      <Screen>
        <Label size={28} strong>
          Finish recording your answer
        </Label>
        <Label>
          An interrupted submission is saved on this phone. Retry it to recover
          the result. It will count only once.
        </Label>
        {error && <ErrorNotice message={error} />}
        <Button
          title="Recover my answer"
          loading={busy}
          onPress={() => void retryPending()}
        />
      </Screen>
    );
  else {
    content = (
      <View style={{ flex: 1 }}>
        <View style={{ padding: 16, gap: 12 }}>
          <Label size={18} strong>
            Otranto Soru
          </Label>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(["IMAT", "TOLC-I", "TOLC-F"] as Exam[]).map((e) => (
              <Pressable
                key={e}
                accessibilityRole="radio"
                accessibilityLabel={`${e} practice`}
                accessibilityState={{ checked: e === exam, disabled: busy }}
                disabled={busy}
                onPress={() => void selectExam(e)}
                style={({ pressed }) => ({
                  minHeight: 48,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: e === exam ? t.accentSoft : t.surface,
                  borderWidth: 1,
                  borderColor: e === exam ? t.accent : t.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Label strong={e === exam}>{e}</Label>
              </Pressable>
            ))}
          </View>
        </View>
        {error && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <ErrorNotice message={error} onRetry={() => void refresh()} />
          </View>
        )}
        {busy && <ActivityIndicator color={t.accent} />}
        <View style={{ flex: 1 }}>
          {tab === "uploads" ? (
            <Uploads token={token} onBack={() => setTab("settings")} />
          ) : tab === "reviews" && student.role === "admin" ? (
            <ReviewQueue token={token} onBack={() => setTab("settings")} />
          ) : tab === "settings" ? (
            <Settings
              student={student}
              onLogout={() => void logout()}
              onUploads={() => setTab("uploads")}
              onReview={() => setTab("reviews")}
            />
          ) : data?.daily.exam === exam && data.studentId === student.id ? (
            tab === "today" ? (
              <Today
                student={student}
                daily={data.daily}
                performance={data.stats}
                onPractice={setQuestion}
                onReminders={() => setTab("settings")}
              />
            ) : tab === "mistakes" ? (
              <Mistakes
                mistakes={data.mistakes}
                onRetry={setQuestion}
                onReflect={setAttempt}
              />
            ) : (
              <Performance performance={data.stats} />
            )
          ) : (
            <Screen>
              <Label muted>
                {busy
                  ? "Loading your practice history…"
                  : "Your practice history could not be loaded."}
              </Label>
              {!busy && (
                <Button title="Retry loading" onPress={() => void refresh()} />
              )}
            </Screen>
          )}
        </View>
        <View
          style={{
            borderTopWidth: 1,
            borderColor: t.border,
            padding: 8,
            flexDirection: "row",
            flexWrap: "wrap",
            backgroundColor: t.surface,
          }}
        >
          {(
            [
              ["today", "Today"],
              ["mistakes", "Mistakes"],
              ["progress", "Progress"],
              ["settings", "Account"],
            ] as const
          ).map(([id, title]) => (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityLabel={title}
              accessibilityState={{ selected: tab === id }}
              onPress={() => {
                setTab(id);
                void refresh();
              }}
              style={({ pressed }) => ({
                flexGrow: 1,
                minWidth: 80,
                minHeight: 52,
                justifyContent: "center",
                alignItems: "center",
                padding: 8,
                backgroundColor: tab === id ? t.accentSoft : t.surface,
                opacity: pressed ? 0.7 : 1,
                borderRadius: 8,
              })}
            >
              <Label size={14} strong={tab === id}>
                {title}
              </Label>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <StatusBar style="auto" />
      {content}
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Application />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
