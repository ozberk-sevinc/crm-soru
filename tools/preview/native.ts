export * from "react-native-web";
export const Alert = {
  alert: (title: string, message: string, buttons: any[]) => {
    if (window.confirm(title + "\n" + message))
      buttons?.find((b) => b.onPress)?.onPress();
  },
};
export const Linking = { openSettings: async () => {} };
