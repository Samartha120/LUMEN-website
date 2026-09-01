import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { C, S, R, F, card } from "../theme";
import { Icon } from "../Icon";
import { useT } from "../i18n";

/**
 * Answers to the questions this app actually raises.
 *
 * Written to be honest about what the detector does and does not do. A citizen
 * who is told the model is infallible will report it as broken the first time
 * it misses something; one who is told it misses a photograph in ten will take
 * a second picture instead.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "What can I report?",
    a: "Potholes, garbage piles and open manholes. The app works out which of these it is from your photograph — you do not have to choose.",
  },
  {
    q: "Why does it want a photograph?",
    a: "The class, the severity and the department that gets the job are all read from the picture. A report without one cannot be routed, so the photo is the one thing that is required.",
  },
  {
    q: "What does 'Check what the AI sees' do?",
    a: "It runs the detector over your photo and shows you what it found, before anything is filed. Nothing is saved when you use it, so you can try three angles and only send the best one.",
  },
  {
    q: "It found nothing in my photo. Is my report useless?",
    a: "No. You can still file it and a supervisor will look at it by hand. The detector misses roughly one photograph in ten, usually when the damage is far away or the light is poor. Getting closer helps more than anything else.",
  },
  {
    q: "Someone already reported this. Should I bother?",
    a: "Yes. The app will tell you it looks like an existing report, and file yours anyway. Repeat reports raise a complaint's priority, so yours is the reason it gets fixed sooner.",
  },
  {
    q: "What happens after I file?",
    a: "It is classified, scored for severity and routed to a department automatically. You will see it move from Filed to In progress to Resolved, and get an update each time it changes.",
  },
  {
    q: "Do I need a signal?",
    a: "No. Without one your report is saved on this phone and sent by itself when you are back online. You can see anything waiting under Profile.",
  },
  {
    q: "Who can see my reports?",
    a: "You and the municipal staff handling them. The list you see is scoped in the database query on the server, so another resident's report is never sent to your phone in the first place.",
  },
];

export default function HelpScreen({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Pressable onPress={onBack} hitSlop={12} style={s.backRow}>
        <Icon name="chevron-left" size={18} color={C.ink} />
        <Text style={s.back}>Profile</Text>
      </Pressable>

      <Text style={s.h1}>{t("help.title")}</Text>
      <Text style={s.sub}>{t("help.sub")}</Text>

      <View style={{ marginTop: S.xl, gap: S.md }}>
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <Pressable key={item.q} onPress={() => setOpen(isOpen ? null : i)}
              style={({ pressed }) => [card, s.item, pressed && { backgroundColor: C.raised }]}>
              <View style={s.qRow}>
                <Text style={s.q}>{item.q}</Text>
                <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
              </View>
              {isOpen && <Text style={s.a}>{item.a}</Text>}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg, flexGrow: 1 },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: S.lg, marginLeft: -4 },
  back: { color: C.ink, fontWeight: "800", fontSize: 14 },
  h1: { ...F.display },
  sub: { ...F.caption, marginTop: 2 },
  item: { padding: S.lg },
  qRow: { flexDirection: "row", alignItems: "center", gap: S.md },
  q: { ...F.bodyStrong, flex: 1 },
  a: { ...F.body, marginTop: S.md },
});
