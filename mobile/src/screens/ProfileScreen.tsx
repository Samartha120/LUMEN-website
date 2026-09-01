import { useEffect, useState } from "react";
import {
  Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../api";
import { readOutbox } from "../outbox";
import { C, S, R, F, card } from "../theme";
import { Button } from "../ui";
import { Icon, IconName } from "../Icon";
import { useT, LANGUAGES, Lang } from "../i18n";

export const LOCK_KEY = "lumen_lock";

export default function ProfileScreen({ user, onSignOut, onOpenOutbox, onOpenHelp }: {
  user: any;
  onSignOut: () => void;
  onOpenOutbox: () => void;
  onOpenHelp: () => void;
}) {
  const { t, lang, setLang } = useT();
  const [lock, setLock] = useState(false);
  const [canLock, setCanLock] = useState(false);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    (async () => {
      // Offer the lock only if the phone actually has a fingerprint or face
      // enrolled. A switch that turns nothing on is worse than no switch.
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setCanLock(hw && enrolled);
      setLock((await AsyncStorage.getItem(LOCK_KEY)) === "1");
      setQueued((await readOutbox()).length);
    })();
  }, []);

  async function toggleLock(next: boolean) {
    if (next) {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm it is you",
        disableDeviceFallback: false,
      });
      if (!r.success) return;
    }
    setLock(next);
    await AsyncStorage.setItem(LOCK_KEY, next ? "1" : "0");
  }

  const initial = String(user?.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}>
        <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{user?.name ?? "Citizen"}</Text>
          <Text style={s.email}>{user?.email ?? ""}</Text>
        </View>
      </View>
      <View style={s.roleChip}>
        <Text style={s.roleText}>{String(user?.role ?? "CITIZEN").replace("_", " ")}</Text>
      </View>

      <Text style={s.section}>{t("profile.yourReports")}</Text>
      <View style={[card, s.group]}>
        <Row icon="upload-cloud" label={t("profile.waiting")}
          value={queued ? String(queued) : t("profile.none")}
          onPress={onOpenOutbox} />
        <Row icon="help-circle" label={t("profile.howItWorks")} onPress={onOpenHelp} last />
      </View>

      {/* Chosen here rather than buried in a system menu. A resident who reads
          Kannada should not have to navigate English to say so. */}
      <Text style={s.section}>{t("profile.language")}</Text>
      <View style={[card, s.group, s.langGroup]}>
        {(Object.keys(LANGUAGES) as Lang[]).map((code) => {
          const on = lang === code;
          return (
            <Pressable key={code} onPress={() => setLang(code)}
              style={[s.lang, on && s.langOn]}>
              <Text style={[s.langText, on && s.langTextOn]}>{LANGUAGES[code]}</Text>
              {on && <Icon name="check" size={15} color={C.ink} />}
            </Pressable>
          );
        })}
      </View>

      <Text style={s.section}>{t("profile.security")}</Text>
      <View style={[card, s.group]}>
        <View style={[s.row, s.rowLast]}>
          <View style={[s.rowIcon, { backgroundColor: C.brandSoft }]}>
            <Icon name="lock" size={17} color={C.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>{t("profile.lock")}</Text>
            <Text style={s.rowSub}>
              {canLock
                ? t("profile.lockOn")
                : t("profile.lockNone")}
            </Text>
          </View>
          <Switch
            value={lock} onValueChange={toggleLock} disabled={!canLock}
            trackColor={{ true: C.brand, false: C.line }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <Text style={s.section}>{t("profile.about")}</Text>
      <View style={[card, s.group]}>
        <Row icon="server" label={t("profile.connectedTo")} value={API_URL.replace(/^https?:\/\//, "")} />
        <Row icon="cpu" label={t("profile.detection")} value="YOLO11 · on the server" />
        <Row icon="info" label={t("profile.version")} value="1.0.0" last />
      </View>

      <Text style={s.section}>{t("profile.privacy")}</Text>
      <View style={[card, s.group]}>
        <View style={[s.row, s.rowLast]}>
          <View style={[s.rowIcon, { backgroundColor: C.skySoft }]}>
            <Icon name="eye" size={17} color={C.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>{t("profile.canSee")}</Text>
            <Text style={s.rowSub}>
              {t("profile.canSeeBody")}
            </Text>
          </View>
        </View>
      </View>

      <Button label={t("profile.signOut")} variant="secondary" style={{ marginTop: S.xxl }}
        onPress={() => Alert.alert(t("profile.signOut"), t("profile.signOutConfirm"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("profile.signOut"), style: "destructive", onPress: onSignOut },
        ])} />

      <Pressable onPress={() => Linking.openURL("http://localhost:5173").catch(() => {})}>
        <Text style={s.foot}>LUMEN · civic damage reporting</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ icon, label, value, onPress, last }: {
  icon: IconName; label: string; value?: string; onPress?: () => void; last?: boolean;
}) {
  const body = (
    <View style={[s.row, last && s.rowLast]}>
      <View style={s.rowIcon}><Icon name={icon} size={17} color={C.body} /></View>
      <Text style={s.rowLabel}>{label}</Text>
      {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : null}
      {onPress ? <Icon name="chevron-right" size={17} color={C.muted} /> : null}
    </View>
  );
  return onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>{body}</Pressable>
    : body;
}

const s = StyleSheet.create({
  wrap: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", gap: S.lg },
  avatar: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: C.brand,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: C.ink, fontSize: 26, fontWeight: "800" },
  name: { ...F.title },
  email: { ...F.caption, marginTop: 2 },
  roleChip: {
    alignSelf: "flex-start", marginTop: S.md, backgroundColor: C.dark,
    paddingHorizontal: S.md, paddingVertical: 5, borderRadius: R.pill,
  },
  roleText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },

  section: { ...F.overline, marginTop: S.xxl, marginBottom: S.md },
  group: { padding: 0, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    paddingHorizontal: S.lg, paddingVertical: S.lg,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 34, height: 34, borderRadius: R.sm, backgroundColor: C.raised,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: { ...F.bodyStrong, flex: 1 },
  rowSub: { ...F.caption, fontSize: 12, marginTop: 2, lineHeight: 17 },
  rowValue: { ...F.caption, maxWidth: "45%", textAlign: "right" },

  langGroup: { flexDirection: "row", padding: S.xs, gap: S.xs },
  lang: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: S.md, borderRadius: R.md,
  },
  langOn: { backgroundColor: C.brand },
  langText: { ...F.bodyStrong, color: C.body, fontSize: 14 },
  langTextOn: { color: C.ink, fontWeight: "800" },

  foot: { ...F.caption, fontSize: 11, textAlign: "center", marginTop: S.xl },
});
