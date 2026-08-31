import { useEffect, useState } from "react";
import {
  ActivityIndicator, Pressable, SafeAreaView, StatusBar as RNStatusBar,
  StyleSheet, Text, View, Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { clearToken, loadToken, me } from "./src/api";
import LoginScreen from "./src/screens/LoginScreen";
import ReportScreen from "./src/screens/ReportScreen";
import MyReportsScreen from "./src/screens/MyReportsScreen";
import DetailScreen from "./src/screens/DetailScreen";
import { T } from "./src/theme";

type Tab = "report" | "reports";

/**
 * Navigation is a piece of state rather than a router.
 *
 * There are three places to be — file a report, see your reports, open one —
 * and no deep links or back stack to preserve. A router would be a dependency
 * and a build step for something a union type already expresses.
 */
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("report");
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // A stored token may be expired or from a server that has since been reset,
  // so it is checked against /me rather than trusted on sight.
  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (token) {
        try { setUser(await me()); } catch { await clearToken(); }
      }
      setChecking(false);
    })();
  }, []);

  async function signOut() {
    await clearToken();
    setUser(null);
    setOpenRef(null);
    setTab("report");
  }

  if (checking) {
    return (
      <View style={s.boot}>
        <Text style={s.bootLogo}>LUMEN</Text>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onSignedIn={setUser} />
      </>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <View style={s.bar}>
        <Text style={s.barTitle}>LUMEN</Text>
        <Pressable onPress={signOut} hitSlop={10}>
          <Text style={s.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <View style={s.body}>
        {openRef ? (
          <DetailScreen refCode={openRef} onBack={() => setOpenRef(null)} />
        ) : tab === "report" ? (
          <ReportScreen
            onFiled={() => { setReloadKey((k) => k + 1); setTab("reports"); }}
          />
        ) : (
          <MyReportsScreen onOpen={setOpenRef} reloadKey={reloadKey} />
        )}
      </View>

      {!openRef && (
        <View style={s.tabs}>
          <Pressable style={s.tab} onPress={() => setTab("report")}>
            <Text style={[s.tabIcon, tab === "report" && s.tabOn]}>＋</Text>
            <Text style={[s.tabText, tab === "report" && s.tabOn]}>Report</Text>
          </Pressable>
          <Pressable style={s.tab} onPress={() => { setTab("reports"); setReloadKey((k) => k + 1); }}>
            <Text style={[s.tabIcon, tab === "reports" && s.tabOn]}>☰</Text>
            <Text style={[s.tabText, tab === "reports" && s.tabOn]}>My reports</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1, backgroundColor: T.bg,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
  },
  boot: { flex: 1, backgroundColor: T.navy, alignItems: "center", justifyContent: "center" },
  bootLogo: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: 4, marginBottom: 18 },
  bar: {
    backgroundColor: T.navy, paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  barTitle: { color: "#fff", fontWeight: "800", letterSpacing: 3, fontSize: 16 },
  signOut: { color: "#c7d2fe", fontSize: 13, fontWeight: "600" },
  body: { flex: 1 },
  tabs: {
    flexDirection: "row", backgroundColor: T.card,
    borderTopWidth: 1, borderTopColor: T.line, paddingBottom: 6,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabIcon: { fontSize: 20, color: T.muted },
  tabText: { fontSize: 12, color: T.muted, marginTop: 2, fontWeight: "600" },
  tabOn: { color: T.navy },
});
