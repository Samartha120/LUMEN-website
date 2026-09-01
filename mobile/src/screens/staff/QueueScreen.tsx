import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { staffComplaints, Complaint } from "../../api";
import { C, S, R, F, card, tone, statusLabel, ago } from "../../theme";
import { Chip, Empty } from "../../ui";
import { Icon } from "../../Icon";

const STATUSES = ["All", "SUBMITTED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED"] as const;
const CATEGORIES = ["All", "ROADS", "WASTE", "WATER"] as const;

/**
 * The whole queue, not just one citizen's reports.
 *
 * The same endpoint the citizen list uses. The server decides what comes back:
 * a citizen is scoped to their own reports in the database query, an engineer
 * to the jobs assigned to them, and a supervisor sees everything. The phone
 * asks the same question and is answered according to who is asking.
 */
export default function QueueScreen({ onOpen, reloadKey }: {
  onOpen: (ref: string) => void;
  reloadKey: number;
}) {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string>("All");
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await staffComplaints({
        status: status === "All" ? undefined : status,
        cat: cat === "All" ? undefined : cat,
      }));
    } catch (e: any) {
      setError(e?.message ?? "Could not load the queue.");
      setItems([]);
    }
  }, [status, cat]);

  useEffect(() => { load(); }, [load, reloadKey]);

  // Search is applied on the device so typing does not fire a request per
  // keystroke; the status and category filters go to the server because they
  // change which rows exist, not just which are shown.
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items ?? [];
    return (items ?? []).filter((c) =>
      c.title.toLowerCase().includes(needle) ||
      c.ref.toLowerCase().includes(needle) ||
      (c.category ?? "").toLowerCase().includes(needle) ||
      (c.zone ?? "").toLowerCase().includes(needle));
  }, [items, q]);

  if (items === null) {
    return <View style={s.centre}><ActivityIndicator size="large" color={C.ink} /></View>;
  }

  return (
    <FlatList
      data={shown}
      keyExtractor={(c) => c.id}
      contentContainerStyle={shown.length ? s.list : s.listEmpty}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={C.ink} onRefresh={async () => {
          setRefreshing(true); await load(); setRefreshing(false);
        }} />
      }
      ListHeaderComponent={
        <View>
          <Text style={s.h1}>Queue</Text>
          <Text style={s.sub}>
            {shown.length} of {items.length} shown
          </Text>

          <TextInput style={s.search} value={q} onChangeText={setQ}
            placeholder="Search ref, title, zone" placeholderTextColor={C.muted}
            autoCorrect={false} />

          <Text style={s.filterLabel}>Status</Text>
          <FlatList
            data={STATUSES as unknown as string[]}
            keyExtractor={(x) => x}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
            renderItem={({ item }) => (
              <Chip
                label={item === "All" ? "All" : statusLabel(item)}
                selected={status === item}
                onPress={() => setStatus(item)}
              />
            )}
          />

          <Text style={s.filterLabel}>Department</Text>
          <View style={s.chips}>
            {CATEGORIES.map((x) => (
              <Chip key={x} label={x === "All" ? "All" : x[0] + x.slice(1).toLowerCase()}
                selected={cat === x} onPress={() => setCat(x)} />
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Empty
          icon={error ? "alert-triangle" : "inbox"}
          title={error ? "Could not load" : "Nothing here"}
          body={error ?? "No complaints match these filters."}
        />
      }
      renderItem={({ item }) => {
        const t = tone(item.priority);
        return (
          <Pressable onPress={() => onOpen(item.ref)}
            style={({ pressed }) => [card, s.row, pressed && { backgroundColor: C.raised }]}>
            <View style={[s.spine, { backgroundColor: t.fg }]} />
            <View style={s.rowBody}>
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
                  {item.zone ? ` · ${item.zone}` : ""}
                  {item.severityScore != null ? ` · sev ${Math.round(item.severityScore)}` : ""}
                </Text>
                <Text style={s.time}>{ago(item.createdAt)}</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={17} color={C.muted} />
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  list: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg },
  listEmpty: { flexGrow: 1, backgroundColor: C.bg, padding: S.xl },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  h1: { ...F.display },
  sub: { ...F.caption, marginTop: 2, marginBottom: S.lg },
  search: {
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.lineStrong,
    borderRadius: R.pill, paddingHorizontal: S.xl, paddingVertical: 12,
    fontSize: 15, color: C.ink,
  },
  filterLabel: { ...F.overline, fontSize: 10, marginTop: S.lg, marginBottom: S.sm },
  chips: { flexDirection: "row", gap: S.sm, paddingRight: S.xl, marginBottom: S.sm },

  row: {
    marginBottom: S.md, padding: 0, flexDirection: "row",
    alignItems: "center", overflow: "hidden", paddingRight: S.md,
  },
  spine: { width: 4, alignSelf: "stretch" },
  rowBody: { flex: 1, padding: S.lg },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { ...F.mono },
  pill: { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.pill },
  pillText: { fontSize: 11, fontWeight: "800" },
  title: { ...F.heading, marginTop: S.sm },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: S.sm, gap: S.sm },
  meta: { ...F.caption, flex: 1 },
  time: { ...F.caption, fontSize: 12 },
});
