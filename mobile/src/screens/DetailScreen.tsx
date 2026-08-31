import { useEffect, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { complaint, mediaUrl, ComplaintDetail, Detection } from "../api";
import { T, priorityColour, statusLabel } from "../theme";

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
        <Pressable onPress={onBack}><Text style={s.back}>← Back</Text></Pressable>
      </View>
    );
  }
  if (!c) return <View style={s.centre}><ActivityIndicator size="large" color={T.navy} /></View>;

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

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Pressable onPress={onBack} hitSlop={12}><Text style={s.back}>← My reports</Text></Pressable>

      <View style={s.head}>
        <Text style={s.ref}>{c.ref}</Text>
        <View style={[s.pill, { backgroundColor: priorityColour(c.priority) + "1a" }]}>
          <Text style={[s.pillText, { color: priorityColour(c.priority) }]}>
            {statusLabel(c.status)}
          </Text>
        </View>
      </View>
      <Text style={s.title}>{c.title}</Text>
      <Text style={s.meta}>
        {c.category ?? "Unclassified"}
        {c.department?.name ? ` · ${c.department.name}` : ""}
        {c.address ? ` · ${c.address}` : ""}
      </Text>

      {shown && <Image source={{ uri: shown }} style={s.image} resizeMode="cover" />}

      <Text style={s.section}>What the model found</Text>
      {detections.length === 0 ? (
        <Text style={s.body}>
          Nothing was detected in this photograph. A supervisor will triage it by hand.
        </Text>
      ) : (
        detections.map((d, i) => (
          <View key={i} style={s.detRow}>
            <Text style={s.detLabel}>{d.label}</Text>
            <Text style={s.detConf}>{Math.round(d.confidence * 100)}%</Text>
          </View>
        ))
      )}

      {c.severityScore != null && (
        <>
          <Text style={s.section}>Severity</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, {
              width: `${Math.min(100, Math.max(2, c.severityScore))}%`,
              backgroundColor: priorityColour(c.priority),
            }]} />
          </View>
          <Text style={s.body}>{Math.round(c.severityScore)} / 100</Text>
        </>
      )}

      <Text style={s.section}>Progress</Text>
      {(c.events ?? []).slice(0, 6).map((e) => (
        <View key={e.id} style={s.event}>
          <Text style={s.eventType}>{statusLabel(e.type)}</Text>
          <Text style={s.eventMsg}>{e.message}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, backgroundColor: T.bg, flexGrow: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: T.bg },
  back: { color: T.accent, fontWeight: "700", marginBottom: 14 },
  err: { color: T.bad, marginBottom: 16, textAlign: "center" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { color: T.accent, fontWeight: "800", letterSpacing: 0.5 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText: { fontSize: 11, fontWeight: "800" },
  title: { fontSize: 21, fontWeight: "800", color: T.ink, marginTop: 8 },
  meta: { color: T.muted, marginTop: 6, marginBottom: 16, lineHeight: 19 },
  image: { width: "100%", height: 260, borderRadius: 14, backgroundColor: "#ddd" },
  section: { fontSize: 12, fontWeight: "800", color: T.muted, letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  body: { color: T.body, lineHeight: 20 },
  detRow: {
    flexDirection: "row", justifyContent: "space-between", backgroundColor: T.card,
    borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.line,
  },
  detLabel: { fontWeight: "700", color: T.ink },
  detConf: { fontWeight: "800", color: T.accent },
  barTrack: { height: 8, backgroundColor: T.line, borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  barFill: { height: 8, borderRadius: 4 },
  event: {
    backgroundColor: T.card, borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: T.line,
  },
  eventType: { fontSize: 11, fontWeight: "800", color: T.muted, letterSpacing: 0.5 },
  eventMsg: { color: T.body, marginTop: 4, lineHeight: 19 },
});
