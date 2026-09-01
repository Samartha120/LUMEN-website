import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import {
  complaint, mediaUrl, transition, TRANSITIONS,
  ComplaintDetail, Detection,
} from "../../api";
import { C, S, R, F, card, tone, statusLabel, ago } from "../../theme";
import { Meter, SectionTitle } from "../../ui";
import { Icon } from "../../Icon";

/**
 * A complaint, with the buttons that move it.
 *
 * The available moves come from a copy of the server's state machine, used
 * only to decide which buttons to draw. The server checks again on every
 * request and refuses anything it does not like, so this copy going stale
 * shows a button that fails politely — never one that quietly does the wrong
 * thing.
 */
export default function TriageScreen({ refCode, role, onBack, onChanged, onMeasure }: {
  refCode: string;
  role: string;
  onBack: () => void;
  onChanged: () => void;
  onMeasure: (ref: string) => void;
}) {
  const [c, setC] = useState<ComplaintDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  const load = useCallback(async () => {
    try {
      setC(await complaint(refCode));
    } catch (e: any) {
      setError(e?.message ?? "Could not load.");
    }
  }, [refCode]);

  useEffect(() => { load(); }, [load]);

  async function move(to: string, label: string) {
    setBusy(to);
    try {
      await transition(refCode, to);
      await load();
      onChanged();
    } catch (e: any) {
      Alert.alert("Could not " + label.toLowerCase(), e?.message ?? "The server refused that move.");
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <View style={s.centre}>
        <Text style={s.err}>{error}</Text>
        <Pressable onPress={onBack}><Text style={s.back}>Back</Text></Pressable>
      </View>
    );
  }
  if (!c) return <View style={s.centre}><ActivityIndicator size="large" color={C.ink} /></View>;

  const t = tone(c.priority);
  const image = c.images?.[0];
  const shown = mediaUrl(image?.annotated ?? image?.path);
  let detections: Detection[] = [];
  try { detections = image?.detections ? JSON.parse(image.detections) : []; } catch { detections = []; }

  const moves = (TRANSITIONS[c.status] ?? []).filter((m) => m.roles.includes(role.toUpperCase()));

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Pressable onPress={onBack} hitSlop={12} style={s.backRow}>
        <Icon name="chevron-left" size={18} color={C.ink} />
        <Text style={s.back}>Queue</Text>
      </Pressable>

      <View style={s.head}>
        <Text style={s.ref}>{c.ref}</Text>
        <View style={[s.pill, { backgroundColor: t.bg }]}>
          <Text style={[s.pillText, { color: t.fg }]}>{statusLabel(c.status)}</Text>
        </View>
      </View>
      <Text style={s.title}>{c.title}</Text>
      <Text style={s.meta}>
        {c.category ?? "Unclassified"}
        {c.department?.name ? `  ·  ${c.department.name}` : ""}
        {`  ·  filed ${ago(c.createdAt)}`}
      </Text>
      {c.address ? <Text style={s.meta}>{c.address}</Text> : null}

      {shown && (
        <Pressable onPress={() => setZoom(true)} style={s.imageWrap}>
          <Image source={{ uri: shown }} style={s.image} resizeMode="cover" />
          <View style={s.imageTag}><Text style={s.imageTagText}>MODEL OUTPUT</Text></View>
        </Pressable>
      )}
      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <Pressable style={s.zoomWrap} onPress={() => setZoom(false)}>
          {shown && <Image source={{ uri: shown }} style={s.zoomImage} resizeMode="contain" />}
        </Pressable>
      </Modal>

      {moves.length > 0 && (
        <>
          <SectionTitle>Actions</SectionTitle>
          <View style={{ gap: S.md }}>
            {moves.map((m) => {
              const destructive = m.to === "REJECTED";
              return (
                <Pressable
                  key={m.to}
                  disabled={busy !== null}
                  onPress={() => {
                    if (destructive) {
                      Alert.alert("Reject this complaint?",
                        "It will be closed as invalid or a duplicate. The reporter is told.", [
                          { text: "Cancel", style: "cancel" },
                          { text: "Reject", style: "destructive", onPress: () => move(m.to, m.label) },
                        ]);
                    } else {
                      move(m.to, m.label);
                    }
                  }}
                  style={({ pressed }) => [
                    s.action,
                    destructive ? s.actionBad : s.actionGo,
                    pressed && { opacity: 0.9 },
                    busy !== null && { opacity: 0.6 },
                  ]}
                >
                  {busy === m.to
                    ? <ActivityIndicator color={destructive ? C.bad : C.ink} />
                    : (
                      <Text style={[s.actionText, destructive && { color: C.bad }]}>
                        {m.label}
                      </Text>
                    )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      {moves.length === 0 && (
        <>
          <SectionTitle>Actions</SectionTitle>
          <View style={[card, s.block]}>
            <Text style={s.body}>
              {["CLOSED", "REJECTED"].includes(c.status)
                ? "This complaint is finished. Nothing further to do."
                : `Your role cannot move a complaint out of ${statusLabel(c.status)}.`}
            </Text>
          </View>
        </>
      )}

      {/* Measuring only applies to road damage; the endpoint refuses anything
          else, so the button is not offered for waste or water. */}
      {c.civicCategory === "ROADS" && (
        <>
          <SectionTitle>On site</SectionTitle>
          <Pressable
            onPress={() => onMeasure(refCode)}
            style={({ pressed }) => [s.measure, pressed && { opacity: 0.9 }]}
          >
            <Icon name="edit-3" size={17} color={C.ink} />
            <Text style={s.measureText}>Record measurements</Text>
            <View style={{ flex: 1 }} />
            <Icon name="chevron-right" size={17} color={C.muted} />
          </Pressable>
        </>
      )}

      <SectionTitle>Detection</SectionTitle>
      <View style={[card, s.block]}>
        {detections.length === 0 ? (
          <Text style={s.body}>Nothing detected — this one needs a human decision.</Text>
        ) : detections.map((d, i) => (
          <View key={i} style={[s.detRow, i === 0 && { borderTopWidth: 0, paddingTop: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.detLabel}>{d.label}</Text>
              <Text style={s.detKind}>{d.polygon ? "outlined" : "boxed"}</Text>
            </View>
            <Text style={s.detConf}>{Math.round(d.confidence * 100)}%</Text>
          </View>
        ))}
      </View>

      {c.severityScore != null && (
        <>
          <SectionTitle>Severity</SectionTitle>
          <View style={[card, s.block]}>
            <View style={s.sevRow}>
              <Text style={s.sevNum}>{Math.round(c.severityScore)}</Text>
              <Text style={s.sevOf}>/ 100</Text>
              <View style={{ flex: 1 }} />
              <Text style={[s.sevBand, { color: t.fg }]}>{c.priority ?? ""}</Text>
            </View>
            <View style={{ marginTop: S.md }}>
              <Meter value={c.severityScore} priority={c.priority} />
            </View>
          </View>
        </>
      )}

      <SectionTitle>History</SectionTitle>
      <View style={s.timeline}>
        {(c.events ?? []).slice(0, 10).map((e, i, arr) => (
          <View key={e.id} style={s.event}>
            <View style={s.rail}>
              <View style={[s.node, i === 0 && s.nodeFirst]} />
              {i < arr.length - 1 && <View style={s.line} />}
            </View>
            <View style={s.eventBody}>
              <Text style={s.eventType}>{statusLabel(e.type)}</Text>
              <Text style={s.eventMsg}>{e.message}</Text>
              <Text style={s.eventTime}>{ago(e.createdAt)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg, flexGrow: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: S.xxl, backgroundColor: C.bg },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: S.lg, marginLeft: -4 },
  back: { color: C.ink, fontWeight: "800", fontSize: 14 },
  err: { color: C.bad, marginBottom: S.lg, textAlign: "center" },

  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { ...F.mono },
  pill: { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.pill },
  pillText: { fontSize: 11, fontWeight: "800" },
  title: { ...F.title, marginTop: S.sm },
  meta: { ...F.caption, marginTop: 4 },

  imageWrap: { marginTop: S.lg, borderRadius: R.lg, overflow: "hidden", backgroundColor: C.raised },
  image: { width: "100%", height: 230 },
  imageTag: {
    position: "absolute", top: S.md, left: S.md, backgroundColor: "rgba(10,10,10,0.7)",
    paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.sm,
  },
  imageTagText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },
  zoomWrap: {
    flex: 1, backgroundColor: "rgba(10,10,10,0.94)",
    alignItems: "center", justifyContent: "center",
  },
  zoomImage: { width: "100%", height: "80%" },

  action: {
    borderRadius: R.md, paddingVertical: 16, alignItems: "center",
    justifyContent: "center", minHeight: 54,
  },
  actionGo: { backgroundColor: C.brand },
  actionBad: { backgroundColor: C.badSoft, borderWidth: 1.5, borderColor: "#f6cfcc" },
  actionText: { ...F.bodyStrong, fontSize: 16, fontWeight: "800", color: C.ink },

  measure: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
    borderRadius: R.md, padding: S.lg,
  },
  measureText: { ...F.bodyStrong },

  block: { padding: S.lg },
  body: { ...F.body },
  detRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: S.md,
    borderTopWidth: 1, borderTopColor: C.line,
  },
  detLabel: { ...F.bodyStrong },
  detKind: { ...F.caption, fontSize: 11, marginTop: 1 },
  detConf: { fontSize: 17, fontWeight: "800", color: C.ink },

  sevRow: { flexDirection: "row", alignItems: "baseline" },
  sevNum: { fontSize: 30, fontWeight: "800", color: C.ink, letterSpacing: -1 },
  sevOf: { ...F.caption, marginLeft: 4 },
  sevBand: { fontSize: 12, fontWeight: "800" },

  timeline: { paddingLeft: 2 },
  event: { flexDirection: "row" },
  rail: { width: 22, alignItems: "center" },
  node: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.lineStrong, marginTop: 6 },
  nodeFirst: { backgroundColor: C.ink, width: 11, height: 11, borderRadius: 6 },
  line: { flex: 1, width: 1.5, backgroundColor: C.line, marginVertical: 3 },
  eventBody: { flex: 1, paddingBottom: S.lg, paddingLeft: S.sm },
  eventType: { ...F.overline, fontSize: 10, color: C.body },
  eventMsg: { ...F.body, marginTop: 3 },
  eventTime: { ...F.caption, fontSize: 12, marginTop: 3 },
});
