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
import { C, S, R } from "./src/theme";
import { Icon, IconName } from "./src/Icon";

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
  const [tab, setTab] = useState<Tab>("reports");
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
    setTab("reports");
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
      <StatusBar style="dark" />
      <View style={s.bar}>
        <Text style={s.wordmark}>LUMEN</Text>
        <View style={s.barRight}>
          <Pressable onPress={signOut} hitSlop={10} style={s.signOutBtn}>
            <Text style={s.signOut}>Sign out</Text>
          </Pressable>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {String(user?.name ?? "?").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.body}>
        {openRef ? (
          <DetailScreen refCode={openRef} onBack={() => setOpenRef(null)} />
        ) : tab === "report" ? (
          <ReportScreen
            onFiled={() => { setReloadKey((k) => k + 1); setTab("reports"); }}
          />
        ) : tab === "reports" ? (
          <MyReportsScreen onOpen={setOpenRef} reloadKey={reloadKey} name={user?.name} />
        ) : (
          <AlertsScreen onOpen={setOpenRef} onRead={() => setReloadKey((k) => k + 1)} />
        )}
      </View>

      {!openRef && (
        <View style={s.tabs}>
          <TabButton icon="home" label="Home" on={tab === "reports"}
            onPress={() => { setTab("reports"); setReloadKey((k) => k + 1); }} />

          {/* Reporting is the reason the app exists, so it is not a tab
              competing with the others — it is the button in the middle. */}
          <Pressable
            style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.96 }] }]}
            onPress={() => setTab("report")}
          >
            <Icon name="camera" size={23} color={C.brand} />
          </Pressable>

          <TabButton icon="bell" label="Updates" on={tab === "alerts"} badge={unread}
            onPress={() => { setTab("alerts"); setReloadKey((k) => k + 1); }} />
        </View>
      )}
    </SafeAreaView>
  );
}

function TabButton({ icon, label, on, badge = 0, onPress }: {
  icon: IconName; label: string; on: boolean; badge?: number; onPress: () => void;
}) {
  return (
    <Pressable style={s.tab} onPress={onPress}>
      {/* The active tab gets a bar above it as well as colour, so the state is
          not carried by hue alone. */}
      <View style={[s.tabMark, on && s.tabMarkOn]} />
      <View>
        <Icon name={icon} size={21} color={on ? C.ink : C.muted} />
        {badge > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[s.tabText, on && s.tabOn]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1, backgroundColor: C.bg,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
  },
  boot: { flex: 1, backgroundColor: C.dark, alignItems: "center", justifyContent: "center" },
  bootLogo: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: 6, marginBottom: S.lg },
  bar: {
    backgroundColor: C.bg, paddingHorizontal: S.xl, paddingVertical: S.md,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  wordmark: { color: C.ink, fontWeight: "800", letterSpacing: 4, fontSize: 15 },
  barRight: { flexDirection: "row", alignItems: "center", gap: S.md },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.brand,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: C.ink, fontWeight: "800", fontSize: 16 },
  signOutBtn: {
    paddingHorizontal: S.md, paddingVertical: 6, borderRadius: R.pill,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
  },
  signOut: { color: C.body, fontSize: 12, fontWeight: "700" },
  body: { flex: 1, backgroundColor: C.bg },
  tabs: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.line, paddingBottom: S.sm, paddingTop: 6,
  },
  fab: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: C.dark,
    alignItems: "center", justifyContent: "center", marginTop: -26,
    borderWidth: 4, borderColor: C.surface,
    shadowColor: "#3a3226", shadowOpacity: 0.28, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  tab: { flex: 1, alignItems: "center", paddingBottom: 8 },
  tabMark: {
    width: 26, height: 3, borderRadius: 2, backgroundColor: "transparent", marginBottom: 8,
  },
  tabMarkOn: { backgroundColor: C.ink },
  tabText: { fontSize: 11, color: C.muted, marginTop: 3, fontWeight: "700" },
  tabOn: { color: C.ink },
  badge: {
    position: "absolute", top: -5, right: -11, backgroundColor: C.coral,
    minWidth: 18, height: 18, borderRadius: 9, alignItems: "center",
    justifyContent: "center", paddingHorizontal: 4,
    borderWidth: 2, borderColor: C.surface,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
