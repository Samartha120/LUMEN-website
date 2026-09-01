import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { myComplaints, Complaint } from "../api";
import { C, S, R, F, card, tone, stageOf, STAGES } from "../theme";
import { Empty, BigStat } from "../ui";
import { Icon, IconName } from "../Icon";

/**
 * What your reporting adds up to.
 *
 * Everything here is derived on the device from the reports the citizen can
 * already see. No analytics endpoint is called, because a resident is not
 * entitled to the city-wide figures and asking for them would either be
 * refused or, worse, quietly leak another ward's numbers.
 *
 * The charts are laid out with plain views rather than a charting library. At
 * this size a bar is a rectangle with a width, and a dependency that draws
 * rectangles is a dependency that has to be kept working.
 */

const CATEGORY_ICON: Record<string, IconName> = {
  "Pothole": "alert-circle",
  "Garbage Pile": "trash-2",
  "Open Manhole": "alert-octagon",
  "Closed Manhole": "shield",
};

export default function InsightsScreen({ reloadKey }: { reloadKey: number }) {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await myComplaints());
    } catch (e: any) {
      setError(e?.message ?? "Could not load.");
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const byCategory = new Map<string, number>();
    const byStage = [0, 0, 0];
    let severitySum = 0;
    let severityCount = 0;
    let urgent = 0;

    for (const c of list) {
      const cat = c.category ?? "Unclassified";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
      byStage[stageOf(c.status)] += 1;
      if (c.severityScore != null) { severitySum += c.severityScore; severityCount += 1; }
      if (["HIGH", "CRITICAL"].includes((c.priority ?? "").toUpperCase())) urgent += 1;
    }

    // Last six months, oldest first, so the row reads left to right like a date.
    const months: { label: string; n: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const n = list.filter((c) => {
        const t = new Date(c.createdAt);
        return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
      }).length;
      months.push({ label: d.toLocaleDateString(undefined, { month: "short" }), n });
    }

    return {
      total: list.length,
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
      byStage,
      months,
      urgent,
      avgSeverity: severityCount ? Math.round(severitySum / severityCount) : 0,
      resolvedShare: list.length ? Math.round((byStage[2] / list.length) * 100) : 0,
    };
  }, [items]);

  if (items === null) {
    return <View style={s.centre}><ActivityIndicator size="large" color={C.ink} /></View>;
  }
  if (!items.length) {
    return (
      <ScrollView contentContainerStyle={s.emptyWrap}>
        <Empty
          icon={error ? "alert-triangle" : "bar-chart-2"}
          title={error ? "Could not load" : "Nothing to chart yet"}
          body={error ?? "File a report and this page will show what you have reported and how it is going."}
        />
      </ScrollView>
    );
  }

  const catMax = Math.max(...stats.byCategory.map(([, n]) => n), 1);
  const monthMax = Math.max(...stats.months.map((m) => m.n), 1);

  return (
    <ScrollView
      contentContainerStyle={s.wrap}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={C.ink} onRefresh={async () => {
          setRefreshing(true); await load(); setRefreshing(false);
        }} />
      }
    >
      <Text style={s.h1}>Your impact</Text>
      <Text style={s.sub}>Worked out on this phone from your own reports.</Text>

      <View style={{ gap: S.md, marginTop: S.xl }}>
        <BigStat
          value={String(stats.total)}
          unit={stats.total === 1 ? "report" : "reports"}
          label={`filed, ${stats.resolvedShare}% of them resolved`}
        />
      </View>

      <Text style={s.section}>What you report</Text>
      <View style={[card, s.block]}>
        {stats.byCategory.map(([cat, n], i) => (
          <View key={cat} style={[s.barRow, i > 0 && s.barRowNext]}>
            <View style={s.barHead}>
              <Icon name={CATEGORY_ICON[cat] ?? "help-circle"} size={15} color={C.body} />
              <Text style={s.barLabel} numberOfLines={1}>{cat}</Text>
              <Text style={s.barValue}>{n}</Text>
            </View>
            <View style={s.track}>
              <View style={[s.fill, { width: `${(n / catMax) * 100}%` }]} />
            </View>
          </View>
        ))}
      </View>

      <Text style={s.section}>Where they have got to</Text>
      <View style={[card, s.block]}>
        {STAGES.map((label, i) => {
          const n = stats.byStage[i];
          const pct = stats.total ? Math.round((n / stats.total) * 100) : 0;
          return (
            <View key={label} style={[s.barRow, i > 0 && s.barRowNext]}>
              <View style={s.barHead}>
                <Text style={s.barLabel}>{label}</Text>
                <Text style={s.barValue}>{n} · {pct}%</Text>
              </View>
              <View style={s.track}>
                <View style={[s.fill, {
                  width: `${pct}%`,
                  backgroundColor: i === 2 ? C.ok : i === 1 ? C.accent : C.brand,
                }]} />
              </View>
            </View>
          );
        })}
      </View>

      <Text style={s.section}>Reports per month</Text>
      <View style={[card, s.block]}>
        <View style={s.columns}>
          {stats.months.map((m) => (
            <View key={m.label} style={s.column}>
              <Text style={s.columnValue}>{m.n || ""}</Text>
              <View style={s.columnTrack}>
                <View style={[s.columnFill, {
                  height: `${Math.max(m.n ? 8 : 2, (m.n / monthMax) * 100)}%`,
                  backgroundColor: m.n ? C.ink : C.line,
                }]} />
              </View>
              <Text style={s.columnLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={s.section}>Severity</Text>
      <View style={[card, s.block, s.sevBlock]}>
        <View>
          <Text style={s.sevNum}>{stats.avgSeverity}</Text>
          <Text style={s.sevLabel}>average, out of 100</Text>
        </View>
        <View style={s.sevRight}>
          <Text style={[s.sevNum, { color: tone("HIGH").fg }]}>{stats.urgent}</Text>
          <Text style={s.sevLabel}>marked urgent</Text>
        </View>
      </View>

      <Text style={s.foot}>
        These are your reports only. City-wide figures belong to the supervisor
        console, not to a resident's phone.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg },
  emptyWrap: { flexGrow: 1, backgroundColor: C.bg, justifyContent: "center" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  h1: { ...F.display },
  sub: { ...F.caption, marginTop: 2 },
  section: { ...F.overline, marginTop: S.xxl, marginBottom: S.md },
  block: { padding: S.lg },

  barRow: {},
  barRowNext: { marginTop: S.lg },
  barHead: { flexDirection: "row", alignItems: "center", gap: S.sm, marginBottom: 7 },
  barLabel: { ...F.bodyStrong, flex: 1 },
  barValue: { ...F.caption, fontWeight: "700", color: C.body },
  track: { height: 10, backgroundColor: C.raised, borderRadius: R.pill, overflow: "hidden" },
  fill: { height: 10, borderRadius: R.pill, backgroundColor: C.brand },

  columns: { flexDirection: "row", alignItems: "flex-end", height: 148, gap: S.sm },
  column: { flex: 1, alignItems: "center" },
  columnValue: { ...F.caption, fontSize: 11, fontWeight: "800", color: C.ink, marginBottom: 4 },
  columnTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  columnFill: { width: "100%", borderRadius: R.sm },
  columnLabel: { ...F.caption, fontSize: 11, marginTop: 6 },

  sevBlock: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sevRight: { alignItems: "flex-end" },
  sevNum: { fontSize: 30, fontWeight: "800", color: C.ink, letterSpacing: -1 },
  sevLabel: { ...F.caption, fontSize: 12, marginTop: 2 },

  foot: { ...F.caption, fontSize: 12, marginTop: S.xxl, lineHeight: 18 },
});
