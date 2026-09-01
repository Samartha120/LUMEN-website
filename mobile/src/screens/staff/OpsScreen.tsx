import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import {
  clusters, engineers, assignmentPlan, applyAssignment,
  Cluster, Engineer, Assignment,
} from "../../api";
import { C, S, R, F, card, tone } from "../../theme";
import { Button, Empty, BigStat } from "../../ui";
import { Icon } from "../../Icon";

type Tab = "clusters" | "crew" | "plan";

/**
 * The three operational views, on one screen with a segmented control.
 *
 * They are separate pages in the web console, where there is room. On a phone
 * they are three short answers to the same question — what should we do next —
 * and putting them behind three taps of a tab bar buries them.
 */
export default function OpsScreen({ role, onOpen, reloadKey }: {
  role: string;
  onOpen: (ref: string) => void;
  reloadKey: number;
}) {
  const [tab, setTab] = useState<Tab>("clusters");
  const [cl, setCl] = useState<Awaited<ReturnType<typeof clusters>> | null>(null);
  const [eng, setEng] = useState<Engineer[] | null>(null);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof assignmentPlan>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [applying, setApplying] = useState(false);

  const managerial = ["SUPERVISOR", "ADMINISTRATOR"].includes(role.toUpperCase());

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, b] = await Promise.all([clusters(), engineers()]);
      setCl(a); setEng(b);
      // The optimiser is only offered to the roles allowed to apply it, so a
      // engineer is not shown a plan they cannot act on.
      if (managerial) setPlan(await assignmentPlan());
    } catch (e: any) {
      setError(e?.message ?? "Could not load.");
    }
  }, [managerial]);

  useEffect(() => { load(); }, [load, reloadKey]);

  if (!cl && !error) {
    return <View style={s.centre}><ActivityIndicator size="large" color={C.ink} /></View>;
  }

  return (
    <ScrollView
      contentContainerStyle={s.wrap}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={C.ink} onRefresh={async () => {
          setRefreshing(true); await load(); setRefreshing(false);
        }} />
      }
    >
      <Text style={s.h1}>Operations</Text>
      <Text style={s.sub}>Where to send people, and who is free.</Text>

      <View style={s.segment}>
        {(["clusters", "crew", "plan"] as Tab[]).map((t) => {
          if (t === "plan" && !managerial) return null;
          const on = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)}
              style={[s.segItem, on && s.segItemOn]}>
              <Text style={[s.segText, on && s.segTextOn]}>
                {t === "clusters" ? "Hotspots" : t === "crew" ? "Engineers" : "Auto-assign"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && <View style={s.errBox}><Text style={s.errText}>{error}</Text></View>}

      {tab === "clusters" && cl && (
        <>
          <View style={{ gap: S.md, marginBottom: S.lg }}>
            <BigStat
              value={String(cl.summary.visitsSaved)}
              unit="visits"
              label={`saved by grouping ${cl.summary.complaintsInClusters} complaints into ${cl.summary.clusters} hotspots`}
            />
          </View>
          {cl.clusters.length === 0 ? (
            <Empty icon="map-pin" title="No hotspots"
              body="Open complaints are too spread out to group into a single visit." />
          ) : cl.clusters.map((c) => <ClusterCard key={c.key} cluster={c} onOpen={onOpen} />)}
        </>
      )}

      {tab === "crew" && eng && (
        eng.length === 0
          ? <Empty icon="users" title="No engineers" body="Nobody is registered in this department yet." />
          : eng.map((e) => <EngineerCard key={e.id} engineer={e} />)
      )}

      {tab === "plan" && managerial && (
        plan ? (
          <>
            <View style={[card, s.planHead]}>
              <View style={s.planRow}>
                <Text style={s.planLabel}>Jobs matched</Text>
                <Text style={s.planValue}>{plan.assignments.length}</Text>
              </View>
              <View style={s.planRow}>
                <Text style={s.planLabel}>Total travel</Text>
                <Text style={s.planValue}>{plan.totalDistanceKm.toFixed(1)} km</Text>
              </View>
              <View style={s.planRow}>
                <Text style={s.planLabel}>Against naive assignment</Text>
                <Text style={[s.planValue, { color: C.ok }]}>
                  {plan.costImprovementPct > 0 ? "−" : ""}{Math.abs(Math.round(plan.costImprovementPct))}% cost
                </Text>
              </View>
              <View style={[s.planRow, { borderBottomWidth: 0 }]}>
                <Text style={s.planLabel}>Left unassigned</Text>
                <Text style={s.planValue}>{plan.unassigned.length}</Text>
              </View>
            </View>

            <Button
              label="Apply this plan"
              busy={applying}
              style={{ marginBottom: S.lg }}
              onPress={() => Alert.alert(
                "Apply the plan?",
                `${plan.assignments.length} complaints will be assigned and moved to Assigned. The engineers are notified.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Apply",
                    onPress: async () => {
                      setApplying(true);
                      try {
                        const r = await applyAssignment();
                        await load();
                        Alert.alert("Applied", `${r.applied ?? r.assigned ?? plan.assignments.length} complaints assigned.`);
                      } catch (e: any) {
                        Alert.alert("Could not apply", e?.message ?? "The server refused.");
                      } finally {
                        setApplying(false);
                      }
                    },
                  },
                ])}
            />

            {plan.assignments.map((a, i) => <AssignmentCard key={i} a={a} onOpen={onOpen} />)}
          </>
        ) : <ActivityIndicator color={C.ink} style={{ marginTop: S.xl }} />
      )}
    </ScrollView>
  );
}

function ClusterCard({ cluster, onOpen }: { cluster: Cluster; onOpen: (ref: string) => void }) {
  const t = tone(cluster.worstSeverity >= 60 ? "HIGH" : cluster.worstSeverity >= 35 ? "MEDIUM" : "LOW");
  return (
    <View style={[card, s.item]}>
      <View style={s.itemTop}>
        <View style={[s.tile, { backgroundColor: t.fg }]}>
          <Text style={s.tileNum}>{cluster.members.length}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.itemTitle}>{cluster.category ?? "Mixed"}</Text>
          <Text style={s.itemMeta}>
            {cluster.zone ?? "Unzoned"} · within {Math.round(cluster.spreadM)} m
            {cluster.visitsSaved > 0 ? ` · saves ${cluster.visitsSaved} visit${cluster.visitsSaved === 1 ? "" : "s"}` : ""}
          </Text>
        </View>
      </View>
      <View style={s.members}>
        {cluster.members.slice(0, 4).map((m) => (
          <Pressable key={m.ref} onPress={() => onOpen(m.ref)} style={s.member}>
            <Text style={s.memberRef}>{m.ref}</Text>
            <Text style={s.memberTitle} numberOfLines={1}>{m.title}</Text>
            <Icon name="chevron-right" size={15} color={C.muted} />
          </Pressable>
        ))}
        {cluster.members.length > 4 && (
          <Text style={s.more}>and {cluster.members.length - 4} more</Text>
        )}
      </View>
    </View>
  );
}

function EngineerCard({ engineer }: { engineer: Engineer }) {
  const free = engineer.status?.toUpperCase() === "AVAILABLE";
  return (
    <View style={[card, s.item]}>
      <View style={s.itemTop}>
        <View style={[s.tile, { backgroundColor: free ? C.ok : C.warn }]}>
          <Icon name="user" size={19} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.itemTitle}>{engineer.name}</Text>
          <Text style={s.itemMeta}>
            {engineer.code}
            {engineer.zone ? ` · ${engineer.zone}` : ""}
            {engineer.department?.name ? ` · ${engineer.department.name}` : ""}
          </Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: free ? C.okSoft : C.warnSoft }]}>
          <Text style={[s.statusText, { color: free ? C.ok : C.warn }]}>
            {engineer.status}
          </Text>
        </View>
      </View>
      <Text style={s.itemMeta}>
        {engineer.resolvedJobs} resolved · skills: {engineer.skills || "—"}
      </Text>
    </View>
  );
}

function AssignmentCard({ a, onOpen }: { a: Assignment; onOpen: (ref: string) => void }) {
  return (
    <Pressable onPress={() => onOpen(a.complaint.ref)}
      style={({ pressed }) => [card, s.item, pressed && { backgroundColor: C.raised }]}>
      <View style={s.itemTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.ref}>{a.complaint.ref}</Text>
          <Text style={s.itemTitle} numberOfLines={1}>{a.complaint.title}</Text>
        </View>
        <Icon name="chevron-right" size={16} color={C.muted} />
      </View>
      <View style={s.assignRow}>
        <Icon name="arrow-right" size={13} color={C.muted} />
        <Text style={s.itemMeta}>
          {a.engineer.name} ({a.engineer.code}) · {a.distanceKm.toFixed(1)} km
        </Text>
        {a.skillMatch && (
          <View style={s.skill}><Text style={s.skillText}>SKILL MATCH</Text></View>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg, flexGrow: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  h1: { ...F.display },
  sub: { ...F.caption, marginTop: 2 },

  segment: {
    flexDirection: "row", backgroundColor: C.raised, borderRadius: R.pill,
    padding: 4, marginTop: S.xl, marginBottom: S.lg,
  },
  segItem: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: R.pill },
  segItemOn: { backgroundColor: C.surface },
  segText: { ...F.caption, fontWeight: "700" },
  segTextOn: { color: C.ink, fontWeight: "800" },

  errBox: { backgroundColor: C.badSoft, borderRadius: R.md, padding: S.md, marginBottom: S.lg },
  errText: { color: C.bad, fontSize: 13 },

  item: { padding: S.lg, marginBottom: S.md },
  itemTop: { flexDirection: "row", alignItems: "center", gap: S.md },
  tile: {
    width: 44, height: 44, borderRadius: R.md,
    alignItems: "center", justifyContent: "center",
  },
  tileNum: { color: "#fff", fontWeight: "800", fontSize: 17 },
  itemTitle: { ...F.bodyStrong },
  itemMeta: { ...F.caption, fontSize: 12, marginTop: 3 },
  ref: { ...F.mono, marginBottom: 2 },

  statusPill: { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.pill },
  statusText: { fontSize: 10, fontWeight: "800" },

  members: { marginTop: S.md, borderTopWidth: 1, borderTopColor: C.line, paddingTop: S.sm },
  member: { flexDirection: "row", alignItems: "center", gap: S.sm, paddingVertical: 7 },
  memberRef: { ...F.mono, fontSize: 11 },
  memberTitle: { ...F.caption, flex: 1 },
  more: { ...F.caption, fontSize: 12, paddingTop: 4 },

  planHead: { padding: S.lg, marginBottom: S.lg },
  planRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: S.md, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  planLabel: { ...F.caption, color: C.body },
  planValue: { ...F.bodyStrong },

  assignRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: S.sm },
  skill: {
    backgroundColor: C.okSoft, paddingHorizontal: S.sm, paddingVertical: 2,
    borderRadius: R.sm, marginLeft: "auto",
  },
  skillText: { color: C.ok, fontSize: 9, fontWeight: "800" },
});
