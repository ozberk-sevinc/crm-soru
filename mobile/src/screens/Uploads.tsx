import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, View } from "react-native";
import * as Crypto from "expo-crypto";
import {
  Button,
  Card,
  ErrorNotice,
  Field,
  Label,
  Screen,
  Section,
  styles,
  useTheme,
} from "../components/ui";
import { api, ApiError } from "../lib/api";
import {
  pickQuestionFiles,
  pickQuestionFolder,
  uploadQuestions,
} from "../lib/uploads";
import type { UploadFile } from "../lib/uploads";
import type { ImportDetail, ImportSummary, BankQuestion } from "../lib/types";

function PackageCard({
  item,
  onOpen,
}: {
  item: ImportSummary;
  onOpen?: () => void;
}) {
  const t = useTheme();
  return (
    <Card>
      <Label
        strong
        color={
          item.status === "rejected"
            ? t.danger
            : item.status === "approved"
              ? t.accent
              : t.gold
        }
      >
        {item.status.toUpperCase()}
      </Label>
      <Label size={21} strong>
        {item.title}
      </Label>
      <Label>
        {item.question_count} questions · {item.outcome_count} kazanımlar
      </Label>
      <Label muted>
        {item.exams.join(" · ")} · {item.uploader_name}
      </Label>
      <Label size={13} muted>
        Submitted {new Date(item.created_at).toLocaleString()}
      </Label>
      {!!item.review_note && <Label>Admin note: {item.review_note}</Label>}
      {item.status === "pending" && (
        <Label size={13} muted>
          Waiting for approval. These questions are not in practice yet.
        </Label>
      )}
      {onOpen && <Button title="Review this package" quiet onPress={onOpen} />}
    </Card>
  );
}
function UploadComposer({
  token,
  onSubmitted,
}: {
  token: string;
  onSubmitted: (item: ImportSummary) => void;
}) {
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const requestId = useRef(Crypto.randomUUID());
  async function pick(folder: boolean) {
    setBusy(true);
    setError("");
    try {
      const selected = folder
        ? await pickQuestionFolder()
        : await pickQuestionFiles();
      if (selected) {
        setFiles(selected);
        setUncertain(false);
        requestId.current = Crypto.randomUUID();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not read the selection. Use a ZIP or select JSON files instead.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const item = await uploadQuestions(
        token,
        title,
        requestId.current,
        files,
      );
      setFiles([]);
      setTitle("");
      setUncertain(false);
      requestId.current = Crypto.randomUUID();
      onSubmitted(item);
    } catch (e) {
      setUncertain(!(e instanceof ApiError && e.status < 500));
      setError(e instanceof Error ? e.message : "Upload failed. Retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Label size={22} strong>
        Submit a question package
      </Label>
      <Label muted>
        Upload one ZIP, choose a folder, or select its JSON files. Each package
        must follow the question-bank format, including answers and kazanımlar.
      </Label>
      <Field
        accessibilityLabel="Question package title"
        placeholder="Package title, e.g. IMAT Biology · Week 2"
        value={title}
        maxLength={120}
        editable={!busy && !uncertain}
        onChangeText={(value) => {
          setTitle(value);
          requestId.current = Crypto.randomUUID();
        }}
      />
      <Button
        quiet
        title="Choose ZIP or JSON files"
        disabled={busy || uncertain}
        onPress={() => void pick(false)}
      />
      <Button
        quiet
        title="Choose question folder"
        disabled={busy || uncertain}
        onPress={() => void pick(true)}
      />
      {!!files.length && (
        <>
          <Label strong>
            {files.length} selected ·{" "}
            {(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(0)} KiB
          </Label>
          {files.slice(0, 5).map((f) => (
            <Label size={13} muted key={f.name}>
              {f.name}
            </Label>
          ))}
          {files.length > 5 && (
            <Label size={13} muted>
              + {files.length - 5} more files
            </Label>
          )}
        </>
      )}
      {error && <ErrorNotice message={error} />}
      {uncertain && (
        <Label muted size={13}>
          Retry this exact package to avoid duplicate submissions. Your upload
          history may already show it.
        </Label>
      )}
      <Button
        title={uncertain ? "Retry this upload" : "Send for admin approval"}
        disabled={!title.trim() || !files.length}
        loading={busy}
        onPress={() => void submit()}
      />
      <Label muted size={13}>
        Up to 8 MiB · 100 JSON files · JSON only, no PDF extraction. Folder
        selection depends on your file provider; ZIP upload is the fallback.
      </Label>
    </Card>
  );
}
export function Uploads({
  token,
  onBack,
}: {
  token: string;
  onBack: () => void;
}) {
  const [items, setItems] = useState<ImportSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setItems(await api.imports(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your uploads.");
    } finally {
      setBusy(false);
    }
  }, [token]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.screen,
        { maxWidth: 720, width: "100%", alignSelf: "center", gap: 16 },
      ]}
      refreshing={busy}
      onRefresh={() => void refresh()}
      ListHeaderComponent={
        <View style={{ gap: 20, marginBottom: 16 }}>
          <Button quiet title="Back to account" onPress={onBack} />
          <Section eyebrow="Contribute, then review" title="Question uploads">
            <Label muted>
              Your packages become available to students after an admin approves
              them.
            </Label>
          </Section>
          <UploadComposer
            token={token}
            onSubmitted={(item) => {
              setSuccess(`“${item.title}” is waiting for admin approval.`);
              void refresh();
            }}
          />
          {success && <Label strong>{success}</Label>}
          {error && (
            <ErrorNotice message={error} onRetry={() => void refresh()} />
          )}
          <Section title="Your submissions" />
          {busy && <ActivityIndicator />}
        </View>
      }
      ListEmptyComponent={
        !busy ? (
          <Card>
            <Label muted>No packages submitted yet.</Label>
          </Card>
        ) : null
      }
      renderItem={({ item }) => <PackageCard item={item} />}
    />
  );
}
function QuestionPreview({
  question: q,
  detail,
}: {
  question: BankQuestion;
  detail: ImportDetail;
}) {
  const options = q.options ?? [];
  const answer =
    q.type === "numeric"
      ? `${q.answer.value} (tolerance ${q.answer.tolerance ?? 0})`
      : `${q.answer.option_id}. ${options.find((o) => o.id === q.answer.option_id)?.text ?? ""}`;
  return (
    <Card>
      <Label muted size={13}>
        {q.id} · {q.exam} · {q.subject} · {q.difficulty}
      </Label>
      <Label strong size={20}>
        {q.prompt}
      </Label>
      {options.map((o) => (
        <View key={o.id} style={{ gap: 4 }}>
          <Label>
            {o.id}. {o.text}
          </Label>
          {o.misconception && (
            <Label muted size={13}>
              Wrong-answer hint: {o.misconception}
            </Label>
          )}
        </View>
      ))}
      <Label strong>Correct answer: {answer}</Label>
      <Label>{q.explanation}</Label>
      {q.outcome_ids.map((id) => {
        const o = detail.bank.outcomes.find((o) => o.id === id);
        return (
          <View key={id}>
            <Label strong>{o?.title ?? id}</Label>
            <Label size={14}>{o?.remember}</Label>
          </View>
        );
      })}
    </Card>
  );
}
function PackageReview({
  token,
  detail,
  onBack,
  onReviewed,
}: {
  token: string;
  detail: ImportDetail;
  onBack: () => void;
  onReviewed: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function confirm(decision: "approved" | "rejected") {
    if (decision === "rejected" && !note.trim()) {
      setError("Add a reason so the uploader understands the rejection.");
      return;
    }
    Alert.alert(
      decision === "approved"
        ? "Publish these questions?"
        : "Reject this package?",
      decision === "approved"
        ? `${detail.summary.question_count} questions will be added to the live bank. Existing daily plans stay unchanged; new plans can use them.`
        : "The package will remain out of practice. Its uploader will see your reason.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text:
            decision === "approved" ? "Approve and publish" : "Reject package",
          onPress: () => {
            setBusy(true);
            setError("");
            api
              .reviewImport(token, detail.summary.id, decision, note.trim())
              .then(onReviewed)
              .catch((e) =>
                setError(
                  e instanceof Error ? e.message : "Review could not be saved.",
                ),
              )
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }
  return (
    <FlatList
      data={detail.bank.questions}
      keyExtractor={(q) => q.id}
      contentContainerStyle={[
        styles.screen,
        { maxWidth: 720, width: "100%", alignSelf: "center", gap: 16 },
      ]}
      ListHeaderComponent={
        <View style={{ gap: 20, marginBottom: 16 }}>
          <Button
            quiet
            title="Back to review queue"
            disabled={busy}
            onPress={onBack}
          />
          <Section eyebrow={detail.summary.status} title={detail.summary.title}>
            <Label muted>
              {detail.summary.uploader_name} · {detail.summary.question_count}{" "}
              questions · {detail.summary.exams.join(" / ")}
            </Label>
          </Section>
          {detail.summary.status === "pending" ? (
            <Card>
              <Label strong>
                Review the questions, explanations and kazanımlar below.
              </Label>
              <Field
                accessibilityLabel="Admin review note"
                placeholder="Reason for rejection or optional approval note"
                multiline
                maxLength={1000}
                value={note}
                editable={!busy}
                onChangeText={setNote}
              />
              {error && <ErrorNotice message={error} />}
              <Button
                title="Approve and publish"
                loading={busy}
                onPress={() => confirm("approved")}
              />
              <Button
                title="Reject package"
                quiet
                disabled={busy}
                onPress={() => confirm("rejected")}
              />
            </Card>
          ) : (
            <Card>
              <Label strong>Already {detail.summary.status}</Label>
              <Label>{detail.summary.review_note || "No admin note."}</Label>
            </Card>
          )}
          <Label muted size={13}>
            Uploaded files: {detail.summary.files.join(", ")}
          </Label>
        </View>
      }
      renderItem={({ item }) => (
        <QuestionPreview question={item} detail={detail} />
      )}
    />
  );
}
export function ReviewQueue({
  token,
  onBack,
}: {
  token: string;
  onBack: () => void;
}) {
  const [items, setItems] = useState<ImportSummary[]>([]);
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setItems(await api.imports(token, true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load review queue.");
    } finally {
      setBusy(false);
    }
  }, [token]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function open(id: string) {
    setBusy(true);
    setError("");
    try {
      setDetail(await api.importDetail(token, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load package.");
    } finally {
      setBusy(false);
    }
  }
  if (detail)
    return (
      <PackageReview
        key={detail.summary.id}
        token={token}
        detail={detail}
        onBack={() => setDetail(null)}
        onReviewed={() => {
          setDetail(null);
          void refresh();
        }}
      />
    );
  return (
    <FlatList
      data={items.filter((i) => all || i.status === "pending")}
      keyExtractor={(i) => i.id}
      refreshing={busy}
      onRefresh={() => void refresh()}
      contentContainerStyle={[
        styles.screen,
        { maxWidth: 720, width: "100%", alignSelf: "center", gap: 16 },
      ]}
      ListHeaderComponent={
        <View style={{ gap: 20, marginBottom: 16 }}>
          <Button quiet title="Back to account" onPress={onBack} />
          <Section eyebrow="Admin" title="Question approval queue">
            <Label muted>
              Inspect every package before it becomes available for practice.
            </Label>
          </Section>
          <Button
            quiet
            title={all ? "Show pending only" : "Include reviewed packages"}
            onPress={() => setAll(!all)}
          />
          {error && (
            <ErrorNotice message={error} onRetry={() => void refresh()} />
          )}
        </View>
      }
      ListEmptyComponent={
        !busy ? (
          <Card>
            <Label muted>
              {all
                ? "No question packages yet."
                : "No packages waiting for approval."}
            </Label>
          </Card>
        ) : (
          <ActivityIndicator />
        )
      }
      renderItem={({ item }) => (
        <PackageCard
          item={item}
          onOpen={() => {
            if (!busy) void open(item.id);
          }}
        />
      )}
    />
  );
}
