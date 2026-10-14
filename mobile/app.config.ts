import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const webId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins = [...(config.plugins ?? [])];
  if (webId || iosId) {
    if (
      !webId?.endsWith(".apps.googleusercontent.com") ||
      !iosId?.endsWith(".apps.googleusercontent.com")
    )
      throw new Error(
        "Set valid Google Web and iOS OAuth client IDs together before building.",
      );
    plugins.push([
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: `com.googleusercontent.apps.${iosId.replace(".apps.googleusercontent.com", "")}`,
      },
    ]);
  }
  return {
    ...config,
    name: config.name ?? "Otranto Soru",
    slug: config.slug ?? "crm-soru",
    plugins,
  };
};
