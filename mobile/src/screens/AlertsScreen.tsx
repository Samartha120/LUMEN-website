import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from "react-native";
import { notifications, markNotificationsRead, Notification } from "../api";
import { C, S, R, F, card, statusLabel, ago } from "../theme";
import { Empty } from "../ui";

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
    return <View style={s.centre}><ActivityIndicator size="large" color={C.brand} /></View>;
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
        <Empty
          icon={error ? "⚠️" : "🔔"}
          title={error ? "Could not load" : "No updates yet"}
          body={error ?? "When a department picks up or resolves one of your reports, it appears here."}
        />
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
          <View style={s.metaRow}>
            {item.complaint && (
              <Text style={s.meta}>
                {item.complaint.ref} · {statusLabel(item.complaint.status)}
              </Text>
            )}
            <Text style={s.meta}>{ago(item.createdAt)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  list: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg },
  listEmpty: { flexGrow: 1, backgroundColor: C.bg, padding: S.xl },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  head: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: S.lg,
  },
  h1: { ...F.display },
  readAll: { color: C.accent, fontWeight: "700", fontSize: 13 },
  card: { ...card, marginBottom: S.md },
  cardUnread: { borderColor: "#cfd8ff", backgroundColor: "#f7f9ff" },
  rowTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { ...F.bodyStrong, flex: 1, paddingRight: S.md },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent, marginTop: 6 },
  body: { ...F.body, marginTop: 6 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: S.md },
  meta: { ...F.caption, fontSize: 12, fontWeight: "600" },
});
