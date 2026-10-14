import React, { createContext, useContext } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import type { ComponentProps, ReactNode } from "react";

const light = {
  background: "#F5F3ED",
  surface: "#FFFFFF",
  ink: "#192D28",
  muted: "#55665F",
  accent: "#185A44",
  accentSoft: "#E5F0E8",
  border: "#CAD5CD",
  danger: "#9A3028",
  dangerSoft: "#FAEBE7",
  gold: "#805B10",
};
const dark = {
  background: "#101C18",
  surface: "#192A23",
  ink: "#F1F5EF",
  muted: "#BAC7BE",
  accent: "#9EE2BD",
  accentSoft: "#294136",
  border: "#42584A",
  danger: "#FFB4A9",
  dangerSoft: "#4B2624",
  gold: "#E8C877",
};
type Palette = typeof light;
const Theme = createContext<Palette>(light);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  return (
    <Theme.Provider value={scheme === "dark" ? dark : light}>
      {children}
    </Theme.Provider>
  );
}
export const useTheme = () => useContext(Theme);
export function Label({
  children,
  muted,
  size = 16,
  strong,
  color,
}: {
  children: ReactNode;
  muted?: boolean;
  size?: number;
  strong?: boolean;
  color?: string;
}) {
  const t = useTheme();
  return (
    <Text
      style={{
        color: color ?? (muted ? t.muted : t.ink),
        fontSize: size,
        lineHeight: size * 1.45,
        fontWeight: strong ? "700" : "400",
      }}
    >
      {children}
    </Text>
  );
}
/** Button: primary/quiet variants; explicit loading, pressed and disabled feedback. */
export function Button({
  title,
  onPress,
  quiet,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  const t = useTheme();
  const unavailable = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!unavailable, busy: !!loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: quiet ? t.accentSoft : t.accent,
          opacity: unavailable ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={quiet ? t.accent : t.background} />
      ) : (
        <Label size={16} strong color={quiet ? t.accent : t.background}>
          {title}
        </Label>
      )}
    </Pressable>
  );
}
export function Card({
  children,
  tint = false,
}: {
  children: ReactNode;
  tint?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tint ? t.accentSoft : t.surface,
          borderColor: t.border,
        },
      ]}
    >
      {children}
    </View>
  );
}
export function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      {eyebrow && (
        <Label size={12} strong color={t.accent}>
          {eyebrow.toUpperCase()}
        </Label>
      )}
      <Label size={28} strong>
        {title}
      </Label>
      {children}
    </View>
  );
}
export function Field(props: ComponentProps<typeof TextInput>) {
  const t = useTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={t.muted}
      style={[
        styles.input,
        { borderColor: t.border, backgroundColor: t.surface, color: t.ink },
        props.style,
      ]}
    />
  );
}
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.card,
        { backgroundColor: t.dangerSoft, borderColor: t.danger },
      ]}
    >
      <Label color={t.danger}>{message}</Label>
      {onRetry && <Button quiet title="Retry" onPress={onRetry} />}
    </View>
  );
}
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.screen}
    >
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
      style={{
        height: 8,
        borderRadius: 4,
        overflow: "hidden",
        backgroundColor: t.border,
      }}
    >
      <View
        style={{
          height: 8,
          width: `${Math.max(0, Math.min(100, value))}%`,
          backgroundColor: t.accent,
        }}
      />
    </View>
  );
}
export function Choice({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: selected ? t.accent : t.border,
          backgroundColor: selected ? t.accentSoft : t.surface,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Label strong={selected}>{title}</Label>
      {selected && (
        <Label strong color={t.accent}>
          Selected
        </Label>
      )}
    </Pressable>
  );
}
export const styles = StyleSheet.create({
  screen: { padding: 20, paddingBottom: 36, flexGrow: 1 },
  content: { width: "100%", maxWidth: 680, alignSelf: "center", gap: 20 },
  section: { gap: 8 },
  card: { padding: 20, gap: 12, borderWidth: 1, borderRadius: 18 },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
  },
  choice: {
    padding: 16,
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    gap: 4,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
