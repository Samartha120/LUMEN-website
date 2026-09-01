import { useState } from "react";
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { submitReport, previewPhoto, Preview } from "../api";
import { enqueue, isOnline } from "../outbox";
import { C, S, R, F, card, tone } from "../theme";
import { Button, Meter } from "../ui";
import { Icon } from "../Icon";

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
  const [focused, setFocused] = useState(false);

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

  const step = photos.length === 0 ? 1 : !title.trim() ? 2 : 3;

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Report a problem</Text>
      <Text style={s.sub}>The class, severity and department come from your photograph.</Text>

      <View style={s.steps}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[s.stepBar, n <= step && s.stepBarOn]} />
        ))}
      </View>

      <Text style={s.legend}>Step {step} of 3 · {["Photograph", "Describe", "Submit"][step - 1]}</Text>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.strip}
          contentContainerStyle={{ paddingRight: S.lg, paddingTop: 6 }}>
          {photos.map((uri, i) => (
            <View key={uri + i} style={s.thumbWrap}>
              <Image source={{ uri }} style={s.thumb} />
              <Pressable style={s.thumbX} hitSlop={8}
                onPress={() => { setPhotos((p) => p.filter((_, j) => j !== i)); setPreview(null); }}>
                <Text style={s.thumbXText}>✕</Text>
              </Pressable>
              {i === 0 && <View style={s.mainTag}><Text style={s.mainTagText}>MAIN</Text></View>}
            </View>
          ))}
        </ScrollView>
      )}

      {photos.length < MAX_PHOTOS && (
        <View style={s.pickRow}>
          <Pressable style={({ pressed }) => [s.pick, s.pickPrimary, pressed && s.pickPressed]}
            onPress={takePhoto}>
            <Icon name="camera" size={22} color={C.brand} />
            <Text style={s.pickTextPrimary}>{photos.length ? "Add photo" : "Take photo"}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [s.pick, pressed && s.pickPressed]} onPress={pickPhoto}>
            <Icon name="image" size={22} color={C.body} />
            <Text style={s.pickText}>From gallery</Text>
          </Pressable>
        </View>
      )}
      {photos.length > 0 && (
        <Text style={s.counter}>{photos.length} of {MAX_PHOTOS} · the first is used for classification</Text>
      )}

      {photos.length > 0 && (
        <Pressable style={({ pressed }) => [s.checkBtn, pressed && s.checkPressed]}
          onPress={check} disabled={checking}>
          {checking
            ? <ActivityIndicator color={C.ink} />
            : (
              <View style={s.checkInner}>
                <Icon name="cpu" size={17} color={C.ink} />
                <Text style={s.checkText}>Check what the AI sees</Text>
              </View>
            )}
        </Pressable>
      )}

      {preview && <PreviewCard preview={preview} />}

      <Text style={s.label}>What is the problem?</Text>
      <TextInput
        style={[s.input, focused && s.inputFocus]}
        value={title} onChangeText={setTitle}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder="e.g. Deep pothole outside the school gate"
        placeholderTextColor={C.muted} multiline
      />

      <Pressable style={s.locRow} onPress={locate} disabled={locating}>
        <View style={s.locIcon}>
          <Icon name="map-pin" size={17} color={coords ? C.ok : C.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.locTitle}>{coords ? "Location attached" : "Add your location"}</Text>
          <Text style={s.locSub}>
            {coords
              ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
              : "Routes it to the right ward"}
          </Text>
        </View>
        <Text style={s.locAction}>{locating ? "…" : coords ? "Update" : "Use GPS"}</Text>
      </Pressable>

      {error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}

      <Button label="Submit report" onPress={send} busy={busy} style={{ marginTop: S.xl }} />
      {busy && <Text style={s.hint}>Analysing the photograph…</Text>}
    </ScrollView>
  );
}

function PreviewCard({ preview }: { preview: Preview }) {
  const t = tone(preview.severity.priority);
  const none = preview.detections.length === 0;
  return (
    <View style={[card, s.preview]}>
      <Image source={{ uri: preview.annotated }} style={s.previewImg} resizeMode="cover" />
      <View style={s.previewBody}>
        {!preview.looksCivic ? (
          <>
            <Text style={[s.previewVerdict, { color: C.bad }]}>Not a road or civic area</Text>
            <Text style={s.previewText}>{preview.hint ?? preview.message}</Text>
          </>
        ) : none ? (
          <>
            <Text style={[s.previewVerdict, { color: C.warn }]}>Nothing detected</Text>
            <Text style={s.previewText}>
              Move closer, or let the damage fill more of the frame. You can still file
              it — a supervisor will triage it by hand.
            </Text>
          </>
        ) : (
          <>
            <View style={s.previewHead}>
              <Text style={[s.previewVerdict, { color: C.ok }]}>
                {preview.detections.length} region{preview.detections.length === 1 ? "" : "s"} found
              </Text>
              <View style={[s.sevChip, { backgroundColor: t.bg }]}>
                <Text style={[s.sevChipText, { color: t.fg }]}>{preview.severity.priority}</Text>
              </View>
            </View>
            {preview.detections.slice(0, 4).map((d, i) => (
              <View key={i} style={s.detRow}>
                <Text style={s.detLabel}>{d.label}</Text>
                <Text style={s.detConf}>{Math.round(d.confidence * 100)}%</Text>
              </View>
            ))}
            <View style={{ marginTop: S.md }}>
              <Meter value={preview.severity.score} priority={preview.severity.priority} />
              <Text style={s.sevText}>Severity {Math.round(preview.severity.score)} / 100</Text>
            </View>
          </>
        )}
        <Text style={s.previewNote}>Nothing has been filed yet.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg, flexGrow: 1 },
  h1: { ...F.display },
  sub: { ...F.body, color: C.muted, marginTop: S.xs },

  steps: { flexDirection: "row", gap: 6, marginTop: S.xl },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.line },
  stepBarOn: { backgroundColor: C.ink },
  legend: { ...F.caption, marginTop: S.sm, marginBottom: S.lg },

  strip: { marginBottom: S.md },
  thumbWrap: { marginRight: S.md },
  thumb: { width: 104, height: 104, borderRadius: R.md, backgroundColor: C.raised },
  thumbX: {
    position: "absolute", top: -6, right: -6, backgroundColor: C.ink,
    width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.bg,
  },
  thumbXText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  mainTag: {
    position: "absolute", bottom: 7, left: 7, backgroundColor: "rgba(10,14,25,0.72)",
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.sm,
  },
  mainTagText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },

  pickRow: { flexDirection: "row", gap: S.md },
  pick: {
    flex: 1, backgroundColor: C.surface, borderRadius: R.lg, paddingVertical: S.xl,
    alignItems: "center", borderWidth: 1.5, borderColor: C.line,
  },
  pickPrimary: { backgroundColor: C.dark, borderColor: C.dark },
  pickPressed: { opacity: 0.92 },
  pickText: { ...F.bodyStrong, color: C.body, marginTop: S.sm },
  pickTextPrimary: { ...F.bodyStrong, color: "#fff", marginTop: S.sm },
  counter: { ...F.caption, marginTop: S.md, textAlign: "center" },

  checkBtn: {
    marginTop: S.lg, borderWidth: 1.5, borderColor: "#d6ddff", borderRadius: R.md,
    paddingVertical: 14, alignItems: "center", backgroundColor: C.brandSoft, minHeight: 50,
    justifyContent: "center",
  },
  checkPressed: { backgroundColor: "#e3e9ff" },
  checkInner: { flexDirection: "row", alignItems: "center", gap: S.sm },
  checkText: { color: C.brand, fontWeight: "800", fontSize: 15 },

  preview: { marginTop: S.lg, padding: 0, overflow: "hidden" },
  previewImg: { width: "100%", height: 210, backgroundColor: C.raised },
  previewBody: { padding: S.lg },
  previewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewVerdict: { fontSize: 15, fontWeight: "800" },
  sevChip: { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.pill },
  sevChipText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  previewText: { ...F.body, marginTop: 6 },
  detRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.line, marginTop: S.sm,
  },
  detLabel: { ...F.bodyStrong },
  detConf: { ...F.bodyStrong, color: C.ink },
  sevText: { ...F.caption, marginTop: 6 },
  previewNote: { ...F.caption, fontSize: 12, marginTop: S.md, fontStyle: "italic" },

  label: { ...F.caption, color: C.body, fontWeight: "700", marginTop: S.xxl, marginBottom: S.sm },
  input: {
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.line, borderRadius: R.md,
    padding: S.md, fontSize: 16, minHeight: 78, textAlignVertical: "top", color: C.ink,
  },
  inputFocus: { borderColor: C.ink },

  locIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.bg,
    alignItems: "center", justifyContent: "center", marginRight: S.md,
  },
  locRow: {
    flexDirection: "row", alignItems: "center", marginTop: S.lg,
    backgroundColor: C.surface, borderRadius: R.md, padding: S.lg,
    borderWidth: 1, borderColor: C.line,
  },
  locTitle: { ...F.bodyStrong },
  locSub: { ...F.caption, marginTop: 2 },
  locAction: {
    color: C.ink, fontWeight: "800", fontSize: 13,
    paddingLeft: S.md,
  },

  errorBox: {
    backgroundColor: C.badSoft, borderRadius: R.md, padding: S.md, marginTop: S.lg,
    borderWidth: 1, borderColor: "#f6cfcc",
  },
  errorText: { color: C.bad, fontSize: 13, lineHeight: 19 },
  hint: { ...F.caption, textAlign: "center", marginTop: S.md },
});
