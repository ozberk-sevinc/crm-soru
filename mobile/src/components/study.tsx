import React from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { Eyebrow, Label, useTheme } from "./ui";
import type { DayStat } from "../lib/types";
export function Orbit({ size = 92 }: { size?: number }) {
  const t = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle
          cx="60"
          cy="60"
          r="40"
          stroke={t.heroMuted}
          opacity={0.3}
          fill="none"
        />
        <Ellipse
          cx="60"
          cy="60"
          rx="52"
          ry="21"
          rotation="-35"
          origin="60,60"
          stroke={t.lime}
          strokeWidth="1.4"
          fill="none"
        />
        <Ellipse
          cx="60"
          cy="60"
          rx="21"
          ry="52"
          rotation="-35"
          origin="60,60"
          stroke={t.heroMuted}
          opacity={0.5}
          fill="none"
        />
        <Circle cx="60" cy="60" r="9" fill={t.lime} />
        <Circle cx="99" cy="30" r="4" fill={t.lime} />
        <Path d="M25 92h10M30 87v10" stroke={t.heroMuted} strokeWidth="1.5" />
      </Svg>
    </View>
  );
}
export function ActivityBars({ week }: { week: DayStat[] }) {
  const t = useTheme();
  const max = Math.max(1, ...week.map((d) => d.attempts));
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-end" }}>
        {week.map((d) => {
          const date = new Date(`${d.day}T12:00:00Z`);
          return (
            <View
              key={d.day}
              accessibilityLabel={`${d.day}: ${d.correct} correct out of ${d.attempts}`}
              style={{ flex: 1, alignItems: "center", gap: 8 }}
            >
              <Label size={11} muted>
                {d.attempts}
              </Label>
              <View
                style={{
                  height: 100,
                  width: "100%",
                  justifyContent: "flex-end",
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: t.accentSoft,
                }}
              >
                <View
                  style={{
                    height: `${(d.attempts / max) * 100}%`,
                    minHeight: d.attempts ? 6 : 0,
                    backgroundColor: t.accent,
                    borderRadius: 8,
                  }}
                />
              </View>
              <Label size={11} muted>
                {date.toLocaleDateString(undefined, {
                  weekday: "narrow",
                  timeZone: "UTC",
                })}
              </Label>
            </View>
          );
        })}
      </View>
      <Eyebrow>QUESTIONS ANSWERED · LAST 7 DAYS</Eyebrow>
    </View>
  );
}
