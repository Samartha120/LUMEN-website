import { useEffect, useState } from "react";
import {
  ActivityIndicator, Pressable, SafeAreaView, StatusBar as RNStatusBar,
  StyleSheet, Text, View, Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { clearToken, loadToken, me, notifications } from "./src/api";
import { flushOutbox } from "./src/outbox";
import LoginScreen from "./src/screens/LoginScreen";
import ReportScreen from "./src/screens/ReportScreen";
import MyReportsScreen from "./src/screens/MyReportsScreen";
import AlertsScreen from "./src/screens/AlertsScreen";
import DetailScreen from "./src/screens/DetailScreen";
import { T } from "./src/theme";

type Tab = "report" | "reports" | "alerts";

/**
 * Navigation is a piece of state rather than a router.
 *
 * There are four places to be — file a report, see your reports, read updates,
 * open one report — and no deep links or back stack to preserve. A router
 * would be a dependency and a build step for what a union type expresses.
 */
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("report");
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [unread, setUnread] = useState(0);

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

  // Anything written down while offline goes out as soon as the app opens with
  // a signal, without the user having to remember it is there.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { sent } = await flushOutbox();
      if (sent.length) setReloadKey((k) => k + 1);
      try { setUnread((await notifications()).unread ?? 0); } catch { /* offline */ }
    })();
  }, [user, reloadKey]);

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
        ) : tab === "reports" ? (
          <MyReportsScreen onOpen={setOpenRef} reloadKey={reloadKey} />
        ) : (
          <AlertsScreen onOpen={setOpenRef} onRead={() => setReloadKey((k) => k + 1)} />
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
          <Pressable style={s.tab} onPress={() => { setTab("alerts"); setReloadKey((k) => k + 1); }}>
            <View>
              <Text style={[s.tabIcon, tab === "alerts" && s.tabOn]}>🔔</Text>
              {unread > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unread > 9 ? "9+" : unread}</Text>
                </View>
              )}
            </View>
            <Text style={[s.tabText, tab === "alerts" && s.tabOn]}>Updates</Text>
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
  badge: {
    position: "absolute", top: -4, right: -10, backgroundColor: T.bad,
    minWidth: 17, height: 17, borderRadius: 9, alignItems: "center",
    justifyContent: "center", paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
