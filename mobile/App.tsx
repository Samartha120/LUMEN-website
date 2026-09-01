import { useEffect, useState } from "react";
import {
  ActivityIndicator, Pressable, SafeAreaView, StatusBar as RNStatusBar,
  StyleSheet, Text, View, Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken, loadToken, me, notifications, isStaff } from "./src/api";
import { flushOutbox } from "./src/outbox";
import LoginScreen from "./src/screens/LoginScreen";
import ReportScreen from "./src/screens/ReportScreen";
import MyReportsScreen from "./src/screens/MyReportsScreen";
import AlertsScreen from "./src/screens/AlertsScreen";
import DetailScreen from "./src/screens/DetailScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import ProfileScreen, { LOCK_KEY } from "./src/screens/ProfileScreen";
import OutboxScreen from "./src/screens/OutboxScreen";
import HelpScreen from "./src/screens/HelpScreen";
import OnboardingScreen, { SEEN_KEY } from "./src/screens/OnboardingScreen";
import LockScreen from "./src/screens/LockScreen";
import QueueScreen from "./src/screens/staff/QueueScreen";
import TriageScreen from "./src/screens/staff/TriageScreen";
import OpsScreen from "./src/screens/staff/OpsScreen";
import AssistantScreen from "./src/screens/staff/AssistantScreen";
import { C, S } from "./src/theme";
import { Icon, IconName } from "./src/Icon";

type Tab =
  | "home" | "insights" | "report" | "alerts" | "profile"   // citizen
  | "queue" | "ops" | "assistant";                          // staff
/** Pushed over the tabs, and dismissed back to wherever you were. */
type Sheet = { kind: "detail"; ref: string } | { kind: "outbox" } | { kind: "help" } | null;

/**
 * Navigation is a piece of state rather than a router.
 *
 * Two apps share this shell. A citizen gets Home, Impact, report, Updates and
 * Profile; a supervisor or engineer gets the Queue, Operations and the
 * assistant instead. Which one you see follows the role on the session, and
 * the server enforces the same split independently — every staff endpoint
 * checks the role itself, so hiding the tabs is a courtesy, not the control.
 */
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [onboarded, setOnboarded] = useState(true);
  const [locked, setLocked] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [unread, setUnread] = useState(0);

  // A stored token may be expired or from a server that has since been reset,
  // so it is checked against /me rather than trusted on sight.
  useEffect(() => {
    (async () => {
      setOnboarded((await AsyncStorage.getItem(SEEN_KEY)) === "1");
      const token = await loadToken();
      if (token) {
        try {
          const u = await me();
          setUser(u);
          if (isStaff(u?.role)) setTab("queue");
          setLocked((await AsyncStorage.getItem(LOCK_KEY)) === "1");
        } catch {
          await clearToken();
        }
      }
      setChecking(false);
    })();
  }, []);

  // Anything written down while offline goes out as soon as the app opens with
  // a signal, without the user having to remember it is there.
  useEffect(() => {
    if (!user || locked) return;
    (async () => {
      const { sent } = await flushOutbox();
      if (sent.length) setReloadKey((k) => k + 1);
      try { setUnread((await notifications()).unread ?? 0); } catch { /* offline */ }
    })();
  }, [user, locked, reloadKey]);

  async function signOut() {
    await clearToken();
    setUser(null);
    setSheet(null);
    setTab("home");
  }

  if (checking) {
    return (
      <View style={s.boot}>
        <Text style={s.bootLogo}>LUMEN</Text>
        <ActivityIndicator color={C.brand} />
      </View>
    );
  }

  if (!onboarded) {
    return (
      <>
        <StatusBar style="dark" />
        <OnboardingScreen onDone={() => setOnboarded(true)} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onSignedIn={(u) => { setUser(u); if (isStaff(u?.role)) setTab("queue"); }} />
      </>
    );
  }

  if (locked) {
    return (
      <>
        <StatusBar style="dark" />
        <LockScreen onUnlock={() => setLocked(false)} />
      </>
    );
  }

  const openDetail = (ref: string) => setSheet({ kind: "detail", ref });
  const role = String(user?.role ?? "CITIZEN").toUpperCase();
  const staff = isStaff(role);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.bar}>
        <Text style={s.wordmark}>LUMEN</Text>
        <Pressable onPress={() => { setSheet(null); setTab("profile"); }} hitSlop={8}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {String(user?.name ?? "?").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={s.body}>
        {sheet?.kind === "detail" ? (
          // Staff get the version with the workflow buttons on it; a citizen
          // gets the read-only one. Same complaint, different job.
          staff ? (
            <TriageScreen
              refCode={sheet.ref} role={role}
              onBack={() => setSheet(null)}
              onChanged={() => setReloadKey((k) => k + 1)}
            />
          ) : (
            <DetailScreen refCode={sheet.ref} onBack={() => setSheet(null)} />
          )
        ) : sheet?.kind === "outbox" ? (
          <OutboxScreen onBack={() => setSheet(null)} onSent={() => setReloadKey((k) => k + 1)} />
        ) : sheet?.kind === "help" ? (
          <HelpScreen onBack={() => setSheet(null)} />
        ) : tab === "queue" ? (
          <QueueScreen onOpen={openDetail} reloadKey={reloadKey} />
        ) : tab === "ops" ? (
          <OpsScreen role={role} onOpen={openDetail} reloadKey={reloadKey} />
        ) : tab === "assistant" ? (
          <AssistantScreen />
        ) : tab === "report" ? (
          <ReportScreen onFiled={() => {
            setReloadKey((k) => k + 1); setTab(staff ? "queue" : "home");
          }} />
        ) : tab === "home" ? (
          <MyReportsScreen onOpen={openDetail} reloadKey={reloadKey} name={user?.name} />
        ) : tab === "insights" ? (
          <InsightsScreen reloadKey={reloadKey} />
        ) : tab === "alerts" ? (
          <AlertsScreen onOpen={openDetail} onRead={() => setReloadKey((k) => k + 1)} />
        ) : (
          <ProfileScreen
            user={user}
            onSignOut={signOut}
            onOpenOutbox={() => setSheet({ kind: "outbox" })}
            onOpenHelp={() => setSheet({ kind: "help" })}
          />
        )}
      </View>

      {!sheet && (
        <View style={s.tabs}>
          {staff ? (
            <>
              <TabButton icon="inbox" label="Queue" on={tab === "queue"}
                onPress={() => { setTab("queue"); setReloadKey((k) => k + 1); }} />
              <TabButton icon="map" label="Ops" on={tab === "ops"}
                onPress={() => { setTab("ops"); setReloadKey((k) => k + 1); }} />

              {/* Staff file reports too — often the first person on site. */}
              <Pressable
                style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.96 }] }]}
                onPress={() => setTab("report")}
              >
                <Icon name="camera" size={23} color={C.brand} />
              </Pressable>

              <TabButton icon="message-circle" label="Ask" on={tab === "assistant"}
                onPress={() => setTab("assistant")} />
              <TabButton icon="user" label="Profile" on={tab === "profile"}
                onPress={() => setTab("profile")} />
            </>
          ) : (
            <>
              <TabButton icon="home" label="Home" on={tab === "home"}
                onPress={() => { setTab("home"); setReloadKey((k) => k + 1); }} />
              <TabButton icon="bar-chart-2" label="Impact" on={tab === "insights"}
                onPress={() => { setTab("insights"); setReloadKey((k) => k + 1); }} />

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
              <TabButton icon="user" label="Profile" on={tab === "profile"}
                onPress={() => setTab("profile")} />
            </>
          )}
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
        <Icon name={icon} size={20} color={on ? C.ink : C.muted} />
        {badge > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[s.tabText, on && s.tabOn]} numberOfLines={1}>{label}</Text>
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
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.brand,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: C.ink, fontWeight: "800", fontSize: 16 },
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
    width: 24, height: 3, borderRadius: 2, backgroundColor: "transparent", marginBottom: 8,
  },
  tabMarkOn: { backgroundColor: C.ink },
  tabText: { fontSize: 10, color: C.muted, marginTop: 3, fontWeight: "700" },
  tabOn: { color: C.ink },
  badge: {
    position: "absolute", top: -5, right: -11, backgroundColor: C.coral,
    minWidth: 18, height: 18, borderRadius: 9, alignItems: "center",
    justifyContent: "center", paddingHorizontal: 4,
    borderWidth: 2, borderColor: C.surface,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
