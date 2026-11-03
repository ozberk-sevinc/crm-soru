import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, useTheme } from "../../mobile/src/components/ui";
import { AppHeader, BottomNav } from "../../mobile/src/components/chrome";
import { Today } from "../../mobile/src/screens/Today";
import { Practice, Feedback } from "../../mobile/src/screens/Practice";
import { Performance } from "../../mobile/src/screens/Performance";
import { Mistakes } from "../../mobile/src/screens/Mistakes";
import { Settings } from "../../mobile/src/screens/Settings";
import {
  Uploads,
  ReviewQueue,
  PackageReview,
} from "../../mobile/src/screens/Uploads";
import { Welcome } from "../../mobile/src/screens/Welcome";
import { student, questions, attempts, samplePackage } from "./mock";
import type { Exam, Question } from "../../mobile/src/lib/types";
const pages = [
  ["today", "Today / daily session"],
  ["question", "Practice / multiple choice"],
  ["numeric", "Practice / numeric answer"],
  ["feedback-correct", "Feedback / correct answer"],
  ["feedback-wrong", "Feedback / mistake & reflection"],
  ["mistakes", "Notebook / mistakes & review"],
  ["progress", "Progress / activity & kazanımlar"],
  ["settings", "Account / daily reminders"],
  ["uploads", "Uploads / ZIP & folders"],
  ["reviews", "Admin / approval queue"],
  ["reviewdetail", "Admin / package inspection"],
  ["login", "Welcome / Google & invite sign-in"],
];
function Preview() {
  const [screen, setScreen] = useState("today");
  const [exam, setExam] = useState<Exam>("IMAT");
  const [question, setQuestion] = useState<any>(questions[0]);
  const [result, setResult] = useState<any>(null);
  const [version, setVersion] = useState(0);
  const t = useTheme();
  const bank = questions.filter((q) => q.exam === exam);
  const history = attempts.filter((a) => a.question.exam === exam);
  const latest = new Map(history.map((a) => [a.question_id, a]));
  const wrong = history
    .filter((a) => !a.correct)
    .filter(
      (a, i, list) =>
        list.findLastIndex((b) => b.question_id === a.question_id) === i,
    )
    .map((a) => ({
      ...a,
      resolved: latest.get(a.question_id)?.correct ?? false,
    }));
  const outcomes = Array.from(
    new Map(bank.flatMap((q) => q.outcomes).map((o) => [o.id, o])).values(),
  ).map((o) => {
    const rows = Array.from(latest.values()).filter((a) =>
      a.question.outcomes.some((x: any) => x.id === o.id),
    );
    const correct = rows.filter((a) => a.correct).length;
    return {
      ...o,
      attempts: rows.length,
      correct,
      accuracy: rows.length ? Math.round((correct / rows.length) * 100) : 0,
    };
  });
  const correct = history.filter((a) => a.correct).length;
  const stats = {
    attempts: history.length,
    correct,
    accuracy: history.length ? Math.round((correct / history.length) * 100) : 0,
    streak: history.length ? 4 : 0,
    unresolved: wrong.filter((a) => !a.resolved).length,
    average_seconds: history.length
      ? Math.round(
          history.reduce((n, a) => n + a.duration_seconds, 0) / history.length,
        )
      : 0,
    outcomes,
    week: [
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ].map((day) => {
      const rows = history.filter((a) => a.at.startsWith(day));
      return {
        day,
        attempts: rows.length,
        correct: rows.filter((a) => a.correct).length,
      };
    }),
  };
  function navigate(id: string) {
    setScreen(id);
    setResult(null);
    if (["question", "numeric"].includes(id)) {
      const type = id === "numeric" ? "numeric" : "single_choice";
      const q =
        bank.find((q) => q.type === type) ??
        questions.find((q) => q.type === type);
      setQuestion(q);
    }
  }
  function practice(q: Question) {
    setQuestion(q);
    setResult(null);
    setScreen(q.type === "numeric" ? "numeric" : "question");
  }
  const chrome = [
    "today",
    "mistakes",
    "progress",
    "settings",
    "uploads",
    "reviews",
    "reviewdetail",
  ].includes(screen);
  const feedback =
    result ??
    attempts.find((a) => a.correct === (screen === "feedback-correct"))!;
  const index = pages.findIndex((p) => p[0] === screen);
  return (
    <>
      <div className="sp-controls">
        <label htmlFor="sp-screen">Explore every screen</label>
        <div className="sp-picker">
          <button
            type="button"
            aria-label="Previous screen"
            onClick={() =>
              navigate(pages[(index - 1 + pages.length) % pages.length][0])
            }
          >
            ←
          </button>
          <select
            id="sp-screen"
            value={screen}
            onChange={(e) => navigate(e.target.value)}
          >
            {pages.map(([id, title]) => (
              <option value={id} key={id}>
                {title}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Next screen"
            onClick={() => navigate(pages[(index + 1) % pages.length][0])}
          >
            →
          </button>
        </div>
        <span className="sp-caption">
          {index + 1} / {pages.length} screens · Interactive demo data
        </span>
      </div>
      <div
        className="sp-phone"
        style={{ background: t.background }}
        key="phone"
      >
        {chrome && (
          <AppHeader
            exam={exam}
            onExam={setExam}
            name={student.name}
            onAccount={() => navigate("settings")}
          />
        )}
        {screen === "today" && (
          <Today
            student={student as any}
            daily={{
              day: "2026-11-03",
              exam,
              goal: 5,
              completed: exam === "IMAT" ? 2 : 0,
              questions: bank.slice(0, exam === "IMAT" ? 3 : 5),
            }}
            performance={stats}
            onPractice={practice}
            onReminders={() => navigate("settings")}
          />
        )}
        {["question", "numeric"].includes(screen) && (
          <Practice
            key={question.id + screen}
            question={question}
            token="preview"
            student={student as any}
            onProtect={() => {}}
            onExit={() => navigate("today")}
            onAnswered={(a) => {
              setResult(a);
              setScreen(a.correct ? "feedback-correct" : "feedback-wrong");
              setVersion(version + 1);
            }}
          />
        )}
        {screen.startsWith("feedback") && (
          <Feedback
            key={feedback.id}
            attempt={feedback}
            token="preview"
            onNext={() => {
              navigate("today");
              setVersion(version + 1);
            }}
          />
        )}
        {screen === "mistakes" && (
          <Mistakes
            mistakes={wrong}
            onRetry={practice}
            onReflect={(a) => {
              setResult(a);
              setScreen("feedback-wrong");
            }}
          />
        )}
        {screen === "progress" && <Performance performance={stats} />}
        {screen === "settings" && (
          <Settings
            student={student as any}
            onLogout={() => navigate("login")}
            onUploads={() => navigate("uploads")}
            onReview={() => navigate("reviews")}
          />
        )}
        {screen === "uploads" && (
          <Uploads token="preview" onBack={() => navigate("settings")} />
        )}
        {screen === "reviews" && (
          <ReviewQueue token="preview" onBack={() => navigate("settings")} />
        )}
        {screen === "reviewdetail" && (
          <PackageReview
            token="preview"
            detail={samplePackage() as any}
            onBack={() => navigate("reviews")}
            onReviewed={() => navigate("reviews")}
          />
        )}
        {screen === "login" && <Welcome onEnroll={() => navigate("today")} />}
        {chrome && <BottomNav tab={screen} onTab={navigate} />}
      </div>
    </>
  );
}
const root = document.getElementById("crm-soru-redesign-root");
if (root)
  createRoot(root).render(
    <ThemeProvider>
      <Preview />
    </ThemeProvider>,
  );
