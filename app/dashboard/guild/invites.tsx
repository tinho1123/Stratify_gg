import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
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

interface InviteRow {
  id: string;
  kind: "invite" | "request";
  guild_id: string;
  guild_name: string;
  created_at: string;
}

const ERROR_KEY: Record<string, string> = {
  already_in_guild: "guild.errAlreadyInGuild",
  guild_full: "guild.errGuildFull",
  not_authorized: "guild.errNotAuthorized",
};

export default function GuildInvitesScreen() {
  const { t } = useLanguage();
  const { alert } = useAppAlert();

  const [loading, setLoading] = useState(true);
  const [rows, setRows]       = useState<InviteRow[]>([]);
  const [busyId, setBusyId]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("get_my_guild_invites");
    setRows((data ?? []) as InviteRow[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const respond = async (row: InviteRow, accept: boolean) => {
    setBusyId(row.id);
    const { error } = await supabase.rpc(accept ? "accept_invite" : "decline_invite", { p_invite_id: row.id });
    setBusyId(null);
    if (error) {
      alert(t("common.error"), t(ERROR_KEY[error.message] ?? "guild.errGeneric"));
      return;
    }
    if (accept && row.kind === "invite") {
      router.replace("/dashboard/guild" as any);
      return;
    }
    fetchData();
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader title={t("guild.invitesTitle")} centered />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {rows.length === 0 ? (
            <View style={s.center}>
              <Text style={s.emptyText}>{t("guild.invitesEmptyState")}</Text>
            </View>
          ) : (
            rows.map((r) => (
              <View key={r.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.guildName} numberOfLines={1}>{r.guild_name}</Text>
                  <Text style={s.kind}>{r.kind === "invite" ? t("guild.invitedYou") : t("guild.requestedToJoin")}</Text>
                </View>
                <TouchableOpacity style={s.acceptBtn} disabled={busyId === r.id} onPress={() => respond(r, true)}>
                  {busyId === r.id ? <ActivityIndicator size="small" color="#080808" /> : <Text style={s.acceptBtnText}>{t("guild.acceptBtn")}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.declineBtn} disabled={busyId === r.id} onPress={() => respond(r, false)}>
                  <Text style={s.declineBtnText}>{t("guild.declineBtn")}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#080808" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  loadingText: { fontSize: 13, color: "#6B7280" },
  emptyText:   { fontSize: 12, color: "#6B7280" },

  row: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 8,
  },
  guildName: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  kind:      { fontSize: 10, color: "#6B7280", marginTop: 2, fontWeight: "700" },

  acceptBtn: { backgroundColor: "#10B981", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 64, alignItems: "center" },
  acceptBtnText: { fontSize: 10, fontWeight: "900", color: "#080808" },
  declineBtn: { backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  declineBtnText: { fontSize: 10, fontWeight: "900", color: "#9CA3AF" },
});
