import { Platform } from "react-native";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
export function googleConfigured(): boolean {
  return !!webClientId && (Platform.OS !== "ios" || !!iosClientId);
}
export async function googleIDToken(): Promise<string | null> {
  if (!googleConfigured())
    throw new Error(
      "Google sign-in is not configured yet. Ask your consultancy to finish the Google OAuth setup.",
    );
  // Load only on demand so invite-only builds still open without Google native setup.
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } =
    await import("@react-native-google-signin/google-signin");
  GoogleSignin.configure({ webClientId, iosClientId, offlineAccess: false });
  try {
    if (Platform.OS === "android")
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    if (!response.data.idToken)
      throw new Error(
        "Google did not return an ID token. Check the Web OAuth client configuration.",
      );
    return response.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED)
      return null;
    if (
      isErrorWithCode(e) &&
      e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
    )
      throw new Error(
        "Google Play Services are unavailable. Update them or use an invite code.",
      );
    throw e;
  }
}
export async function signOutGoogle(): Promise<void> {
  if (!googleConfigured()) return;
  const { GoogleSignin } =
    await import("@react-native-google-signin/google-signin");
  await GoogleSignin.signOut();
}
