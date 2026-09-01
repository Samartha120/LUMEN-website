import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { myComplaints, Complaint } from "../api";
import { readOutbox, flushOutbox, Queued } from "../outbox";
import { C, S, R, F, card, tone, statusLabel, ago, stageOf, STAGES } from "../theme";
import { Chip, Empty, StatusCard, TileRow, BigStat } from "../ui";
import { useT } from "../i18n";

const FILTERS = ["All", "Open", "Resolved"] as const;
type Filter = (typeof FILTERS)[number];

// What a citizen means by "resolved" is not one status, and they should not
// have to learn the workflow's vocabulary to filter their own reports.
const DONE = ["RESOLVED", "CLOSED", "REJECTED"];

/** Which greeting applies now. The wording itself comes from the dictionary. */
function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? "home.morning" : h < 17 ? "home.afternoon" : "home.evening";
}

export default function MyReportsScreen({ onOpen, reloadKey, name }: {
  onOpen: (ref: string) => void;
  reloadKey: number;
  name?: string;
}) {
  const { t } = useT();
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
  const urgent = items.filter((c) => ["HIGH", "CRITICAL"].includes((c.priority ?? "").toUpperCase())).length;

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
            {/* The yellow disc sits behind the greeting, as in the reference:
                one spot of colour to anchor the page, carrying no information. */}
            <View style={s.blob} />
            <Text style={s.hello}>{t(greetingKey() as any)}, {(name ?? "there").split(" ")[0]}</Text>
            <Text style={s.today}>{new Date().toLocaleDateString(undefined, {
              weekday: "long", month: "long", day: "numeric",
            })}</Text>

            <Text style={s.section}>{t("home.latest")}</Text>
            <StatusCard
              ref_={items[0].ref}
              title={items[0].title}
              status={items[0].status}
              priority={items[0].priority}
              onPress={() => onOpen(items[0].ref)}
            />

            <Text style={s.section}>{t("home.glance")}</Text>
            <View style={{ gap: S.md }}>
              <BigStat
                value={String(items.length - resolved)}
                unit={items.length - resolved === 1 ? "open" : "open"}
                label={t("home.stillOpen", { total: items.length })}
              />
              <TileRow
                icon="check-circle" tint="brand"
                title={t("home.resolvedForYou")}
                value={`${resolved} report${resolved === 1 ? "" : "s"}`}
              />
              {queued.length > 0 ? (
                <TileRow
                  icon="wifi-off" tint="coral"
                  title={t("home.waitingToSend")}
                  value={`${queued.length} report${queued.length === 1 ? "" : "s"}`}
                />
              ) : (
                <TileRow
                  icon="alert-triangle" tint="accent"
                  title={t("home.markedUrgent")}
                  value={`${urgent} report${urgent === 1 ? "" : "s"}`}
                />
              )}
            </View>

            <Text style={s.section}>{t("home.all")}</Text>
            <TextInput style={s.search} value={q} onChangeText={setQ}
              placeholder={t("home.search")} placeholderTextColor={C.muted}
              autoCorrect={false} />

            <View style={s.filters}>
              {FILTERS.map((f) => (
                <Chip key={f} label={t(("home.filter" + f) as any)} selected={filter === f} onPress={() => setFilter(f)} />
              ))}
            </View>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <Empty
          icon={error ? "alert-triangle" : items.length ? "search" : "camera"}
          title={error ? t("common.couldNotLoad") : items.length ? t("home.noMatchTitle") : t("home.emptyTitle")}
          body={
            error ??
            (items.length
              ? t("home.noMatchBody")
              : t("home.emptyBody"))
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

const s = StyleSheet.create({
  list: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg },
  listEmpty: { flexGrow: 1, backgroundColor: C.bg, padding: S.xl },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  blob: {
    position: "absolute", top: -34, left: -42, width: 104, height: 104,
    borderRadius: 52, backgroundColor: C.brand,
  },
  hello: { ...F.display, fontSize: 26 },
  today: { ...F.caption, marginTop: 2, marginBottom: S.xxl },
  section: { ...F.overline, marginTop: S.xxl, marginBottom: S.md },

  search: {
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.lineStrong,
    borderRadius: R.pill, paddingHorizontal: S.xl, paddingVertical: 13,
    fontSize: 15, color: C.ink,
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
