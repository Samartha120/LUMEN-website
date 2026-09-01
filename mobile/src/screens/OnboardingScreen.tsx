import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C, S, R, F } from "../theme";
import { Button } from "../ui";
import { Icon, IconName } from "../Icon";

export const SEEN_KEY = "lumen_onboarded";

const SLIDES: { icon: IconName; tint: string; title: string; body: string }[] = [
  {
    icon: "camera", tint: C.brand,
    title: "Photograph the damage",
    body: "A pothole, a garbage pile, an open manhole. One picture is all a report needs — you do not have to pick a category or a department.",
  },
  {
    icon: "cpu", tint: C.accent,
    title: "See what the model sees",
    body: "The detector outlines the damage and scores how serious it is, before you file. If the photo is not good enough, you will know while you are still standing there.",
  },
  {
    icon: "activity", tint: C.sky,
    title: "Follow it to Resolved",
    body: "Your report is routed to the right department automatically. You will see it move from Filed to In progress to Resolved, and hear about it each time.",
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
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
        <Text style={s.skip}>{last ? "" : "Skip"}</Text>
      </Pressable>

      <View style={s.middle}>
        <View style={[s.disc, { backgroundColor: slide.tint }]}>
          <Icon name={slide.icon} size={40} color={slide.tint === C.brand ? C.ink : "#fff"} />
        </View>
        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.body}>{slide.body}</Text>
      </View>

      <View style={s.dots}>
        {SLIDES.map((_, n) => (
          <View key={n} style={[s.dot, n === i && s.dotOn]} />
        ))}
      </View>

      <Button
        label={last ? "Get started" : "Next"}
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
