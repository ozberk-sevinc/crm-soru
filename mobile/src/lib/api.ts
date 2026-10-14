import type {
  Attempt,
  Daily,
  Exam,
  Mistake,
  Performance,
  Reflection,
  Student,
  Submission,
} from "./types";

const url = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function configurationError(): string | null {
  if (!url)
    return "Set EXPO_PUBLIC_API_URL to your Go API address before starting the app.";
  if (!/^https?:\/\//.test(url))
    return "EXPO_PUBLIC_API_URL must be an http:// or https:// address.";
  if (!__DEV__ && !url.startsWith("https://"))
    return "Production builds require an HTTPS API address.";
  return null;
}
async function request<T>(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const configError = configurationError();
  if (configError) throw new Error(configError);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${url}/v1${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(
        data.error ?? "Request failed. Please retry.",
        response.status,
      );
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(
      "Could not reach the server. Check your connection and retry.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
export const api = {
  enroll: (code: string) =>
    request<{ token: string; student: Student }>("/enroll", undefined, "POST", {
      code,
    }),
  me: (token: string) => request<Student>("/me", token),
  daily: (token: string, exam: Exam) =>
    request<Daily>(`/daily?exam=${exam}`, token),
  performance: (token: string, exam: Exam) =>
    request<Performance>(`/performance?exam=${exam}`, token),
  mistakes: (token: string, exam: Exam) =>
    request<Mistake[]>(`/mistakes?exam=${exam}`, token),
  submit: (token: string, answer: Submission) =>
    request<Attempt>("/attempts", token, "POST", answer),
  reflect: (token: string, id: string, reflection: Reflection) =>
    request<Attempt>(
      `/attempts/${encodeURIComponent(id)}/reflection`,
      token,
      "PATCH",
      reflection,
    ),
  logout: (token: string) =>
    request<{ ok: boolean }>("/session", token, "DELETE"),
};
