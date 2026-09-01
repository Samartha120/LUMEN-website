import { useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { login, register, API_URL } from "../api";
import { C, S, R, F, E } from "../theme";
import { Button } from "../ui";

export default function LoginScreen({ onSignedIn }: { onSignedIn: (u: any) => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
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
      // credentials, so say which rather than showing "request failed".
      setError(
        e?.message === "Network request failed"
          ? `Cannot reach the server at ${API_URL}. Check EXPO_PUBLIC_API_URL and that the phone is on the same network.`
          : e?.message ?? "Sign-in failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const field = (key: string) => [s.input, focus === key && s.inputFocus];

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.brand}>
          <View style={s.mark}><Text style={s.markText}>L</Text></View>
          <Text style={s.logo}>LUMEN</Text>
          <Text style={s.tag}>Report civic damage in your city</Text>
        </View>

        <View style={s.card}>
          <Text style={s.h1}>{signUp ? "Create an account" : "Welcome back"}</Text>
          <Text style={s.h2}>
            {signUp ? "Takes a moment. You only need an email." : "Sign in to file and follow your reports."}
          </Text>

          {signUp && (
            <>
              <Text style={s.label}>Name</Text>
              <TextInput style={field("name")} value={name} onChangeText={setName}
                onFocus={() => setFocus("name")} onBlur={() => setFocus(null)}
                placeholder="Your name" autoCapitalize="words" placeholderTextColor={C.muted} />
            </>
          )}

          <Text style={s.label}>Email</Text>
          <TextInput style={field("email")} value={email} onChangeText={setEmail}
            onFocus={() => setFocus("email")} onBlur={() => setFocus(null)}
            placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address"
            autoCorrect={false} placeholderTextColor={C.muted} />

          <Text style={s.label}>Password</Text>
          <TextInput style={field("password")} value={password} onChangeText={setPassword}
            onFocus={() => setFocus("password")} onBlur={() => setFocus(null)}
            placeholder="••••••••" secureTextEntry placeholderTextColor={C.muted} />

          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <Button label={signUp ? "Create account" : "Sign in"} onPress={go} busy={busy}
            style={{ marginTop: S.xl }} />

          <Pressable onPress={() => { setMode(signUp ? "in" : "up"); setError(null); }} hitSlop={8}>
            <Text style={s.switch}>
              {signUp ? "Already registered?  " : "New here?  "}
              <Text style={s.switchStrong}>{signUp ? "Sign in" : "Create an account"}</Text>
            </Text>
          </Pressable>
        </View>

        <Text style={s.foot}>{API_URL.replace(/^https?:\/\//, "")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: S.xl, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: S.xxl },
  mark: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: C.brand,
    alignItems: "center", justifyContent: "center", marginBottom: S.md,
  },
  markText: { color: C.ink, fontSize: 28, fontWeight: "800" },
  logo: { color: C.ink, fontSize: 26, fontWeight: "800", letterSpacing: 6 },
  tag: { ...F.caption, marginTop: S.sm, fontSize: 14 },

  card: {
    backgroundColor: C.surface, borderRadius: R.xl, padding: S.xl,
    borderWidth: 1, borderColor: C.line, ...E.raised,
  },
  h1: { ...F.title },
  h2: { ...F.caption, marginTop: S.xs, marginBottom: S.lg },

  label: { ...F.caption, color: C.body, fontWeight: "700", marginTop: S.lg, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, backgroundColor: C.bg,
    paddingHorizontal: S.md, paddingVertical: 13, fontSize: 16, color: C.ink,
  },
  inputFocus: { borderColor: C.ink, backgroundColor: C.surface },

  errorBox: {
    backgroundColor: C.badSoft, borderRadius: R.md, padding: S.md, marginTop: S.lg,
    borderWidth: 1, borderColor: "#f6cfcc",
  },
  errorText: { color: C.bad, fontSize: 13, lineHeight: 19 },

  switch: { ...F.caption, textAlign: "center", marginTop: S.lg },
  switchStrong: { color: C.ink, fontWeight: "800" },
  foot: { color: C.muted, textAlign: "center", marginTop: S.xl, fontSize: 11 },
});
