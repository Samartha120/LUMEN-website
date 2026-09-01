import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C, S, R, F } from "../theme";
import { Button } from "../ui";
import { Icon, IconName } from "../Icon";
import { useT } from "../i18n";

export const SEEN_KEY = "lumen_onboarded";

const SLIDES: { icon: IconName; tint: string; key: string }[] = [
  { icon: "camera", tint: C.brand, key: "onboard.1" },
  { icon: "cpu", tint: C.accent, key: "onboard.2" },
  { icon: "activity", tint: C.sky, key: "onboard.3" },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  async function finish() {
    await AsyncStorage.setItem(SEEN_KEY, "1");
    onDone();
  }

  return (
    <View style={s.wrap}>
      <Pressable onPress={finish} hitSlop={10} style={s.skipWrap}>
        <Text style={s.skip}>{last ? "" : t("onboard.skip")}</Text>
      </Pressable>

      <View style={s.middle}>
        <View style={[s.disc, { backgroundColor: slide.tint }]}>
          <Icon name={slide.icon} size={40} color={slide.tint === C.brand ? C.ink : "#fff"} />
        </View>
        <Text style={s.title}>{t(`${slide.key}.title` as any)}</Text>
        <Text style={s.body}>{t(`${slide.key}.body` as any)}</Text>
      </View>

      <View style={s.dots}>
        {SLIDES.map((_, n) => (
          <View key={n} style={[s.dot, n === i && s.dotOn]} />
        ))}
      </View>

      <Button
        label={last ? t("onboard.start") : t("onboard.next")}
        onPress={() => (last ? finish() : setI(i + 1))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: S.xl, paddingBottom: S.xxl },
  skipWrap: { alignSelf: "flex-end", height: 28, justifyContent: "center" },
  skip: { ...F.caption, fontWeight: "700", color: C.body },
  middle: { flex: 1, justifyContent: "center", alignItems: "center" },
  disc: {
    width: 116, height: 116, borderRadius: 58,
    alignItems: "center", justifyContent: "center", marginBottom: S.xxl,
  },
  title: { ...F.display, textAlign: "center" },
  body: { ...F.body, textAlign: "center", marginTop: S.md, paddingHorizontal: S.sm },
  dots: { flexDirection: "row", justifyContent: "center", gap: 7, marginBottom: S.xl },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.lineStrong },
  dotOn: { width: 22, backgroundColor: C.ink },
});
