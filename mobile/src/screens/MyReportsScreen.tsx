import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from "react-native";
import { myComplaints, Complaint } from "../api";
import { T, priorityColour, statusLabel } from "../theme";

export default function MyReportsScreen({ onOpen, reloadKey }: {
  onOpen: (ref: string) => void;
  reloadKey: number;
}) {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await myComplaints());
    } catch (e: any) {
      setError(e?.message ?? "Could not load your reports.");
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  if (items === null) {
    return <View style={s.centre}><ActivityIndicator size="large" color={T.navy} /></View>;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.id}
      contentContainerStyle={items.length ? s.list : s.listEmpty}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true); await load(); setRefreshing(false);
        }} />
      }
      ListHeaderComponent={
        items.length ? <Text style={s.h1}>My reports</Text> : null
      }
      ListEmptyComponent={
        <View style={s.centre}>
          <Text style={s.emptyIcon}>🗒️</Text>
          <Text style={s.emptyTitle}>{error ? "Could not load" : "Nothing reported yet"}</Text>
          <Text style={s.emptyText}>
            {error ?? "Photograph a pothole, a garbage pile or an open manhole and it will appear here."}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable style={s.card} onPress={() => onOpen(item.ref)}>
          <View style={s.rowTop}>
            <Text style={s.ref}>{item.ref}</Text>
            <View style={[s.pill, { backgroundColor: priorityColour(item.priority) + "1a" }]}>
              <Text style={[s.pillText, { color: priorityColour(item.priority) }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </View>
          <Text style={s.title} numberOfLines={2}>{item.title}</Text>
          <Text style={s.meta}>
            {item.category ?? "Unclassified"}
            {item.department?.name ? ` · ${item.department.name}` : ""}
            {item.severityScore != null ? ` · severity ${Math.round(item.severityScore)}/100` : ""}
          </Text>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  list: { padding: 20, paddingBottom: 40, backgroundColor: T.bg },
  listEmpty: { flexGrow: 1, backgroundColor: T.bg },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  h1: { fontSize: 24, fontWeight: "800", color: T.ink, marginBottom: 16 },
  card: {
    backgroundColor: T.card, borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: T.line,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { color: T.accent, fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText: { fontSize: 11, fontWeight: "800" },
  title: { fontSize: 16, fontWeight: "700", color: T.ink, marginTop: 8 },
  meta: { color: T.muted, fontSize: 13, marginTop: 6 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: T.ink },
  emptyText: { color: T.muted, textAlign: "center", marginTop: 8, lineHeight: 20 },
});
