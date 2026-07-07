import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface GuildMemberRow {
  team_id: string;
  team_name: string;
  pdl: number;
  role: "leader" | "officer" | "member";
  name_color: string | null;
}

interface GuildPublicProfile {
  guild_id: string;
  name: string;
  description: string;
  is_public: boolean;
  leader_name: string;
  member_count: number;
  total_pdl: number;
  members: GuildMemberRow[];
}

const ERROR_KEY: Record<string, string> = {
  already_in_guild: "guild.errAlreadyInGuild",
  guild_full: "guild.errGuildFull",
};

export default function GuildPublicProfileScreen() {
  const { t } = useLanguage();
  const { alert } = useAppAlert();
  const params = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading]   = useState(true);
  const [profile, setProfile]   = useState<GuildPublicProfile | null>(null);
  const [inAnyGuild, setInAnyGuild] = useState(false);
  const [acting, setActing]     = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [{ data }, { data: myGuild }] = await Promise.all([
        supabase.rpc("get_guild_public_profile", { p_guild_id: params.id }),
        supabase.rpc("get_my_guild"),
      ]);
      if (!cancelled) {
        setProfile((data ?? null) as GuildPublicProfile | null);
        setInAnyGuild(!!myGuild);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [params.id]);

  const act = async () => {
    if (!profile || acting) return;
    setActing(true);
    const { error } = await supabase.rpc(profile.is_public ? "join_guild" : "request_join", { p_guild_id: profile.guild_id });
    setActing(false);
    if (error) {
      alert(t("common.error"), t(ERROR_KEY[error.message] ?? "guild.errGeneric"));
      return;
    }
    if (profile.is_public) {
      router.replace("/dashboard/guild" as any);
    } else {
      alert(t("guild.requestSentTitle"), t("guild.requestSentToast"), "success");
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader title={t("guild.headerTitle")} centered />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : !profile ? (
        <View style={s.center}>
          <Text style={s.emptyText}>{t("guild.publicProfileNotFound")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <View style={s.hero}>
            <Text style={s.guildName} numberOfLines={1}>{profile.name}</Text>
            <View style={[s.visibilityPill, { borderColor: profile.is_public ? "#10B98155" : "#6B728055" }]}>
              <Text style={[s.visibilityText, { color: profile.is_public ? "#10B981" : "#9CA3AF" }]}>
                {profile.is_public ? t("guild.publicBadge") : t("guild.privateBadge")}
              </Text>
            </View>
            {!!profile.description && <Text style={s.description}>{profile.description}</Text>}

            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statValue}>{profile.total_pdl}</Text>
                <Text style={s.statLabel}>{t("guild.totalPdl")}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{profile.member_count}/25</Text>
                <Text style={s.statLabel}>{t("ranking.membersCount")}</Text>
              </View>
            </View>

            {!inAnyGuild && (
              <TouchableOpacity style={s.actionBtn} disabled={acting} onPress={act} activeOpacity={0.85}>
                {acting
                  ? <ActivityIndicator size="small" color="#080808" />
                  : <Text style={s.actionBtnText}>{profile.is_public ? t("guild.joinBtn") : t("guild.requestJoinBtn")}</Text>}
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.sectionLabel}>{t("guild.membersSection")}</Text>
          {profile.members.map((m) => (
            <TouchableOpacity
              key={m.team_id}
              style={s.memberRow}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: "/dashboard/team/[id]", params: { id: m.team_id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.memberName, m.name_color ? { color: m.name_color } : null]} numberOfLines={1}>
                  {m.team_name}
                </Text>
                <Text style={s.memberRole}>
                  {m.role === "leader" ? t("guild.roleLeader") : m.role === "officer" ? t("guild.roleOfficer") : t("guild.roleMember")}
                </Text>
              </View>
              <Text style={s.memberPdl}>{m.pdl}</Text>
            </TouchableOpacity>
          ))}
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

  hero: {
    alignItems: "center", gap: 8,
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 16, padding: 20, marginBottom: 20,
  },
  guildName: { fontSize: 20, fontWeight: "900", color: "#FFFFFF" },
  visibilityPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  visibilityText: { fontSize: 10, fontWeight: "900" },
  description: { fontSize: 12, color: "#9CA3AF", textAlign: "center" },

  statsRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 6 },
  statItem: { alignItems: "center", minWidth: 64 },
  statValue: { fontSize: 16, fontWeight: "900", color: "#EC4899" },
  statLabel: { fontSize: 9, fontWeight: "800", color: "#4B5563", letterSpacing: 1, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: "#1A1A1A" },

  actionBtn: {
    marginTop: 10, height: 40, paddingHorizontal: 24, borderRadius: 10,
    backgroundColor: "#EC4899", justifyContent: "center", alignItems: "center", minWidth: 160,
  },
  actionBtnText: { fontSize: 11, fontWeight: "900", color: "#080808", letterSpacing: 0.5 },

  sectionLabel: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 10, marginTop: 4,
  },

  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 8,
  },
  memberName: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  memberRole: { fontSize: 10, color: "#6B7280", marginTop: 2, fontWeight: "700" },
  memberPdl: { fontSize: 13, fontWeight: "900", color: "#EC4899" },
});
