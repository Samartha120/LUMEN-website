import { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { login, register, API_URL } from "../api";
import { T } from "../theme";

export default function LoginScreen({ onSignedIn }: { onSignedIn: (u: any) => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signUp = mode === "up";

  async function go() {
    setError(null);
    if (!email.trim() || !password) return setError("Email and password are required.");
    if (signUp && !name.trim()) return setError("Please enter your name.");
    setBusy(true);
    try {
      const user = signUp
        ? await register(name.trim(), email.trim(), password)
        : await login(email.trim(), password);
      onSignedIn(user);
    } catch (e: any) {
      // A network failure here is nearly always the API address, not the
      // credentials, so say so rather than showing "request failed".
      setError(
        e?.message === "Network request failed"
          ? `Cannot reach the server at ${API_URL}. Check EXPO_PUBLIC_API_URL and that the phone is on the same network.`
          : e?.message ?? "Sign-in failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.brand}>
          <Text style={s.logo}>LUMEN</Text>
          <Text style={s.tag}>Report civic damage</Text>
        </View>

        <View style={s.card}>
          <Text style={s.h1}>{signUp ? "Create an account" : "Sign in"}</Text>

          {signUp && (
            <>
              <Text style={s.label}>Name</Text>
              <TextInput style={s.input} value={name} onChangeText={setName}
                placeholder="Your name" autoCapitalize="words" placeholderTextColor={T.muted} />
            </>
          )}

          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address"
            autoCorrect={false} placeholderTextColor={T.muted} />

          <Text style={s.label}>Password</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword}
            placeholder="••••••••" secureTextEntry placeholderTextColor={T.muted} />

          {error && <Text style={s.error}>{error}</Text>}

          <Pressable style={[s.btn, busy && s.btnBusy]} onPress={go} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>{signUp ? "Create account" : "Sign in"}</Text>}
          </Pressable>

          <Pressable onPress={() => { setMode(signUp ? "in" : "up"); setError(null); }}>
            <Text style={s.switch}>
              {signUp ? "Already registered? Sign in" : "New here? Create an account"}
            </Text>
          </Pressable>
        </View>

        <Text style={s.foot}>Connected to {API_URL}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: T.navy, padding: 24, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: 28 },
  logo: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: 4 },
  tag: { color: "#c7d2fe", marginTop: 6, fontSize: 15 },
  card: { backgroundColor: T.card, borderRadius: 16, padding: 20 },
  h1: { fontSize: 20, fontWeight: "700", color: T.ink, marginBottom: 16 },
  label: { fontSize: 13, color: T.body, marginBottom: 6, marginTop: 10, fontWeight: "600" },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: T.ink,
  },
  btn: {
    backgroundColor: T.navy, borderRadius: 10, paddingVertical: 14,
    alignItems: "center", marginTop: 20,
  },
  btnBusy: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  switch: { color: T.accent, textAlign: "center", marginTop: 16, fontSize: 14 },
  error: { color: T.bad, marginTop: 12, fontSize: 13, lineHeight: 18 },
  foot: { color: "#a5b4fc", textAlign: "center", marginTop: 18, fontSize: 11 },
});
