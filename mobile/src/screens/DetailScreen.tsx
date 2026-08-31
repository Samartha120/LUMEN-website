import { useEffect, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { complaint, mediaUrl, ComplaintDetail, Detection } from "../api";
import { C, S, R, F, card, tone, statusLabel, ago } from "../theme";
import { Meter, SectionTitle } from "../ui";

export default function DetailScreen({ refCode, onBack }: {
  refCode: string;
  onBack: () => void;
}) {
  const [c, setC] = useState<ComplaintDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    complaint(refCode).then(setC).catch((e) => setError(e?.message ?? "Could not load."));
  }, [refCode]);

  if (error) {
    return (
      <View style={s.centre}>
        <Text style={s.err}>{error}</Text>
        <Pressable onPress={onBack} hitSlop={10}><Text style={s.back}>← Back</Text></Pressable>
      </View>
    );
  }
  if (!c) return <View style={s.centre}><ActivityIndicator size="large" color={C.brand} /></View>;

  const image = c.images?.[0];
  // The annotated copy is what the detector produced: boxes for potholes and
  // garbage, an outline for a manhole. Falls back to the original if the
  // service was unavailable when the report was filed.
  const shown = mediaUrl(image?.annotated ?? image?.path);
  let detections: Detection[] = [];
  try {
    detections = image?.detections ? JSON.parse(image.detections) : [];
  } catch {
    detections = [];
  }
  const t = tone(c.priority);

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Pressable onPress={onBack} hitSlop={12} style={s.backRow}>
        <Text style={s.back}>←  My reports</Text>
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
        {c.createdAt ? `  ·  ${ago(c.createdAt)}` : ""}
      </Text>
      {c.address && <Text style={s.address}>📍 {c.address}</Text>}

      {shown && (
        <View style={s.imageWrap}>
          <Image source={{ uri: shown }} style={s.image} resizeMode="cover" />
          <View style={s.imageTag}><Text style={s.imageTagText}>MODEL OUTPUT</Text></View>
        </View>
      )}

      <SectionTitle>What the model found</SectionTitle>
      {detections.length === 0 ? (
        <View style={[card, s.block]}>
          <Text style={s.body}>
            Nothing was detected in this photograph. A supervisor will triage it by hand.
          </Text>
        </View>
      ) : (
        <View style={[card, s.block, { paddingVertical: S.xs }]}>
          {detections.map((d, i) => (
            <View key={i} style={[s.detRow, i === 0 && { borderTopWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.detLabel}>{d.label}</Text>
                <Text style={s.detKind}>{d.polygon ? "outlined" : "boxed"}</Text>
              </View>
              <Text style={s.detConf}>{Math.round(d.confidence * 100)}%</Text>
            </View>
          ))}
        </View>
      )}

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

      <SectionTitle>Progress</SectionTitle>
      <View style={s.timeline}>
        {(c.events ?? []).slice(0, 8).map((e, i, arr) => (
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
  backRow: { marginBottom: S.lg },
  back: { color: C.accent, fontWeight: "700", fontSize: 14 },
  err: { color: C.bad, marginBottom: S.lg, textAlign: "center" },

  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { ...F.mono },
  pill: { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.pill },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  title: { ...F.title, marginTop: S.sm },
  meta: { ...F.caption, marginTop: 6 },
  address: { ...F.caption, marginTop: S.xs },

  imageWrap: { marginTop: S.lg, borderRadius: R.lg, overflow: "hidden", backgroundColor: C.raised },
  image: { width: "100%", height: 250 },
  imageTag: {
    position: "absolute", top: S.md, left: S.md, backgroundColor: "rgba(10,14,25,0.7)",
    paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.sm,
  },
  imageTagText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },

  block: { padding: S.lg },
  body: { ...F.body },
  detRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: S.md,
    borderTopWidth: 1, borderTopColor: C.line,
  },
  detLabel: { ...F.bodyStrong },
  detKind: { ...F.caption, fontSize: 11, marginTop: 1 },
  detConf: { fontSize: 17, fontWeight: "800", color: C.accent },

  sevRow: { flexDirection: "row", alignItems: "baseline" },
  sevNum: { fontSize: 30, fontWeight: "800", color: C.ink, letterSpacing: -1 },
  sevOf: { ...F.caption, marginLeft: 4 },
  sevBand: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },

  timeline: { paddingLeft: 2 },
  event: { flexDirection: "row" },
  rail: { width: 22, alignItems: "center" },
  node: {
    width: 9, height: 9, borderRadius: 5, backgroundColor: C.lineStrong, marginTop: 6,
  },
  nodeFirst: { backgroundColor: C.brand, width: 11, height: 11, borderRadius: 6 },
  line: { flex: 1, width: 1.5, backgroundColor: C.line, marginVertical: 3 },
  eventBody: { flex: 1, paddingBottom: S.lg, paddingLeft: S.sm },
  eventType: { ...F.overline, fontSize: 10, color: C.body },
  eventMsg: { ...F.body, marginTop: 3 },
  eventTime: { ...F.caption, fontSize: 12, marginTop: 3 },
});
