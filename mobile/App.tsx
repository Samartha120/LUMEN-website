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
import MeasureScreen from "./src/screens/staff/MeasureScreen";

// Interactive citizen and staff screens
import { LiveTrackingScreen } from "./src/screens/LiveTrackingScreen";
import { VoiceReportScreen } from "./src/screens/VoiceReportScreen";
import { EmergencySOSScreen } from "./src/screens/EmergencySOSScreen";
import { NotificationCenterScreen } from "./src/screens/NotificationCenterScreen";
import { VerificationScreen } from "./src/screens/staff/VerificationScreen";

// Newly built advanced modules
import { SafeRouteScreen } from "./src/screens/SafeRouteScreen";
import { FieldToolkitScreen } from "./src/screens/staff/FieldToolkitScreen";

import { C, S } from "./src/theme";
import { I18nProvider, useT } from "./src/i18n";
import {
  NotificationProvider,
  OfflineQueueProvider,
  EmergencyAlertProvider,
} from "./src/state";
import { Icon, IconName } from "./src/Icon";

export type Tab =
  | "home" | "report" | "alerts" | "profile" | "tracking" | "voice" | "sos" | "insights" | "routes"
  | "queue" | "ops" | "assistant" | "measure" | "verify" | "toolkit";

export type Sheet =
  | { kind: "detail"; ref: string }
  | { kind: "measure"; ref: string }
  | { kind: "verify"; ref: string }
  | { kind: "tracking"; ref: string }
  | { kind: "voice" }
  | { kind: "sos" }
  | { kind: "routes" }
  | { kind: "toolkit" }
  | { kind: "outbox" }
  | { kind: "help" }
  | null;

export default function App() {
  return (
    <I18nProvider>
      <OfflineQueueProvider>
        <NotificationProvider>
          <EmergencyAlertProvider>
            <Shell />
          </EmergencyAlertProvider>
        </NotificationProvider>
      </OfflineQueueProvider>
    </I18nProvider>
  );
}

function Shell() {
  const { t } = useT();
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [onboarded, setOnboarded] = useState(true);
  const [locked, setLocked] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [unread, setUnread] = useState(0);

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

  useEffect(() => {
    if (!user || locked) return;
    (async () => {
      const { sent } = await flushOutbox();
      if (sent.length) setReloadKey((k) => k + 1);
      try {
        setUnread((await notifications()).unread ?? 0);
      } catch {
        /* offline */
      }
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
        <LoginScreen
          onSignedIn={(u) => {
            setUser(u);
            if (isStaff(u?.role)) setTab("queue");
          }}
        />
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
  const openTracking = (ref: string) => setSheet({ kind: "tracking", ref });
  const role = String(user?.role ?? "CITIZEN").toUpperCase();
  const staff = isStaff(role);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.bar}>
        <Pressable onPress={() => { setSheet(null); setTab("home"); }}>
          <Text style={s.wordmark}>LUMEN</Text>
        </Pressable>

        {/* Quick action buttons on citizen top bar */}
        <View style={s.topActions}>
          {!staff ? (
            <>

              <Pressable
                style={s.topIconBtn}
                onPress={() => setSheet({ kind: "routes" })}
                hitSlop={6}
              >
                <Icon name="navigation" size={17} color={C.brand} />
              </Pressable>



              <Pressable
                style={s.topIconBtn}
                onPress={() => setSheet({ kind: "sos" })}
                hitSlop={6}
              >
                <Icon name="alert-triangle" size={17} color="#EF4444" />
              </Pressable>
            </>
          ) : (
            <Pressable
              style={s.topIconBtn}
              onPress={() => setSheet({ kind: "toolkit" })}
              hitSlop={6}
            >
              <Icon name="tool" size={17} color={C.brand} />
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              setSheet(null);
              setTab("profile");
            }}
            hitSlop={8}
          >
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {String(user?.name ?? "?").trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <View style={s.body}>
        {sheet?.kind === "detail" ? (
          staff ? (
            <TriageScreen
              refCode={sheet.ref}
              role={role}
              onBack={() => setSheet(null)}
              onChanged={() => setReloadKey((k) => k + 1)}
              onMeasure={(ref) => setSheet({ kind: "measure", ref })}
            />
          ) : (
            <DetailScreen refCode={sheet.ref} onBack={() => setSheet(null)} />
          )
        ) : sheet?.kind === "measure" ? (
          <MeasureScreen
            refCode={sheet.ref}
            onBack={() => setSheet({ kind: "detail", ref: sheet.ref })}
            onSaved={() => setReloadKey((k) => k + 1)}
          />
        ) : sheet?.kind === "verify" ? (
          <VerificationScreen navigation={{ goBack: () => setSheet(null) }} />
        ) : sheet?.kind === "tracking" ? (
          <LiveTrackingScreen
            route={{ params: { complaintId: sheet.ref } }}
            navigation={{ goBack: () => setSheet(null) }}
          />
        ) : sheet?.kind === "voice" ? (
          <VoiceReportScreen
            navigation={{
              navigate: (screen: string, params: any) => {
                setSheet(null);
                if (screen === "LiveTracking") openTracking(params?.complaintId || "cmp-001");
              },
            }}
          />
        ) : sheet?.kind === "sos" ? (
          <EmergencySOSScreen />
        ) : sheet?.kind === "routes" ? (
          <SafeRouteScreen />
        ) : sheet?.kind === "toolkit" ? (
          <FieldToolkitScreen />
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
        ) : tab === "verify" ? (
          <VerificationScreen navigation={{ goBack: () => setTab("queue") }} />
        ) : tab === "report" ? (
          <ReportScreen
            onFiled={() => {
              setReloadKey((k) => k + 1);
              setTab(staff ? "queue" : "home");
            }}
          />
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
              <TabButton
                icon="inbox"
                label="Queue"
                on={tab === "queue"}
                onPress={() => {
                  setTab("queue");
                  setReloadKey((k) => k + 1);
                }}
              />
              <TabButton
                icon="map"
                label="Ops"
                on={tab === "ops"}
                onPress={() => {
                  setTab("ops");
                  setReloadKey((k) => k + 1);
                }}
              />

              <Pressable
                style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.96 }] }]}
                onPress={() => setTab("report")}
              >
                <Icon name="camera" size={23} color={C.brand} />
              </Pressable>

              <TabButton
                icon="check-circle"
                label="Verify"
                on={tab === "verify"}
                onPress={() => setTab("verify")}
              />
              <TabButton
                icon="user"
                label={t("tab.profile")}
                on={tab === "profile"}
                onPress={() => setTab("profile")}
              />
            </>
          ) : (
            <>
              <TabButton
                icon="home"
                label={t("tab.home")}
                on={tab === "home"}
                onPress={() => {
                  setTab("home");
                  setReloadKey((k) => k + 1);
                }}
              />

              <Pressable
                style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.96 }] }]}
                onPress={() => setTab("report")}
              >
                <Icon name="camera" size={23} color={C.brand} />
              </Pressable>

              <TabButton
                icon="bell"
                label={t("tab.updates")}
                on={tab === "alerts"}
                badge={unread}
                onPress={() => {
                  setTab("alerts");
                  setReloadKey((k) => k + 1);
                }}
              />
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function TabButton({
  icon,
  label,
  on,
  badge = 0,
  onPress,
}: {
  icon: IconName;
  label: string;
  on: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={s.tab} onPress={onPress}>
      <View style={[s.tabMark, on && s.tabMarkOn]} />
      <View>
        <Icon name={icon} size={20} color={on ? C.ink : C.muted} />
        {badge > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[s.tabText, on && s.tabOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
  },
  boot: { flex: 1, backgroundColor: C.dark, alignItems: "center", justifyContent: "center" },
  bootLogo: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: 6, marginBottom: S.lg },
  bar: {
    backgroundColor: C.bg,
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: { color: C.ink, fontWeight: "800", letterSpacing: 4, fontSize: 15 },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  avatarText: { color: C.ink, fontWeight: "800", fontSize: 15 },
  body: { flex: 1, backgroundColor: C.bg },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingBottom: S.sm,
    paddingTop: 6,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.dark,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
    borderWidth: 4,
    borderColor: C.surface,
    shadowColor: "#3a3226",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tab: { flex: 1, alignItems: "center", paddingBottom: 8 },
  tabMark: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: "transparent",
    marginBottom: 8,
  },
  tabMarkOn: { backgroundColor: C.ink },
  tabText: { fontSize: 10, color: C.muted, marginTop: 3, fontWeight: "700" },
  tabOn: { color: C.ink },
  badge: {
    position: "absolute",
    top: -5,
    right: -11,
    backgroundColor: C.coral,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: C.surface,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
