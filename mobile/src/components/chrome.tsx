import React from "react";
import { Pressable, Text, View } from "react-native";
import {
  BookOpen,
  ChartNoAxesCombined,
  House,
  UserRound,
} from "lucide-react-native";
import { Eyebrow, Label, styles, useTheme } from "./ui";
import type { Exam } from "../lib/types";
export function Brand() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
      <View
        style={{
          width: 35,
          height: 35,
          borderRadius: 12,
          backgroundColor: t.accent,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <BookOpen size={20} color={t.onAccent} strokeWidth={1.8} />
      </View>
      <Text
        style={{
          color: t.ink,
          fontSize: 27,
          fontWeight: "700",
          letterSpacing: -1.4,
        }}
      >
        soru<Text style={{ color: t.accent }}>.</Text>
      </Text>
      <View
        style={{
          width: 1,
          height: 24,
          backgroundColor: t.border,
          marginHorizontal: 4,
        }}
      />
      <Eyebrow>OTRANTO</Eyebrow>
    </View>
  );
}
export function AppHeader({
  exam,
  onExam,
  busy,
  name,
  onAccount,
}: {
  exam: Exam;
  onExam: (exam: Exam) => void;
  busy?: boolean;
  name: string;
  onAccount: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 22,
        paddingTop: 14,
        paddingBottom: 12,
        gap: 20,
        width: "100%",
        maxWidth: 724,
        alignSelf: "center",
      }}
    >
      <View style={styles.between}>
        <Brand />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open account"
          onPress={onAccount}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: t.accentSoft,
            justifyContent: "center",
            alignItems: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Label size={14} strong color={t.accent}>
            {name
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </Label>
        </Pressable>
      </View>
      <View
        accessibilityRole="radiogroup"
        style={{
          flexDirection: "row",
          backgroundColor: t.accentSoft,
          borderRadius: 16,
          padding: 4,
        }}
      >
        {(["IMAT", "TOLC-I", "TOLC-F"] as Exam[]).map((e) => (
          <Pressable
            key={e}
            accessibilityRole="radio"
            accessibilityLabel={`${e} practice`}
            accessibilityState={{ checked: e === exam, disabled: !!busy }}
            disabled={busy}
            onPress={() => onExam(e)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: e === exam ? t.surface : "transparent",
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Label
              size={13}
              strong={e === exam}
              color={e === exam ? t.ink : t.muted}
            >
              {e}
            </Label>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export const navigation = [
  { id: "today", title: "Today", icon: House },
  { id: "mistakes", title: "Notebook", icon: BookOpen },
  { id: "progress", title: "Progress", icon: ChartNoAxesCombined },
  { id: "settings", title: "Account", icon: UserRound },
] as const;
export function BottomNav({
  tab,
  onTab,
}: {
  tab: string;
  onTab: (tab: (typeof navigation)[number]["id"]) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderTopWidth: 1,
        borderColor: t.border,
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: 4,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          width: "100%",
          maxWidth: 680,
          alignSelf: "center",
        }}
      >
        {navigation.map(({ id, title, icon: Icon }) => {
          const active =
            tab === id ||
            (id === "settings" &&
              ["uploads", "reviews", "reviewdetail"].includes(tab));
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityLabel={title}
              accessibilityState={{ selected: active }}
              onPress={() => onTab(id)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 60,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? t.accentSoft : "transparent",
                }}
              >
                <Icon
                  size={21}
                  strokeWidth={active ? 2.1 : 1.7}
                  color={active ? t.accent : t.muted}
                />
              </View>
              <Label
                size={11}
                strong={active}
                color={active ? t.accent : t.muted}
              >
                {title}
              </Label>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
