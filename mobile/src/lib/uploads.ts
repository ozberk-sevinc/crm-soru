import * as DocumentPicker from "expo-document-picker";
import { Directory, File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { ApiError, configurationError } from "./api";
import type { ImportSummary } from "./types";

export interface UploadFile {
  uri: string;
  name: string;
  size: number;
}
const LIMIT = 8 * 1024 * 1024;
export function checkSelection(files: UploadFile[]): void {
  if (!files.length)
    throw new Error("Choose at least one JSON bank file or a ZIP.");
  if (files.length > 100)
    throw new Error("A package can include at most 100 JSON files.");
  if (files.reduce((total, f) => total + f.size, 0) > LIMIT)
    throw new Error("Select a package smaller than 8 MiB.");
  const zipped = files.some((f) => /\.zip$/i.test(f.name));
  if (zipped && files.length !== 1)
    throw new Error("Choose one ZIP or a selection of JSON files.");
  for (const f of files) {
    if (!/\.(zip|json)$/i.test(f.name))
      throw new Error(
        "Packages must contain JSON question banks or one ZIP, not PDFs or images.",
      );
    if (/\.json$/i.test(f.name) && f.size > 2 * 1024 * 1024)
      throw new Error("Each JSON file must be smaller than 2 MiB.");
  }
}
export async function pickQuestionFiles(): Promise<UploadFile[] | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const files = result.assets.map((a) => ({
    uri: a.uri,
    name: a.name,
    size: a.size ?? new File(a.uri).size,
  }));
  checkSelection(files);
  return files;
}
export async function pickQuestionFolder(): Promise<UploadFile[]> {
  const root = await Directory.pickDirectoryAsync();
  const files: UploadFile[] = [];
  const visited = new Set<string>();
  let entries = 0;
  async function visit(
    directory: Directory,
    prefix: string,
    depth: number,
  ): Promise<void> {
    if (depth > 11 || visited.has(directory.uri))
      throw new Error(
        "Folder nesting is too deep or circular. Use a ZIP instead.",
      );
    visited.add(directory.uri);
    for (const item of directory.list()) {
      if (++entries > 300)
        throw new Error(
          "This folder contains too many entries. Select a smaller question folder.",
        );
      const relative = prefix + item.name;
      if (item.name === ".DS_Store" || item.name === "__MACOSX") continue;
      if (item instanceof Directory)
        await visit(item, relative + "/", depth + 1);
      else {
        files.push({ uri: item.uri, name: relative, size: item.size });
        if (files.length > 100)
          throw new Error("A package supports at most 100 JSON files.");
      }
      // Yield between native directory reads so the picker state stays responsive.
      await Promise.resolve();
    }
  }
  await visit(root, "", 0);
  checkSelection(files);
  return files;
}
export async function uploadQuestions(
  token: string,
  title: string,
  requestId: string,
  files: UploadFile[],
): Promise<ImportSummary> {
  const error = configurationError();
  if (error) throw new Error(error);
  checkSelection(files);
  const form = new FormData();
  form.append("title", title.trim());
  form.append("request_id", requestId);
  for (const file of files) form.append("files", new File(file.uri), file.name);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "")}/v1/imports`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: controller.signal,
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(
        data.error ?? "Package upload failed.",
        response.status,
      );
    return data as ImportSummary;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new Error(
      "Upload could not be confirmed. Retry the same package, or refresh your uploads to check its status.",
    );
  } finally {
    clearTimeout(timer);
  }
}
