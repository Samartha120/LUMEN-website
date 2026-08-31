import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { myComplaints, Complaint } from "../api";
import { readOutbox, flushOutbox, Queued } from "../outbox";
import { C, S, R, F, card, tone, statusLabel, ago } from "../theme";
import { Chip, Empty } from "../ui";

const FILTERS = ["All", "Open", "Resolved"] as const;
type Filter = (typeof FILTERS)[number];

// What a citizen means by "resolved" is not one status, and they should not
// have to learn the workflow's vocabulary to filter their own reports.
const DONE = ["RESOLVED", "CLOSED", "REJECTED"];

export default function MyReportsScreen({ onOpen, reloadKey }: {
  onOpen: (ref: string) => void;
  reloadKey: number;
}) {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [queued, setQueued] = useState<Queued[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const load = useCallback(async () => {
    setQueued(await readOutbox());
    try {
      setError(null);
      setItems(await myComplaints());
    } catch (e: any) {
      setError(e?.message ?? "Could not load your reports.");
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  // Anything queued while offline is pushed out on arriving here, which is the
  // natural moment: the user has just asked to see their reports.
  useEffect(() => {
    (async () => {
      if (!(await readOutbox()).length) return;
      const { sent } = await flushOutbox();
      if (sent.length) load();
      else setQueued(await readOutbox());
    })();
  }, [load, reloadKey]);

  const shown = useMemo(() => {
    if (!items) return [];
    const needle = q.trim().toLowerCase();
    return items.filter((c) => {
      const done = DONE.includes((c.status ?? "").toUpperCase());
      if (filter === "Open" && done) return false;
      if (filter === "Resolved" && !done) return false;
      if (!needle) return true;
      return (
        c.title.toLowerCase().includes(needle) ||
        c.ref.toLowerCase().includes(needle) ||
        (c.category ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, q, filter]);

  if (items === null) {
    return <View style={s.centre}><ActivityIndicator size="large" color={C.brand} /></View>;
  }

  const resolved = items.filter((c) => DONE.includes((c.status ?? "").toUpperCase())).length;

  return (
    <FlatList
      data={shown}
      keyExtractor={(c) => c.id}
      contentContainerStyle={shown.length ? s.list : s.listEmpty}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={C.brand} onRefresh={async () => {
          setRefreshing(true); await flushOutbox(); await load(); setRefreshing(false);
        }} />
      }
      ListHeaderComponent={
        items.length ? (
          <View>
            <Text style={s.h1}>My reports</Text>

            <View style={s.stats}>
              <Stat n={items.length} label="filed" />
              <Stat n={items.length - resolved} label="open" tint={C.warn} />
              <Stat n={resolved} label="resolved" tint={C.ok} />
            </View>

            {queued.length > 0 && (
              <View style={s.queued}>
                <Text style={s.queuedTitle}>
                  {queued.length} report{queued.length === 1 ? "" : "s"} waiting to send
                </Text>
                <Text style={s.queuedBody}>
                  Saved on this phone. They go out automatically when you are back online.
                </Text>
              </View>
            )}

            <TextInput style={s.search} value={q} onChangeText={setQ}
              placeholder="Search your reports" placeholderTextColor={C.muted}
              autoCorrect={false} />

            <View style={s.filters}>
              {FILTERS.map((f) => (
                <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
              ))}
            </View>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <Empty
          icon={error ? "⚠️" : items.length ? "🔍" : "📷"}
          title={error ? "Could not load" : items.length ? "Nothing matches" : "No reports yet"}
          body={
            error ??
            (items.length
              ? "Try a different search, or clear the filter."
              : "Photograph a pothole, a garbage pile or an open manhole and it will appear here.")
          }
        />
      }
      renderItem={({ item }) => {
        const t = tone(item.priority);
        return (
          <Pressable
            onPress={() => onOpen(item.ref)}
            style={({ pressed }) => [card, s.card, pressed && s.cardPressed]}
          >
            <View style={[s.accent, { backgroundColor: t.fg }]} />
            <View style={s.cardBody}>
              <View style={s.rowTop}>
                <Text style={s.ref}>{item.ref}</Text>
                <View style={[s.pill, { backgroundColor: t.bg }]}>
                  <Text style={[s.pillText, { color: t.fg }]}>{statusLabel(item.status)}</Text>
                </View>
              </View>
              <Text style={s.title} numberOfLines={2}>{item.title}</Text>
              <View style={s.metaRow}>
                <Text style={s.meta} numberOfLines={1}>
                  {item.category ?? "Unclassified"}
                  {item.department?.name ? ` · ${item.department.name}` : ""}
                </Text>
                <Text style={s.time}>{ago(item.createdAt)}</Text>
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function Stat({ n, label, tint }: { n: number; label: string; tint?: string }) {
  return (
    <View style={[card, s.stat]}>
      <Text style={[s.statN, tint ? { color: tint } : null]}>{n}</Text>
      <Text style={s.statL}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg },
  listEmpty: { flexGrow: 1, backgroundColor: C.bg, padding: S.xl },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  h1: { ...F.display, marginBottom: S.lg },

  stats: { flexDirection: "row", gap: S.md, marginBottom: S.lg },
  stat: { flex: 1, alignItems: "center", paddingVertical: S.md, paddingHorizontal: 0 },
  statN: { fontSize: 22, fontWeight: "800", color: C.brand, letterSpacing: -0.5 },
  statL: { ...F.caption, fontSize: 11, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 },

  queued: {
    backgroundColor: C.warnSoft, borderWidth: 1, borderColor: "#f3ddc0",
    borderRadius: R.md, padding: S.lg, marginBottom: S.lg,
  },
  queuedTitle: { color: C.warn, fontWeight: "800", fontSize: 14 },
  queuedBody: { color: C.warn, fontSize: 13, lineHeight: 19, marginTop: 3, opacity: 0.9 },

  search: {
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line, borderRadius: R.md,
    paddingHorizontal: S.md, paddingVertical: 11, fontSize: 15, color: C.ink,
  },
  filters: { flexDirection: "row", gap: S.sm, marginTop: S.md, marginBottom: S.lg },

  card: { marginBottom: S.md, padding: 0, flexDirection: "row", overflow: "hidden" },
  cardPressed: { backgroundColor: C.raised },
  accent: { width: 4 },
  cardBody: { flex: 1, padding: S.lg },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { ...F.mono },
  pill: { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.pill },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  title: { ...F.heading, marginTop: S.sm },
  metaRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginTop: S.sm,
  },
  meta: { ...F.caption, flex: 1, paddingRight: S.sm },
  time: { ...F.caption, fontSize: 12 },
});
