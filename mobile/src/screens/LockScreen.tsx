import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { C, S, F } from "../theme";
import { Button } from "../ui";
import { Icon } from "../Icon";

/**
 * Shown when the app is locked, which the user turns on in Profile.
 *
 * It prompts once by itself, because being made to tap "Unlock" before the
 * fingerprint prompt appears is a step nobody wants. If that first attempt is
 * cancelled the button is there to try again.
 */
export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [failed, setFailed] = useState(false);

  async function tryUnlock() {
    setFailed(false);
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock LUMEN",
      disableDeviceFallback: false,
    });
    if (r.success) onUnlock();
    else setFailed(true);
  }

  useEffect(() => { tryUnlock(); }, []);

  return (
    <View style={s.wrap}>
      <View style={s.disc}><Icon name="lock" size={34} color={C.ink} /></View>
      <Text style={s.title}>LUMEN is locked</Text>
      <Text style={s.body}>
        {failed
          ? "That did not work. Try again, or use your phone's passcode."
          : "Confirm it is you to carry on."}
      </Text>
      <Button label="Unlock" onPress={tryUnlock} style={{ marginTop: S.xxl, alignSelf: "stretch" }} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1, backgroundColor: C.bg, alignItems: "center",
    justifyContent: "center", padding: S.xxl,
  },
  disc: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: C.brand,
    alignItems: "center", justifyContent: "center", marginBottom: S.xl,
  },
  title: { ...F.title, textAlign: "center" },
  body: { ...F.body, textAlign: "center", marginTop: S.sm },
});
