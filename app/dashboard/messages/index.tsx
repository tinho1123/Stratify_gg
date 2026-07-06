import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { getTierInfo } from "@/constants/tiers";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConversationRow {
  conversation_id: string;
  other_team_id: string;
  other_team_name: string;
  other_pdl: number;
  other_name_color: string | null;
  last_message: string | null;
  last_message_at: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MessagesInboxScreen() {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("get_my_conversations");
    setConversations((data ?? []) as ConversationRow[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader title={t("messages.headerTitle")} centered />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>✉️</Text>
          <Text style={s.emptyText}>{t("messages.emptyState")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {conversations.map((c) => {
            const info = getTierInfo(c.other_pdl ?? 0);
            return (
              <TouchableOpacity
                key={c.conversation_id}
                style={s.row}
                activeOpacity={0.75}
                onPress={() => router.push({ pathname: "/dashboard/messages/[id]", params: { id: c.conversation_id } })}
              >
                <View style={[s.avatar, { borderColor: info.color + "55" }]}>
                  <Text style={s.avatarText}>{c.other_team_name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[s.teamName, c.other_name_color ? { color: c.other_name_color } : null]}
                    numberOfLines={1}
                  >
                    {c.other_team_name}
                  </Text>
                  <Text style={s.preview} numberOfLines={1}>
                    {c.last_message ?? t("messages.noMessagesYet")}
                  </Text>
                </View>
                <Text style={s.time}>{formatTime(c.last_message_at)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#080808" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#6B7280" },
  emptyEmoji:  { fontSize: 32 },
  emptyText:   { fontSize: 12, color: "#6B7280", textAlign: "center", paddingHorizontal: 32 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 8,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#161616", borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "900", color: "#FFFFFF" },
  teamName:   { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  preview:    { fontSize: 11, color: "#6B7280", marginTop: 2 },
  time:       { fontSize: 10, color: "#4B5563", fontWeight: "700" },
});
