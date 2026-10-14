import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const IDENTIFIER = "crm-soru.daily-practice";
const KEY = "crm-soru.reminder";
export interface Reminder {
  enabled: boolean;
  hour: number;
  minute: number;
}
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
export async function loadReminder(): Promise<Reminder> {
  const value = await AsyncStorage.getItem(KEY);
  return value
    ? (JSON.parse(value) as Reminder)
    : { enabled: false, hour: 19, minute: 0 };
}
export async function saveReminder(
  enabled: boolean,
  hour: number,
  minute: number,
): Promise<Reminder> {
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  )
    throw new Error("Enter a valid time, for example 19:00.");
  if (enabled) {
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("daily-practice", {
        name: "Daily practice",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    const current = await Notifications.getPermissionsAsync();
    const permissions = current.granted
      ? current
      : await Notifications.requestPermissionsAsync();
    if (
      !permissions.granted &&
      permissions.ios?.status !==
        Notifications.IosAuthorizationStatus.PROVISIONAL
    )
      throw new Error(
        "Notifications are disabled. Open your phone’s Settings to allow reminders, then retry.",
      );
    // Using one stable ID replaces the previous schedule without duplicating it.
    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFIER,
      content: {
        title: "A little practice, every day",
        body: "Your five questions are ready. Build your IMAT or TOLC confidence.",
        data: { screen: "today" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: "daily-practice",
      },
    });
  } else {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER);
  }
  const reminder = { enabled, hour, minute };
  await AsyncStorage.setItem(KEY, JSON.stringify(reminder));
  return reminder;
}
export async function disableReminder(): Promise<void> {
  const reminder = await loadReminder();
  await saveReminder(false, reminder.hour, reminder.minute);
}
