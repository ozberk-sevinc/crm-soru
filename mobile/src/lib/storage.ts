import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Exam, Submission } from "./types";

const TOKEN = "crm-soru.session";
export const loadToken = () => SecureStore.getItemAsync(TOKEN);
export const saveToken = (token: string) =>
  SecureStore.setItemAsync(TOKEN, token);
export const deleteToken = () => SecureStore.deleteItemAsync(TOKEN);
export async function loadExam(): Promise<Exam> {
  const value = await AsyncStorage.getItem("crm-soru.exam");
  return value === "TOLC-I" || value === "TOLC-F" ? value : "IMAT";
}
export const saveExam = (exam: Exam) =>
  AsyncStorage.setItem("crm-soru.exam", exam);
// Keep the exact request after a timeout: retrying cannot double-count an answer.
export const loadPending = async (
  studentId: string,
): Promise<Submission | null> => {
  const value = await AsyncStorage.getItem(`crm-soru.pending.${studentId}`);
  return value ? (JSON.parse(value) as Submission) : null;
};
export const savePending = (studentId: string, answer: Submission) =>
  AsyncStorage.setItem(`crm-soru.pending.${studentId}`, JSON.stringify(answer));
export const clearPending = (studentId: string) =>
  AsyncStorage.removeItem(`crm-soru.pending.${studentId}`);
