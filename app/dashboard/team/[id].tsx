import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { getRatingColor, STATUS_COLOR } from "@/constants/playerStatus";
import { getTierInfo } from "@/constants/tiers";
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface RosterEntry {
  name: string;
  role: string;
  rating: number;
  status: string;
}

interface AchievementEntry {
  key: string;
  name: string;
  category: string;
}

interface PublicProfile {
  team_id: string;
  team_name: string;
  pdl: number;
  wins: number;
  losses: number;
  fans: number;
  name_color: string | null;
  frame_color: string | null;
  roster: RosterEntry[];
  achievements: AchievementEntry[];
}

function fmtFans(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TeamProfileScreen() {
  const { t } = useLanguage();
  const { alert } = useAppAlert();
  const params = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading]     = useState(true);
  const [profile, setProfile]     = useState<PublicProfile | null>(null);
  const [myTeamId, setMyTeamId]   = useState<string | null>(null);
  const [startingDm, setStartingDm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [{ data }, { data: myTeam }] = await Promise.all([
        supabase.rpc("get_team_public_profile", { p_team_id: params.id }),
        supabase.from("teams").select("id").single(),
      ]);
      if (!cancelled) {
        setProfile((data ?? null) as PublicProfile | null);
        setMyTeamId(myTeam?.id ?? null);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [params.id]);

  const info = profile ? getTierInfo(profile.pdl) : null;
  const isMe = !!profile && profile.team_id === myTeamId;

  const messageTeam = async () => {
    if (!profile || startingDm) return;
    setStartingDm(true);
    const { data: conversationId, error } = await supabase.rpc("start_dm_conversation", {
      p_other_team_id: profile.team_id,
    });
    setStartingDm(false);
    if (conversationId) {
      router.push({ pathname: "/dashboard/messages/[id]", params: { id: conversationId } });
    } else if (error) {
      alert(t("common.error"), t("teamProfile.dmError"));
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader title={t("teamProfile.headerTitle")} centered />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : !profile ? (
        <View style={s.center}>
          <Text style={s.emptyText}>{t("teamProfile.notFound")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

          {/* ── HERO ────────────────────────────────────── */}
          <View style={s.hero}>
            <Text
              style={[s.teamName, profile.name_color ? { color: profile.name_color } : null]}
              numberOfLines={1}
            >
              {profile.team_name}
            </Text>
            {info && (
              <View style={[s.eloPill, { borderColor: info.color + "55" }]}>
                <View style={[s.eloDot, { backgroundColor: info.color }]} />
                <Text style={[s.eloPillText, { color: info.color }]}>
                  {info.tier}{info.division ? ` ${info.division}` : ""}
                </Text>
              </View>
            )}
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statValue}>{profile.wins}</Text>
                <Text style={s.statLabel}>{t("teamProfile.wins")}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{profile.losses}</Text>
                <Text style={s.statLabel}>{t("teamProfile.losses")}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{fmtFans(profile.fans)}</Text>
                <Text style={s.statLabel}>{t("teamProfile.fans")}</Text>
              </View>
            </View>

            {!isMe && (
              <TouchableOpacity style={s.messageBtn} onPress={messageTeam} disabled={startingDm} activeOpacity={0.8}>
                {startingDm
                  ? <ActivityIndicator size="small" color="#080808" />
                  : <Text style={s.messageBtnText}>{t("teamProfile.messageBtn")}</Text>}
              </TouchableOpacity>
            )}
          </View>

          {/* ── ELENCO ──────────────────────────────────── */}
          <Text style={s.sectionLabel}>{t("teamProfile.roster")}</Text>
          {profile.roster.length === 0 ? (
            <Text style={s.emptySection}>{t("teamProfile.rosterEmpty")}</Text>
          ) : (
            profile.roster.map((p, i) => (
              <View key={i} style={s.playerRow}>
                <View style={[s.playerAvatar, profile.frame_color ? { borderColor: profile.frame_color } : null]}>
                  <Text style={s.playerAvatarText}>{p.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.playerName}>{p.name}</Text>
                  <Text style={s.playerRole}>{p.role}</Text>
                </View>
                <View style={[s.statusPill, { borderColor: (STATUS_COLOR[p.status] ?? "#6B7280") + "88" }]}>
                  <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[p.status] ?? "#6B7280" }]} />
                </View>
                <View style={[s.ratingBadge, { backgroundColor: getRatingColor(p.rating) + "22" }]}>
                  <Text style={[s.ratingText, { color: getRatingColor(p.rating) }]}>{p.rating}</Text>
                </View>
              </View>
            ))
          )}

          {/* ── CONQUISTAS ──────────────────────────────── */}
          <Text style={s.sectionLabel}>{t("teamProfile.achievements")}</Text>
          {profile.achievements.length === 0 ? (
            <Text style={s.emptySection}>{t("teamProfile.achievementsEmpty")}</Text>
          ) : (
            <View style={s.achievementsWrap}>
              {profile.achievements.map((a) => (
                <View key={a.key} style={s.achievementChip}>
                  <Text style={s.achievementIcon}>🏆</Text>
                  <Text style={s.achievementLabel} numberOfLines={1}>{a.name}</Text>
                </View>
              ))}
            </View>
          )}
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
  emptyText:   { fontSize: 12, color: "#6B7280" },

  hero: {
    alignItems: "center", gap: 10,
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 16, padding: 20, marginBottom: 20,
  },
  teamName: { fontSize: 20, fontWeight: "900", color: "#FFFFFF" },

  eloPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  eloDot:      { width: 6, height: 6, borderRadius: 3 },
  eloPillText: { fontSize: 11, fontWeight: "900" },

  statsRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 },
  statItem: { alignItems: "center", minWidth: 48 },
  statValue: { fontSize: 15, fontWeight: "900", color: "#FFFFFF" },
  statLabel: { fontSize: 9, fontWeight: "800", color: "#4B5563", letterSpacing: 1, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: "#1A1A1A" },

  messageBtn: {
    marginTop: 6, height: 38, paddingHorizontal: 20, borderRadius: 10,
    backgroundColor: "#EC4899", justifyContent: "center", alignItems: "center",
    minWidth: 140,
  },
  messageBtnText: { fontSize: 11, fontWeight: "900", color: "#080808", letterSpacing: 0.5 },

  sectionLabel: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 10, marginTop: 4,
  },
  emptySection: { fontSize: 11, color: "#4B5563", marginBottom: 20 },

  playerRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#0D0D0D", borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 10, marginBottom: 8,
  },
  playerAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    justifyContent: "center", alignItems: "center",
  },
  playerAvatarText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
  playerName: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  playerRole: { fontSize: 10, color: "#6B7280", marginTop: 1 },

  statusPill: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  ratingBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText:  { fontSize: 12, fontWeight: "900" },

  achievementsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  achievementChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#161000", borderWidth: 1, borderColor: "#F59E0B44",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, maxWidth: "100%",
  },
  achievementIcon:  { fontSize: 12 },
  achievementLabel: { fontSize: 11, fontWeight: "800", color: "#F59E0B" },
});
