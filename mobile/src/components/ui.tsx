import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import type { ComponentProps, ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  type LucideIcon,
} from "lucide-react-native";

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
  goldSoft: "#F5F3ED",
  hero: "#E5F0E8",
  heroInk: "#192D28",
  heroMuted: "#55665F",
  lime: "#185A44",
  onAccent: "#F5F3ED",
};
const dark: typeof light = {
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
  goldSoft: "#192A23",
  hero: "#294136",
  heroInk: "#F1F5EF",
  heroMuted: "#BAC7BE",
  lime: "#9EE2BD",
  onAccent: "#101C18",
};
export type Palette = typeof light;
const Theme = createContext<Palette>(light);
const ReduceMotion = createContext(true);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduce(v);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return (
    <Theme.Provider value={scheme === "dark" ? dark : light}>
      <ReduceMotion.Provider value={reduce}>{children}</ReduceMotion.Provider>
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
        flexShrink: 1,
      }}
    >
      {children}
    </Text>
  );
}
export function Eyebrow({
  children,
  color,
}: {
  children: ReactNode;
  color?: string;
}) {
  const t = useTheme();
  return (
    <Text
      style={{
        fontSize: 11,
        lineHeight: 18,
        letterSpacing: 1.6,
        fontWeight: "700",
        color: color ?? t.muted,
      }}
    >
      {children}
    </Text>
  );
}
export function Display({
  children,
  size = 36,
  color,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
}) {
  const t = useTheme();
  return (
    <Text
      style={{
        fontSize: size,
        lineHeight: size * 1.12,
        letterSpacing: -1.5,
        fontWeight: "700",
        color: color ?? t.ink,
        flexShrink: 1,
      }}
    >
      {children}
    </Text>
  );
}
export function Reveal({ children }: { children: ReactNode }) {
  const reduce = useContext(ReduceMotion);
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      value.setValue(1);
      return;
    }
    value.setValue(0);
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduce, value]);
  return (
    <Animated.View
      style={{
        opacity: value,
        transform: [
          {
            translateY: value.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
        gap: 24,
      }}
    >
      {children}
    </Animated.View>
  );
}
export function Button({
  title,
  onPress,
  quiet,
  disabled,
  loading,
  icon: Icon,
  tone,
}: {
  title: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  tone?: "hero" | "danger";
}) {
  const t = useTheme();
  const reduce = useContext(ReduceMotion);
  const unavailable = disabled || loading;
  const bg =
    tone === "hero"
      ? t.lime
      : tone === "danger"
        ? t.dangerSoft
        : quiet
          ? t.accentSoft
          : t.accent;
  const ink =
    tone === "hero"
      ? t.hero
      : tone === "danger"
        ? t.danger
        : quiet
          ? t.accent
          : t.onAccent;
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
          backgroundColor: bg,
          opacity: unavailable ? 0.45 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed && !reduce ? 0.98 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {Icon && <Icon size={19} color={ink} strokeWidth={1.8} />}
          <Label size={15} strong color={ink}>
            {title}
          </Label>
          {!Icon && !quiet && (
            <ArrowRight size={19} color={ink} strokeWidth={1.8} />
          )}
        </>
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
          borderColor: tint ? "transparent" : t.border,
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
  return (
    <View style={styles.section}>
      {eyebrow && <Eyebrow>{eyebrow.toUpperCase()}</Eyebrow>}
      <Display size={30}>{title}</Display>
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
        props.multiline && { minHeight: 108, textAlignVertical: "top" },
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
        { backgroundColor: t.dangerSoft, borderColor: "transparent" },
      ]}
    >
      <View style={styles.inline}>
        <CircleAlert size={20} color={t.danger} />
        <Label color={t.danger}>{message}</Label>
      </View>
      {onRetry && <Button quiet title="Retry" onPress={onRetry} />}
    </View>
  );
}
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.screen}
    >
      <View style={styles.content}>
        <Reveal>{children}</Reveal>
      </View>
    </ScrollView>
  );
}
export function Progress({
  value,
  label,
  hero = false,
}: {
  value: number;
  label: string;
  hero?: boolean;
}) {
  const t = useTheme();
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(safe) }}
      style={{
        height: 6,
        borderRadius: 3,
        overflow: "hidden",
        backgroundColor: t.border,
      }}
    >
      <View
        style={{
          height: 6,
          width: `${safe}%`,
          borderRadius: 3,
          backgroundColor: hero ? t.lime : t.accent,
        }}
      />
    </View>
  );
}
export function Choice({
  title,
  selected,
  onPress,
  letter,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  letter?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={letter ? `${letter}. ${title}` : title}
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
      {letter && (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: selected ? t.accent : t.background,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Label strong size={14} color={selected ? t.onAccent : t.muted}>
            {letter}
          </Label>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Label size={15} strong={selected}>
          {title}
        </Label>
      </View>
      {selected && <Check size={18} color={t.accent} />}
    </Pressable>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const t = useTheme();
  const fg =
    tone === "danger"
      ? t.danger
      : tone === "warning"
        ? t.gold
        : tone === "success"
          ? t.accent
          : t.muted;
  const bg =
    tone === "danger"
      ? t.dangerSoft
      : tone === "warning"
        ? t.goldSoft
        : t.accentSoft;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        backgroundColor: bg,
      }}
    >
      <Label size={11} strong color={fg}>
        {children}
      </Label>
    </View>
  );
}
export function IconTile({
  icon: Icon,
  tone = "neutral",
}: {
  icon: LucideIcon;
  tone?: "neutral" | "warning" | "danger";
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor:
          tone === "warning"
            ? t.goldSoft
            : tone === "danger"
              ? t.dangerSoft
              : t.accentSoft,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Icon
        size={22}
        strokeWidth={1.7}
        color={
          tone === "warning" ? t.gold : tone === "danger" ? t.danger : t.accent
        }
      />
    </View>
  );
}
export function ActionRow({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
        opacity: pressed ? 0.65 : 1,
        minHeight: 64,
      })}
    >
      <IconTile icon={Icon} />
      <View style={{ flex: 1, gap: 2 }}>
        <Label strong size={15}>
          {title}
        </Label>
        <Label muted size={12}>
          {subtitle}
        </Label>
      </View>
      <ChevronRight size={18} color={t.muted} />
    </Pressable>
  );
}
export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <Card>
      <IconTile icon={Icon} />
      <Display size={25}>{title}</Display>
      <Label muted size={14}>
        {message}
      </Label>
    </Card>
  );
}
export const styles = StyleSheet.create({
  screen: { padding: 22, paddingTop: 12, paddingBottom: 36, flexGrow: 1 },
  content: { width: "100%", maxWidth: 680, alignSelf: "center" },
  section: { gap: 9 },
  card: { padding: 20, gap: 14, borderWidth: 1, borderRadius: 22 },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    minHeight: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 16,
  },
  choice: {
    padding: 14,
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 16,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  inline: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});
