import { useState } from "react";
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { submitReport, previewPhoto, Preview } from "../api";
import { enqueue, isOnline } from "../outbox";
import { T, priorityColour } from "../theme";

const MAX_PHOTOS = 5;

export default function ReportScreen({ onFiled }: { onFiled: (ref: string | null) => void }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addPhoto(uri: string) {
    setPhotos((p) => [...p, uri].slice(0, MAX_PHOTOS));
    setPreview(null);
    setError(null);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError("Camera permission is needed to photograph the damage.");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!r.canceled) { addPhoto(r.assets[0].uri); locate(); }
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError("Photo access is needed to attach an existing picture.");
    const r = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (!r.canceled) r.assets.forEach((a) => addPhoto(a.uri));
  }

  // Location is a convenience, never a blocker: the server falls back to a
  // default centre, and a report with a photograph is still worth having.
  async function locate() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      /* proceed without coordinates */
    } finally {
      setLocating(false);
    }
  }

  /** Show what the detector makes of the first photo, before anything is filed. */
  async function check() {
    if (!photos.length) return setError("Take a photograph first.");
    setChecking(true); setError(null);
    try {
      setPreview(await previewPhoto(photos[0]));
    } catch (e: any) {
      setError(e?.message ?? "Could not analyse the photograph.");
    } finally {
      setChecking(false);
    }
  }

  async function send() {
    setError(null);
    if (!photos.length) return setError("A photograph is required — the class and severity come from it.");
    if (!title.trim()) return setError("Please describe what you are reporting.");
    setBusy(true);
    try {
      // Offline is not a failure. The report is written to the device and goes
      // out by itself when the network returns, because the person standing in
      // front of the hazard will not come back to try again.
      if (!(await isOnline())) {
        const n = await enqueue({
          title: title.trim(), photoUris: photos,
          lat: coords?.lat ?? null, lng: coords?.lng ?? null,
        });
        reset();
        Alert.alert("Saved — you are offline",
          `Your report is queued on this phone and will be sent automatically when you are back online. ${n} report${n === 1 ? "" : "s"} waiting.`);
        onFiled(null);
        return;
      }

      const out = await submitReport({
        title: title.trim(), photoUris: photos,
        lat: coords?.lat ?? null, lng: coords?.lng ?? null,
      });
      reset();
      if (out.duplicate) {
        Alert.alert("Reported — already known",
          `Filed as ${out.ref}. This looks like the same problem as ${out.duplicate.of}, about ${out.duplicate.distanceM} m away. Your report still counts: more reports raise its priority.`);
      } else {
        Alert.alert("Report filed", `Your report was received as ${out.ref}.`);
      }
      onFiled(out.ref);
    } catch (e: any) {
      // The server rejects photographs that are not of a road or civic area,
      // and its wording is more useful than anything generic written here.
      setError(e?.message ?? "Could not file the report.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhotos([]); setTitle(""); setCoords(null); setPreview(null);
  }

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Report a problem</Text>
      <Text style={s.sub}>
        Photograph the damage. The class, severity and department are worked out
        from the picture.
      </Text>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.strip}>
          {photos.map((uri, i) => (
            <View key={uri + i} style={s.thumbWrap}>
              <Image source={{ uri }} style={s.thumb} />
              <Pressable style={s.thumbX}
                onPress={() => { setPhotos((p) => p.filter((_, j) => j !== i)); setPreview(null); }}>
                <Text style={s.thumbXText}>✕</Text>
              </Pressable>
              {i === 0 && <Text style={s.primaryTag}>main</Text>}
            </View>
          ))}
        </ScrollView>
      )}

      {photos.length < MAX_PHOTOS && (
        <View style={s.pickRow}>
          <Pressable style={[s.pick, s.pickPrimary]} onPress={takePhoto}>
            <Text style={s.pickIcon}>📷</Text>
            <Text style={s.pickTextPrimary}>{photos.length ? "Add photo" : "Take photo"}</Text>
          </Pressable>
          <Pressable style={s.pick} onPress={pickPhoto}>
            <Text style={s.pickIcon}>🖼️</Text>
            <Text style={s.pickText}>From gallery</Text>
          </Pressable>
        </View>
      )}

      {photos.length > 0 && (
        <Pressable style={s.checkBtn} onPress={check} disabled={checking}>
          {checking
            ? <ActivityIndicator color={T.navy} />
            : <Text style={s.checkText}>🔍  Check what the AI sees</Text>}
        </Pressable>
      )}

      {preview && (
        <View style={s.preview}>
          <Image source={{ uri: preview.annotated }} style={s.previewImg} resizeMode="cover" />
          {!preview.looksCivic ? (
            <>
              <Text style={s.previewBad}>This does not look like a road or civic area</Text>
              <Text style={s.previewBody}>{preview.hint ?? preview.message}</Text>
            </>
          ) : preview.detections.length === 0 ? (
            <>
              <Text style={s.previewWarn}>Nothing detected in this photograph</Text>
              <Text style={s.previewBody}>
                Move closer, or make sure the damage fills more of the frame. You can
                still file it — a supervisor will triage it by hand.
              </Text>
            </>
          ) : (
            <>
              <Text style={s.previewOk}>
                {preview.detections.length} region{preview.detections.length === 1 ? "" : "s"} detected
              </Text>
              {preview.detections.slice(0, 4).map((d, i) => (
                <View key={i} style={s.detRow}>
                  <Text style={s.detLabel}>{d.label}</Text>
                  <Text style={s.detConf}>{Math.round(d.confidence * 100)}%</Text>
                </View>
              ))}
              <Text style={[s.previewBody, { marginTop: 8 }]}>
                Severity {Math.round(preview.severity.score)}/100 ·{" "}
                <Text style={{ color: priorityColour(preview.severity.priority), fontWeight: "700" }}>
                  {preview.severity.priority}
                </Text>
              </Text>
            </>
          )}
          <Text style={s.previewNote}>Nothing has been filed yet.</Text>
        </View>
      )}

      <Text style={s.label}>What is the problem?</Text>
      <TextInput style={s.input} value={title} onChangeText={setTitle}
        placeholder="e.g. Deep pothole outside the school gate"
        placeholderTextColor={T.muted} multiline />

      <View style={s.locRow}>
        <Text style={s.locText}>
          {coords
            ? `📍 Location attached (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
            : "📍 No location attached"}
        </Text>
        <Pressable onPress={locate} disabled={locating}>
          <Text style={s.locBtn}>{locating ? "Locating…" : coords ? "Update" : "Use my location"}</Text>
        </Pressable>
      </View>

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable style={[s.btn, busy && s.btnBusy]} onPress={send} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Submit report</Text>}
      </Pressable>
      {busy && <Text style={s.hint}>Analysing the photograph…</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, backgroundColor: T.bg, flexGrow: 1 },
  h1: { fontSize: 24, fontWeight: "800", color: T.ink },
  sub: { color: T.muted, marginTop: 6, marginBottom: 20, lineHeight: 20 },
  strip: { marginBottom: 14 },
  thumbWrap: { marginRight: 10 },
  thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: "#ddd" },
  thumbX: {
    position: "absolute", top: -6, right: -6, backgroundColor: T.ink,
    width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center",
  },
  thumbXText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  primaryTag: {
    position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff", fontSize: 10, fontWeight: "700", paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 4, overflow: "hidden",
  },
  pickRow: { flexDirection: "row", gap: 12 },
  pick: {
    flex: 1, backgroundColor: T.card, borderRadius: 14, paddingVertical: 22,
    alignItems: "center", borderWidth: 1, borderColor: T.line,
  },
  pickPrimary: { backgroundColor: T.navy, borderColor: T.navy },
  pickIcon: { fontSize: 24, marginBottom: 6 },
  pickText: { color: T.body, fontWeight: "600" },
  pickTextPrimary: { color: "#fff", fontWeight: "700" },
  checkBtn: {
    marginTop: 14, borderWidth: 1.5, borderColor: T.navy, borderRadius: 12,
    paddingVertical: 13, alignItems: "center", backgroundColor: "#eef2ff",
  },
  checkText: { color: T.navy, fontWeight: "800" },
  preview: {
    marginTop: 14, backgroundColor: T.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: T.line,
  },
  previewImg: { width: "100%", height: 200, borderRadius: 10, backgroundColor: "#eee", marginBottom: 12 },
  previewOk: { color: T.ok, fontWeight: "800", marginBottom: 8 },
  previewWarn: { color: T.warn, fontWeight: "800", marginBottom: 6 },
  previewBad: { color: T.bad, fontWeight: "800", marginBottom: 6 },
  previewBody: { color: T.body, lineHeight: 19 },
  previewNote: { color: T.muted, fontSize: 12, marginTop: 10, fontStyle: "italic" },
  detRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 7, borderTopWidth: 1, borderTopColor: T.line,
  },
  detLabel: { color: T.ink, fontWeight: "600" },
  detConf: { color: T.accent, fontWeight: "800" },
  label: { fontSize: 13, color: T.body, fontWeight: "700", marginTop: 22, marginBottom: 8 },
  input: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 10,
    padding: 12, fontSize: 16, minHeight: 70, textAlignVertical: "top", color: T.ink,
  },
  locRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 18, backgroundColor: T.card, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: T.line,
  },
  locText: { color: T.body, fontSize: 13, flex: 1 },
  locBtn: { color: T.accent, fontWeight: "700", fontSize: 13 },
  error: { color: T.bad, marginTop: 14, lineHeight: 19 },
  btn: { backgroundColor: T.navy, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  btnBusy: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  hint: { color: T.muted, textAlign: "center", marginTop: 10, fontSize: 13 },
});
