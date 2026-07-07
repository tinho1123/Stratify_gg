import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

interface GuildRow {
  guild_id: string;
  guild_name: string;
  is_public: boolean;
  member_count: number;
  total_pdl: number;
}

const ERROR_KEY: Record<string, string> = {
  already_in_guild: "guild.errAlreadyInGuild",
  guild_full: "guild.errGuildFull",
};

export default function BrowseGuildsScreen() {
  const { t } = useLanguage();
  const { alert } = useAppAlert();

  const [loading, setLoading] = useState(true);
  const [rows, setRows]       = useState<GuildRow[]>([]);
  const [query, setQuery]     = useState("");
  const [busyId, setBusyId]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("get_guild_leaderboard", { p_limit: 200 });
    setRows((data ?? []) as GuildRow[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.guild_name.toLowerCase().includes(q));
  }, [rows, query]);

  const act = async (guild: GuildRow) => {
    setBusyId(guild.guild_id);
    const { error } = await supabase.rpc(guild.is_public ? "join_guild" : "request_join", { p_guild_id: guild.guild_id });
    setBusyId(null);
    if (error) {
      alert(t("common.error"), t(ERROR_KEY[error.message] ?? "guild.errGeneric"));
      return;
    }
    if (guild.is_public) {
      router.replace("/dashboard/guild" as any);
    } else {
      alert(t("guild.requestSentTitle"), t("guild.requestSentToast"), "success");
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader title={t("guild.browseTitle")} centered />

      <View style={{ paddingHorizontal: 16 }}>
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder={t("guild.namePlaceholder")}
          placeholderTextColor="#4B5563"
        />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {filtered.length === 0 ? (
            <View style={s.center}>
              <Text style={s.emptyText}>{t("guild.browseEmptyState")}</Text>
            </View>
          ) : (
            filtered.map((r) => (
              <TouchableOpacity
                key={r.guild_id}
                style={s.row}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: "/dashboard/guild/[id]", params: { id: r.guild_id } } as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.guildName} numberOfLines={1}>{r.guild_name}</Text>
                  <Text style={s.meta}>
                    {r.member_count}/25 {t("ranking.membersCount")} · {r.total_pdl} PDL
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.actionBtn}
                  disabled={busyId === r.guild_id}
                  onPress={() => act(r)}
                >
                  {busyId === r.guild_id
                    ? <ActivityIndicator size="small" color="#080808" />
                    : <Text style={s.actionBtnText}>{r.is_public ? t("guild.joinBtn") : t("guild.requestJoinBtn")}</Text>}
                </TouchableOpacity>
              </TouchableOpacity>
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

  search: {
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1F1F1F",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, color: "#FFFFFF", marginBottom: 8,
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 8,
  },
  guildName: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  meta:      { fontSize: 10, color: "#6B7280", marginTop: 3, fontWeight: "700" },

  actionBtn: { backgroundColor: "#EC4899", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, minWidth: 90, alignItems: "center" },
  actionBtnText: { fontSize: 11, fontWeight: "900", color: "#080808" },
});
