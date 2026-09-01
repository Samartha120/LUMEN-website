import { useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import {
  saveMeasurements, suggestDimensions, PotholeMeasurement, RoadType,
} from "../../api";
import { C, S, R, F, card } from "../../theme";
import { Button } from "../../ui";
import { Badge, Banner, Field, KeyValue, Segmented } from "../../components";
import { Icon } from "../../Icon";
import { rupees } from "../../utils";

/**
 * What the engineer measured, on site, with a tape.
 *
 * The detector's estimate can be pulled in as a starting point, and the server
 * marks anything from it as ESTIMATED rather than MEASURED — the distinction
 * matters when the numbers become a material order. Overwriting a suggested
 * row flips it to MEASURED, because at that point somebody has actually looked.
 */

const EMPTY: PotholeMeasurement = {
  label: "P1", lengthM: 0, widthM: 0, depthM: 0, source: "MEASURED",
};

/** Volume in cubic metres, which is what the material order is priced from. */
function volumeOf(p: PotholeMeasurement) {
  return p.lengthM * p.widthM * p.depthM;
}

export default function MeasureScreen({ refCode, onBack, onSaved }: {
  refCode: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [roadType, setRoadType] = useState<RoadType>("BITUMINOUS");
  const [rows, setRows] = useState<PotholeMeasurement[]>([{ ...EMPTY }]);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<PotholeMeasurement>) {
    setRows((r) => r.map((row, j) => (j === i
      // Typing over a suggested figure means someone measured it.
      ? { ...row, ...patch, source: "source" in patch ? row.source : "MEASURED" }
      : row)));
  }

  function addRow() {
    setRows((r) => [...r, { ...EMPTY, label: `P${r.length + 1}` }]);
  }

  function removeRow(i: number) {
    setRows((r) => (r.length === 1 ? r : r.filter((_, j) => j !== i)));
  }

  async function pullSuggestion() {
    setSuggesting(true); setError(null);
    try {
      const out = await suggestDimensions(refCode);
      setRows(out.potholes.map((p, i) => ({ ...p, label: p.label || `P${i + 1}` })));
      setNote(out.note);
    } catch (e: any) {
      setError(e?.message ?? "No estimate available for this complaint.");
    } finally {
      setSuggesting(false);
    }
  }

  /** The same rules the server applies, so the error arrives before the request. */
  function problem(): string | null {
    for (const [i, p] of rows.entries()) {
      const n = i + 1;
      if (![p.lengthM, p.widthM, p.depthM].every((v) => Number.isFinite(v) && v > 0)) {
        return `Pothole ${n}: length, width and depth must all be greater than zero.`;
      }
      if (p.lengthM > 50 || p.widthM > 50 || p.depthM > 5) {
        return `Pothole ${n}: those look like centimetres. The form is in metres.`;
      }
    }
    return null;
  }

  async function save() {
    const bad = problem();
    if (bad) return setError(bad);
    setError(null);
    setBusy(true);
    try {
      await saveMeasurements(refCode, roadType, rows);
      onSaved();
      Alert.alert("Recorded", `${rows.length} measurement${rows.length === 1 ? "" : "s"} saved against ${refCode}.`);
      onBack();
    } catch (e: any) {
      setError(e?.message ?? "The server would not accept those measurements.");
    } finally {
      setBusy(false);
    }
  }

  const totalVolume = rows.reduce((sum, p) => sum + volumeOf(p), 0);
  const estimated = rows.filter((p) => p.source === "ESTIMATED").length;

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={12} style={s.backRow}>
        <Icon name="chevron-left" size={18} color={C.ink} />
        <Text style={s.back}>{refCode}</Text>
      </Pressable>

      <Text style={s.h1}>Measurements</Text>
      <Text style={s.sub}>
        Metres. These become the material order, so a centimetre in the wrong
        column is a lorry-load of asphalt.
      </Text>

      <Text style={s.section}>Road surface</Text>
      <Segmented
        value={roadType}
        onChange={setRoadType}
        options={[
          { value: "BITUMINOUS", label: "Bituminous" },
          { value: "CONCRETE", label: "Concrete" },
        ]}
      />

      <View style={s.suggestRow}>
        <Pressable onPress={pullSuggestion} disabled={suggesting}
          style={({ pressed }) => [s.suggest, pressed && { opacity: 0.9 }]}>
          {suggesting
            ? <ActivityIndicator size="small" color={C.ink} />
            : <Icon name="cpu" size={16} color={C.ink} />}
          <Text style={s.suggestText}>Estimate from the photograph</Text>
        </Pressable>
      </View>

      {note && (
        <Banner
          tone="info"
          title="Estimated, not measured"
          body={note}
          style={{ marginTop: S.md }}
        />
      )}

      <Text style={s.section}>Potholes</Text>
      {rows.map((p, i) => (
        <View key={i} style={[card, s.row]}>
          <View style={s.rowHead}>
            <Text style={s.rowLabel}>{p.label || `P${i + 1}`}</Text>
            <Badge
              label={p.source === "ESTIMATED" ? "ESTIMATED" : "MEASURED"}
              tone={p.source === "ESTIMATED" ? "warn" : "good"}
              size="sm"
            />
            <View style={{ flex: 1 }} />
            {rows.length > 1 && (
              <Pressable onPress={() => removeRow(i)} hitSlop={8}>
                <Icon name="trash-2" size={17} color={C.bad} />
              </Pressable>
            )}
          </View>

          <View style={s.dims}>
            {(["lengthM", "widthM", "depthM"] as const).map((k) => (
              <Field
                key={k}
                style={s.dim}
                label={k === "lengthM" ? "Length" : k === "widthM" ? "Width" : "Depth"}
                keyboardType="decimal-pad"
                value={p[k] ? String(p[k]) : ""}
                placeholder="0.0"
                onChangeText={(v) => update(i, { [k]: Number(v) || 0 } as Partial<PotholeMeasurement>)}
              />
            ))}
          </View>

          <Text style={s.volume}>
            {volumeOf(p) > 0 ? `${volumeOf(p).toFixed(3)} m³` : "—"}
          </Text>
        </View>
      ))}

      <Pressable onPress={addRow} style={({ pressed }) => [s.add, pressed && { opacity: 0.9 }]}>
        <Icon name="plus" size={17} color={C.ink} />
        <Text style={s.addText}>Add another pothole</Text>
      </Pressable>

      <Text style={s.section}>Total</Text>
      <View style={[card, s.total]}>
        <KeyValue label="Potholes recorded" value={String(rows.length)} />
        <KeyValue label="Combined volume" value={`${totalVolume.toFixed(3)} m³`} />
        <KeyValue
          label="Rough material cost"
          // A working figure only: the authoritative estimate comes from the
          // server, which knows the current rates.
          value={rupees(totalVolume * (roadType === "CONCRETE" ? 9500 : 7200))}
        />
        <KeyValue
          label="From the photograph"
          value={estimated ? `${estimated} of ${rows.length}` : "None"}
          tint={estimated ? C.warn : undefined}
          last
        />
      </View>

      {error && <Banner tone="bad" title="Cannot save" body={error} style={{ marginTop: S.lg }} />}

      <Button label="Save measurements" onPress={save} busy={busy} style={{ marginTop: S.xl }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg, flexGrow: 1 },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: S.lg, marginLeft: -4 },
  back: { color: C.ink, fontWeight: "800", fontSize: 14 },
  h1: { ...F.display },
  sub: { ...F.body, color: C.muted, marginTop: S.xs },
  section: { ...F.overline, marginTop: S.xxl, marginBottom: S.md },

  suggestRow: { marginTop: S.md },
  suggest: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.sm,
    backgroundColor: C.brand, borderRadius: R.pill, paddingVertical: 13,
  },
  suggestText: { color: C.ink, fontWeight: "800", fontSize: 14 },

  row: { padding: S.lg, marginBottom: S.md },
  rowHead: { flexDirection: "row", alignItems: "center", gap: S.md, marginBottom: S.md },
  rowLabel: { ...F.heading },
  dims: { flexDirection: "row", gap: S.sm },
  dim: { flex: 1 },
  volume: { ...F.caption, textAlign: "right", marginTop: S.sm, fontWeight: "700" },

  add: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.sm,
    borderWidth: 1.5, borderColor: C.lineStrong, borderStyle: "dashed",
    borderRadius: R.md, paddingVertical: 14,
  },
  addText: { ...F.bodyStrong, fontSize: 14 },

  total: { padding: S.lg },
});
