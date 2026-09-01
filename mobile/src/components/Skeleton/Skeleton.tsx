import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { R, S } from "../../theme";
import { styles } from "./Skeleton.styles";
import type { SkeletonListProps, SkeletonProps } from "./Skeleton.types";

/**
 * A grey block that breathes while something loads.
 *
 * Preferred to a spinner for lists, because it reserves the space the content
 * will take: the page does not jump when the data lands. The pulse is opacity
 * only, which the native driver can run off the JS thread.
 */
export function Skeleton({ width = "100%", height = 14, radius = R.sm, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: radius, opacity: pulse }, style]}
    />
  );
}

/** The shape of a report card, drawn while the real ones are on their way. */
export function SkeletonList({ count = 4, style }: SkeletonListProps) {
  return (
    <View style={[styles.list, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton width="35%" height={11} />
          <Skeleton width="85%" height={17} style={{ marginTop: S.xs }} />
          <Skeleton width="55%" height={12} />
        </View>
      ))}
    </View>
  );
}
