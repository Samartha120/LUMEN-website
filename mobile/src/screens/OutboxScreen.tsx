import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { readOutbox, removeQueued, flushOutbox, isOnline, Queued } from "../outbox";
import { C, S, R, F, card, ago } from "../theme";
import { Button, Empty } from "../ui";
import { Icon } from "../Icon";

/**
 * The reports this phone is holding.
 *
 * A queue the user cannot see is a queue they cannot trust. This shows exactly
 * what is waiting, why the last attempt failed, and lets them send it now or
 * throw it away — rather than wondering whether the report they filed in a
 * basement car park ever left the building.
 */
export default function OutboxScreen({ onBack, onSent }: {
  onBack: () => void;
  onSent: () => void;
}) {
  const [items, setItems] = useState<Queued[] | null>(null);
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(true);

  const load = useCallback(async () => {
    setItems(await readOutbox());
    setOnline(await isOnline());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sendNow() {
    setSending(true);
    try {
      const { sent, failed } = await flushOutbox();
      await load();
      if (sent.length) onSent();
      Alert.alert(
        sent.length ? "Sent" : "Nothing sent",
        sent.length
          ? `${sent.length} report${sent.length === 1 ? "" : "s"} filed: ${sent.join(", ")}.` +
            (failed ? ` ${failed} still waiting.` : "")
          : "Could not reach the server. They stay on this phone and will go out later.",
      );
    } finally {
      setSending(false);
    }
  }

  if (items === null) {
    return <View style={s.centre}><ActivityIndicator size="large" color={C.ink} /></View>;
  }

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Pressable onPress={onBack} hitSlop={12} style={s.backRow}>
        <Icon name="chevron-left" size={18} color={C.ink} />
        <Text style={s.back}>Profile</Text>
      </Pressable>

      <Text style={s.h1}>Waiting to send</Text>
      <Text style={s.sub}>
        {items.length
          ? `${items.length} report${items.length === 1 ? "" : "s"} saved on this phone${online ? "" : " · you are offline"}`
          : "Nothing is waiting"}
      </Text>

      {items.length === 0 ? (
        <Empty
          icon="check-circle"
          title="All sent"
          body="Anything filed without a signal is kept here until it can be delivered."
        />
      ) : (
        <>
          {items.map((q) => (
            <View key={q.id} style={[card, s.item]}>
              <View style={s.itemTop}>
                {q.photoUris[0] ? (
                  <Image source={{ uri: q.photoUris[0] }} style={s.thumb} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={s.title} numberOfLines={2}>{q.title}</Text>
                  <Text style={s.meta}>
                    {q.photoUris.length} photo{q.photoUris.length === 1 ? "" : "s"}
                    {q.lat != null ? " · located" : " · no location"}
                    {` · queued ${ago(q.queuedAt)}`}
                  </Text>
                </View>
              </View>

              {q.lastError ? (
                <View style={s.err}>
                  <Text style={s.errText}>Last attempt: {q.lastError}</Text>
                </View>
              ) : null}

              <Pressable
                hitSlop={6}
                onPress={() => Alert.alert("Discard this report?",
                  "It has not been sent. This cannot be undone.", [
                    { text: "Keep", style: "cancel" },
                    {
                      text: "Discard", style: "destructive",
                      onPress: async () => { await removeQueued(q.id); load(); },
                    },
                  ])}
              >
                <Text style={s.discard}>Discard</Text>
              </Pressable>
            </View>
          ))}

          <Button
            label={online ? "Send now" : "Try anyway"}
            onPress={sendNow} busy={sending} style={{ marginTop: S.lg }}
          />
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg, flexGrow: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: S.lg, marginLeft: -4 },
  back: { color: C.ink, fontWeight: "800", fontSize: 14 },
  h1: { ...F.display },
  sub: { ...F.caption, marginTop: 2, marginBottom: S.xl },

  item: { padding: S.lg, marginBottom: S.md },
  itemTop: { flexDirection: "row", gap: S.md },
  thumb: { width: 56, height: 56, borderRadius: R.md, backgroundColor: C.raised },
  title: { ...F.bodyStrong },
  meta: { ...F.caption, fontSize: 12, marginTop: 3 },
  err: {
    backgroundColor: C.badSoft, borderRadius: R.sm, padding: S.md, marginTop: S.md,
  },
  errText: { color: C.bad, fontSize: 12, lineHeight: 17 },
  discard: { color: C.bad, fontWeight: "700", fontSize: 13, marginTop: S.md },
});
