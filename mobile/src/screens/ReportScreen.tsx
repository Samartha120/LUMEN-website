import { useState } from "react";
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { submitReport } from "../api";
import { T } from "../theme";

export default function ReportScreen({ onFiled }: { onFiled: (ref: string) => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError("Camera permission is needed to photograph the damage.");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!r.canceled) { setPhoto(r.assets[0].uri); setError(null); locate(); }
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError("Photo access is needed to attach an existing picture.");
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: false });
    if (!r.canceled) { setPhoto(r.assets[0].uri); setError(null); }
  }

  // Location is a convenience, never a blocker: the server falls back to a
  // default centre if none is sent, and a report with a photo is still useful.
  async function locate() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      /* keep going without coordinates */
    } finally {
      setLocating(false);
    }
  }

  async function send() {
    setError(null);
    if (!photo) return setError("A photograph is required — the class and severity come from it.");
    if (!title.trim()) return setError("Please describe what you are reporting.");
    setBusy(true);
    try {
      const out = await submitReport({
        title: title.trim(), photoUri: photo,
        lat: coords?.lat ?? null, lng: coords?.lng ?? null,
      });
      setPhoto(null); setTitle(""); setCoords(null);
      if (out.duplicate) {
        Alert.alert(
          "Reported — already known",
          `Filed as ${out.ref}. This looks like the same problem as ${out.duplicate.of}, about ${out.duplicate.distanceM} m away. Your report still counts: more reports raise its priority.`,
        );
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

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Report a problem</Text>
      <Text style={s.sub}>
        Photograph the damage. The class, severity and department are worked out
        from the picture.
      </Text>

      {photo ? (
        <View>
          <Image source={{ uri: photo }} style={s.preview} />
          <Pressable onPress={() => setPhoto(null)}>
            <Text style={s.remove}>Remove photo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.pickRow}>
          <Pressable style={[s.pick, s.pickPrimary]} onPress={takePhoto}>
            <Text style={s.pickIcon}>📷</Text>
            <Text style={s.pickTextPrimary}>Take photo</Text>
          </Pressable>
          <Pressable style={s.pick} onPress={pickPhoto}>
            <Text style={s.pickIcon}>🖼️</Text>
            <Text style={s.pickText}>Choose photo</Text>
          </Pressable>
        </View>
      )}

      <Text style={s.label}>What is the problem?</Text>
      <TextInput
        style={s.input} value={title} onChangeText={setTitle}
        placeholder="e.g. Deep pothole outside the school gate"
        placeholderTextColor={T.muted} multiline
      />

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
  pickRow: { flexDirection: "row", gap: 12 },
  pick: {
    flex: 1, backgroundColor: T.card, borderRadius: 14, paddingVertical: 26,
    alignItems: "center", borderWidth: 1, borderColor: T.line,
  },
  pickPrimary: { backgroundColor: T.navy, borderColor: T.navy },
  pickIcon: { fontSize: 26, marginBottom: 8 },
  pickText: { color: T.body, fontWeight: "600" },
  pickTextPrimary: { color: "#fff", fontWeight: "700" },
  preview: { width: "100%", height: 260, borderRadius: 14, backgroundColor: "#ddd" },
  remove: { color: T.bad, textAlign: "center", marginTop: 10, fontWeight: "600" },
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
