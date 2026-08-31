import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from "react-native";
import { notifications, markNotificationsRead, Notification } from "../api";
import { T, statusLabel } from "../theme";

export default function AlertsScreen({ onOpen, onRead }: {
  onOpen: (ref: string) => void;
  onRead: () => void;
}) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const body = await notifications();
      setItems(body.notifications ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load updates.");
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (items === null) {
    return <View style={s.centre}><ActivityIndicator size="large" color={T.navy} /></View>;
  }

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={items.length ? s.list : s.listEmpty}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true); await load(); setRefreshing(false);
        }} />
      }
      ListHeaderComponent={
        items.length ? (
          <View style={s.head}>
            <Text style={s.h1}>Updates</Text>
            {unread > 0 && (
              <Pressable onPress={async () => { await markNotificationsRead(); await load(); onRead(); }}>
                <Text style={s.readAll}>Mark all read</Text>
              </Pressable>
            )}
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={s.centre}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyTitle}>{error ? "Could not load" : "No updates yet"}</Text>
          <Text style={s.emptyText}>
            {error ?? "When a department picks up or resolves one of your reports, it appears here."}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={[s.card, !item.readAt && s.cardUnread]}
          onPress={async () => {
            if (!item.readAt) { await markNotificationsRead(item.id); await load(); onRead(); }
            if (item.complaint?.ref) onOpen(item.complaint.ref);
          }}
        >
          <View style={s.rowTop}>
            <Text style={s.title} numberOfLines={2}>{item.title}</Text>
            {!item.readAt && <View style={s.dot} />}
          </View>
          {item.body && <Text style={s.body}>{item.body}</Text>}
          {item.complaint && (
            <Text style={s.meta}>
              {item.complaint.ref} · {statusLabel(item.complaint.status)}
            </Text>
          )}
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  list: { padding: 20, paddingBottom: 40, backgroundColor: T.bg },
  listEmpty: { flexGrow: 1, backgroundColor: T.bg },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  h1: { fontSize: 24, fontWeight: "800", color: T.ink },
  readAll: { color: T.accent, fontWeight: "700", fontSize: 13 },
  card: {
    backgroundColor: T.card, borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: T.line,
  },
  cardUnread: { borderColor: "#c7d2fe", backgroundColor: "#f5f7ff" },
  rowTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { fontSize: 15, fontWeight: "700", color: T.ink, flex: 1, paddingRight: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: T.accent, marginTop: 5 },
  body: { color: T.body, marginTop: 6, lineHeight: 19 },
  meta: { color: T.muted, fontSize: 12, marginTop: 8, fontWeight: "600" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: T.ink },
  emptyText: { color: T.muted, textAlign: "center", marginTop: 8, lineHeight: 20 },
});
