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

export const LOCK_KEY = "lumen_lock";

export default function ProfileScreen({ user, onSignOut, onOpenOutbox, onOpenHelp }: {
  user: any;
  onSignOut: () => void;
  onOpenOutbox: () => void;
  onOpenHelp: () => void;
}) {
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

      <Text style={s.section}>Your reports</Text>
      <View style={[card, s.group]}>
        <Row icon="upload-cloud" label="Waiting to send"
          value={queued ? `${queued} report${queued === 1 ? "" : "s"}` : "None"}
          onPress={onOpenOutbox} />
        <Row icon="help-circle" label="How reporting works" onPress={onOpenHelp} last />
      </View>

      <Text style={s.section}>Security</Text>
      <View style={[card, s.group]}>
        <View style={[s.row, s.rowLast]}>
          <View style={[s.rowIcon, { backgroundColor: C.brandSoft }]}>
            <Icon name="lock" size={17} color={C.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Lock the app</Text>
            <Text style={s.rowSub}>
              {canLock
                ? "Ask for your fingerprint or face when the app opens"
                : "No fingerprint or face is set up on this phone"}
            </Text>
          </View>
          <Switch
            value={lock} onValueChange={toggleLock} disabled={!canLock}
            trackColor={{ true: C.brand, false: C.line }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <Text style={s.section}>About</Text>
      <View style={[card, s.group]}>
        <Row icon="server" label="Connected to" value={API_URL.replace(/^https?:\/\//, "")} />
        <Row icon="cpu" label="Detection" value="YOLO11 · on the server" />
        <Row icon="info" label="Version" value="1.0.0" last />
      </View>

      <Text style={s.section}>Privacy</Text>
      <View style={[card, s.group]}>
        <View style={[s.row, s.rowLast]}>
          <View style={[s.rowIcon, { backgroundColor: C.skySoft }]}>
            <Icon name="eye" size={17} color={C.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>What this app can see</Text>
            <Text style={s.rowSub}>
              Only the reports you filed. The scope is enforced in the database
              query on the server, not filtered on this phone, so another
              resident's complaint never leaves it.
            </Text>
          </View>
        </View>
      </View>

      <Button label="Sign out" variant="secondary" style={{ marginTop: S.xxl }}
        onPress={() => Alert.alert("Sign out?", "You will need to sign in again to file a report.", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign out", style: "destructive", onPress: onSignOut },
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

  foot: { ...F.caption, fontSize: 11, textAlign: "center", marginTop: S.xl },
});
