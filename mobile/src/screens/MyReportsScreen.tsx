import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { myComplaints, Complaint } from "../api";
import { readOutbox, flushOutbox, Queued } from "../outbox";
import { T, priorityColour, statusLabel } from "../theme";

const FILTERS = ["All", "Open", "Resolved"] as const;
type Filter = (typeof FILTERS)[number];

// What a citizen means by "resolved" is not one status, and they should not
// have to know the workflow's vocabulary to filter their own reports.
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

  // Anything queued while offline is pushed out on the next visit here, which
  // is the natural moment: the user has just asked to see their reports.
  useEffect(() => {
    (async () => {
      const before = await readOutbox();
      if (!before.length) return;
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
    return <View style={s.centre}><ActivityIndicator size="large" color={T.navy} /></View>;
  }

  const resolved = items.filter((c) => DONE.includes((c.status ?? "").toUpperCase())).length;

  return (
    <FlatList
      data={shown}
      keyExtractor={(c) => c.id}
      contentContainerStyle={shown.length ? s.list : s.listEmpty}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true); await flushOutbox(); await load(); setRefreshing(false);
        }} />
      }
      ListHeaderComponent={
        items.length ? (
          <View>
            <Text style={s.h1}>My reports</Text>
            <View style={s.stats}>
              <Stat n={items.length} label="filed" />
              <Stat n={items.length - resolved} label="open" />
              <Stat n={resolved} label="resolved" />
            </View>

            {queued.length > 0 && (
              <View style={s.queued}>
                <Text style={s.queuedText}>
                  ⏳ {queued.length} report{queued.length === 1 ? "" : "s"} waiting to send.
                  They will go out automatically when you are back online.
                </Text>
              </View>
            )}

            <TextInput style={s.search} value={q} onChangeText={setQ}
              placeholder="Search your reports" placeholderTextColor={T.muted}
              autoCorrect={false} />

            <View style={s.filters}>
              {FILTERS.map((f) => (
                <Pressable key={f} onPress={() => setFilter(f)}
                  style={[s.chip, filter === f && s.chipOn]}>
                  <Text style={[s.chipText, filter === f && s.chipTextOn]}>{f}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={s.centre}>
          <Text style={s.emptyIcon}>🗒️</Text>
          <Text style={s.emptyTitle}>
            {error ? "Could not load" : items.length ? "Nothing matches" : "Nothing reported yet"}
          </Text>
          <Text style={s.emptyText}>
            {error ??
              (items.length
                ? "Try a different search or filter."
                : "Photograph a pothole, a garbage pile or an open manhole and it will appear here.")}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable style={s.card} onPress={() => onOpen(item.ref)}>
          <View style={s.rowTop}>
            <Text style={s.ref}>{item.ref}</Text>
            <View style={[s.pill, { backgroundColor: priorityColour(item.priority) + "1a" }]}>
              <Text style={[s.pillText, { color: priorityColour(item.priority) }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </View>
          <Text style={s.title} numberOfLines={2}>{item.title}</Text>
          <Text style={s.meta}>
            {item.category ?? "Unclassified"}
            {item.department?.name ? ` · ${item.department.name}` : ""}
            {item.severityScore != null ? ` · severity ${Math.round(item.severityScore)}/100` : ""}
          </Text>
        </Pressable>
      )}
    />
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statN}>{n}</Text>
      <Text style={s.statL}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: 20, paddingBottom: 40, backgroundColor: T.bg },
  listEmpty: { flexGrow: 1, backgroundColor: T.bg, padding: 20 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  h1: { fontSize: 24, fontWeight: "800", color: T.ink, marginBottom: 14 },
  stats: { flexDirection: "row", gap: 10, marginBottom: 14 },
  stat: {
    flex: 1, backgroundColor: T.card, borderRadius: 12, paddingVertical: 12,
    alignItems: "center", borderWidth: 1, borderColor: T.line,
  },
  statN: { fontSize: 20, fontWeight: "800", color: T.navy },
  statL: { fontSize: 11, color: T.muted, marginTop: 2, fontWeight: "600" },
  queued: {
    backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa",
    borderRadius: 10, padding: 12, marginBottom: 14,
  },
  queuedText: { color: "#9a3412", fontSize: 13, lineHeight: 19 },
  search: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: T.ink,
  },
  filters: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
  },
  chipOn: { backgroundColor: T.navy, borderColor: T.navy },
  chipText: { color: T.body, fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#fff" },
  card: {
    backgroundColor: T.card, borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: T.line,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { color: T.accent, fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText: { fontSize: 11, fontWeight: "800" },
  title: { fontSize: 16, fontWeight: "700", color: T.ink, marginTop: 8 },
  meta: { color: T.muted, fontSize: 13, marginTop: 6 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: T.ink },
  emptyText: { color: T.muted, textAlign: "center", marginTop: 8, lineHeight: 20 },
});
