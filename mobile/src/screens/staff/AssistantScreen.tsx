import { useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { askAssistant, AssistantReply } from "../../api";
import { C, S, R, F, card } from "../../theme";
import { Icon } from "../../Icon";

type Turn =
  | { who: "you"; text: string }
  | { who: "lumen"; reply: AssistantReply }
  | { who: "error"; text: string };

const SUGGESTIONS = [
  "How many open manholes are there?",
  "Which zone has the most potholes?",
  "Show me the highest severity complaints",
  "How many complaints were closed this month?",
];

/**
 * Ask the queue a question in English.
 *
 * The answer comes from the same assistant the web console uses, which reads
 * the database rather than inventing prose: every reply carries the intent it
 * parsed, how confident it was, and where the answer came from. Those are
 * shown rather than hidden, because a supervisor acting on a number needs to
 * know whether it was counted or guessed.
 */
export default function AssistantScreen() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  async function send(message: string) {
    const q = message.trim();
    if (!q || busy) return;
    setText("");
    setTurns((t) => [...t, { who: "you", text: q }]);
    setBusy(true);
    try {
      const reply = await askAssistant(q);
      setTurns((t) => [...t, { who: "lumen", reply }]);
    } catch (e: any) {
      setTurns((t) => [...t, { who: "error", text: e?.message ?? "The assistant did not answer." }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scroller}
        contentContainerStyle={s.wrap}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
      >
        {turns.length === 0 ? (
          <View style={s.intro}>
            <View style={s.disc}><Icon name="message-circle" size={26} color={C.ink} /></View>
            <Text style={s.introTitle}>Ask the queue</Text>
            <Text style={s.introBody}>
              Plain English. The answer is counted from the database, not written
              from memory — and every reply tells you where it came from.
            </Text>
            <View style={s.suggestions}>
              {SUGGESTIONS.map((q) => (
                <Pressable key={q} onPress={() => send(q)}
                  style={({ pressed }) => [s.suggestion, pressed && { backgroundColor: C.raised }]}>
                  <Text style={s.suggestionText}>{q}</Text>
                  <Icon name="arrow-up-right" size={15} color={C.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          turns.map((t, i) => <TurnView key={i} turn={t} />)
        )}
        {busy && (
          <View style={s.thinking}>
            <ActivityIndicator size="small" color={C.ink} />
            <Text style={s.thinkingText}>Reading the database…</Text>
          </View>
        )}
      </ScrollView>

      <View style={s.composer}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Ask about the queue"
          placeholderTextColor={C.muted}
          onSubmitEditing={() => send(text)}
          returnKeyType="send"
          maxLength={500}
        />
        <Pressable
          onPress={() => send(text)}
          disabled={!text.trim() || busy}
          style={({ pressed }) => [
            s.sendBtn,
            (!text.trim() || busy) && { opacity: 0.4 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Icon name="arrow-up" size={20} color={C.brand} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.who === "you") {
    return (
      <View style={s.youWrap}>
        <View style={s.you}><Text style={s.youText}>{turn.text}</Text></View>
      </View>
    );
  }
  if (turn.who === "error") {
    return (
      <View style={[card, s.lumen, { borderColor: "#f6cfcc", backgroundColor: C.badSoft }]}>
        <Text style={{ color: C.bad, fontSize: 14, lineHeight: 20 }}>{turn.text}</Text>
      </View>
    );
  }

  const r = turn.reply;
  const rows = Array.isArray(r.rows) ? r.rows.slice(0, 6) : [];
  return (
    <View style={[card, s.lumen]}>
      <Text style={s.answer}>{r.answer}</Text>

      {rows.length > 0 && (
        <View style={s.rows}>
          {rows.map((row, i) => (
            <View key={i} style={s.row}>
              {row.ref ? <Text style={s.rowRef}>{String(row.ref)}</Text> : null}
              <Text style={s.rowText} numberOfLines={1}>
                {String(row.title ?? Object.values(row)[0] ?? "")}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Shown on purpose. A number a supervisor is about to act on should say
          whether it was counted or guessed. */}
      <View style={s.provenance}>
        <Text style={s.provText}>{r.intent}</Text>
        <Text style={s.provDot}>·</Text>
        <Text style={s.provText}>{Math.round((r.confidence ?? 0) * 100)}% confident</Text>
        <Text style={s.provDot}>·</Text>
        <Text style={s.provText}>from the {r.source}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: S.xl, paddingBottom: S.lg, flexGrow: 1 },

  intro: { flex: 1, justifyContent: "center", paddingVertical: S.xxl },
  disc: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: C.brand,
    alignItems: "center", justifyContent: "center", marginBottom: S.lg,
  },
  introTitle: { ...F.display },
  introBody: { ...F.body, marginTop: S.sm },
  suggestions: { marginTop: S.xxl, gap: S.sm },
  suggestion: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: S.md,
  },
  suggestionText: { ...F.body, flex: 1, color: C.ink },

  youWrap: { alignItems: "flex-end", marginBottom: S.md },
  you: {
    backgroundColor: C.dark, borderRadius: R.lg, borderBottomRightRadius: 6,
    paddingHorizontal: S.lg, paddingVertical: S.md, maxWidth: "85%",
  },
  youText: { color: "#fff", fontSize: 15, lineHeight: 21 },

  lumen: { padding: S.lg, marginBottom: S.lg, borderBottomLeftRadius: 6 },
  answer: { ...F.body, color: C.ink, fontSize: 15 },
  rows: { marginTop: S.md, borderTopWidth: 1, borderTopColor: C.line },
  row: {
    flexDirection: "row", alignItems: "center", gap: S.sm,
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  rowRef: { ...F.mono, fontSize: 11 },
  rowText: { ...F.caption, flex: 1 },

  provenance: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: S.md },
  provText: { ...F.caption, fontSize: 11, textTransform: "lowercase" },
  provDot: { ...F.caption, fontSize: 11 },

  thinking: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingVertical: S.md },
  thinkingText: { ...F.caption },

  composer: {
    flexDirection: "row", alignItems: "center", gap: S.sm,
    paddingHorizontal: S.xl, paddingVertical: S.md,
    borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.surface,
  },
  input: {
    flex: 1, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.line,
    borderRadius: R.pill, paddingHorizontal: S.lg, paddingVertical: 12,
    fontSize: 15, color: C.ink,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.dark,
    alignItems: "center", justifyContent: "center",
  },
});
