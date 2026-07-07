import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { supabase } from "@/database/supabase";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Types ─────────────────────────────────────────────────────────────────────

type GuildRole = "leader" | "officer" | "member";

interface GuildMemberRow {
  team_id: string;
  team_name: string;
  pdl: number;
  role: GuildRole;
  name_color: string | null;
}

interface GuildPendingRow {
  id: string;
  kind: "invite" | "request";
  team_id: string;
  team_name: string;
  created_at: string;
}

interface MyGuild {
  guild_id: string;
  name: string;
  description: string;
  is_public: boolean;
  my_role: GuildRole;
  member_count: number;
  total_pdl: number;
  members: GuildMemberRow[];
  pending: GuildPendingRow[];
}

type ConfirmAction =
  | { type: "leave" }
  | { type: "kick"; teamId: string; teamName: string };

const ERROR_KEY: Record<string, string> = {
  already_in_guild: "guild.errAlreadyInGuild",
  guild_full: "guild.errGuildFull",
  not_authorized: "guild.errNotAuthorized",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GuildHomeScreen() {
  const { t } = useLanguage();
  const { alert } = useAppAlert();
  const { isEnabled, loaded: flagsLoaded } = useFeatureFlags();

  useEffect(() => {
    if (flagsLoaded && !isEnabled("guild")) router.replace("/dashboard");
  }, [flagsLoaded]);

  const [loading, setLoading]   = useState(true);
  const [guild, setGuild]       = useState<MyGuild | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [busy, setBusy]         = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: team }, { data: myGuild }, { data: invites }] = await Promise.all([
      supabase.from("teams").select("id").single(),
      supabase.rpc("get_my_guild"),
      supabase.rpc("get_my_guild_invites"),
    ]);
    setMyTeamId(team?.id ?? null);
    setGuild((myGuild ?? null) as MyGuild | null);
    setPendingInvites(Array.isArray(invites) ? invites.length : 0);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const runAction = async (fn: () => PromiseLike<{ error: any }>) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      const key = ERROR_KEY[error.message] ?? "guild.errGeneric";
      alert(t("common.error"), t(key));
      return false;
    }
    await fetchData();
    return true;
  };

  const doLeave = () => runAction(() => supabase.rpc("leave_guild"));
  const doKick = (teamId: string) => runAction(() => supabase.rpc("kick_member", { p_team_id: teamId }));
  const doPromote = (teamId: string, isOfficer: boolean) =>
    runAction(() => supabase.rpc("set_officer", { p_team_id: teamId, p_is_officer: isOfficer }));
  const doTransfer = (teamId: string) =>
    runAction(() => supabase.rpc("transfer_leadership", { p_new_leader_team_id: teamId }));

  const confirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "leave") doLeave();
    if (confirmAction.type === "kick") doKick(confirmAction.teamId);
    setConfirmAction(null);
  };

  const isLastMember = guild ? guild.member_count <= 1 : false;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title={t("guild.headerTitle")}
        centered
        right={
          <TouchableOpacity style={s.invitesBtn} onPress={() => router.push("/dashboard/guild/invites" as any)}>
            <Text style={s.invitesIcon}>✉️</Text>
            {pendingInvites > 0 && (
              <View style={s.invitesBadge}><Text style={s.invitesBadgeText}>{pendingInvites}</Text></View>
            )}
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={s.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : !guild ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>🛡️</Text>
          <Text style={s.emptyTitle}>{t("guild.emptyTitle")}</Text>
          <Text style={s.emptySubtitle}>{t("guild.emptySubtitle")}</Text>
          <View style={s.emptyActions}>
            <TouchableOpacity style={s.primaryBtn} onPress={() => router.push("/dashboard/guild/create" as any)} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>{t("guild.createCta")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push("/dashboard/guild/browse" as any)} activeOpacity={0.85}>
              <Text style={s.secondaryBtnText}>{t("guild.browseCta")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <View style={s.hero}>
            <Text style={s.guildName} numberOfLines={1}>{guild.name}</Text>
            <View style={[s.visibilityPill, { borderColor: guild.is_public ? "#10B98155" : "#6B728055" }]}>
              <Text style={[s.visibilityText, { color: guild.is_public ? "#10B981" : "#9CA3AF" }]}>
                {guild.is_public ? t("guild.publicBadge") : t("guild.privateBadge")}
              </Text>
            </View>
            {!!guild.description && <Text style={s.description}>{guild.description}</Text>}

            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statValue}>{guild.total_pdl}</Text>
                <Text style={s.statLabel}>{t("guild.totalPdl")}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{guild.member_count}/25</Text>
                <Text style={s.statLabel}>{t("ranking.membersCount")}</Text>
              </View>
            </View>
          </View>

          {guild.my_role !== "member" && guild.pending.length > 0 && (
            <>
              <Text style={s.sectionLabel}>{t("guild.pendingSection")}</Text>
              {guild.pending.map((p) => (
                <View key={p.id} style={s.pendingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pendingTeamName} numberOfLines={1}>{p.team_name}</Text>
                    <Text style={s.pendingKind}>
                      {p.kind === "request" ? t("guild.requestedToJoin") : t("guild.invitedYou")}
                    </Text>
                  </View>
                  {p.kind === "request" && (
                    <>
                      <TouchableOpacity
                        style={s.acceptBtn}
                        disabled={busy}
                        onPress={() => runAction(() => supabase.rpc("accept_invite", { p_invite_id: p.id }))}
                      >
                        <Text style={s.acceptBtnText}>{t("guild.acceptBtn")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.declineBtn}
                        disabled={busy}
                        onPress={() => runAction(() => supabase.rpc("decline_invite", { p_invite_id: p.id }))}
                      >
                        <Text style={s.declineBtnText}>{t("guild.declineBtn")}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {p.kind === "invite" && (
                    <TouchableOpacity
                      style={s.declineBtn}
                      disabled={busy}
                      onPress={() => runAction(() => supabase.rpc("cancel_invite", { p_invite_id: p.id }))}
                    >
                      <Text style={s.declineBtnText}>{t("guild.cancelBtn")}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}

          <Text style={s.sectionLabel}>{t("guild.membersSection")}</Text>
          {guild.members.map((m) => {
            const isMe = m.team_id === myTeamId;
            return (
              <TouchableOpacity
                key={m.team_id}
                style={[s.memberRow, isMe && s.memberRowMe]}
                activeOpacity={0.8}
                onPress={() => !isMe && router.push({ pathname: "/dashboard/team/[id]", params: { id: m.team_id } })}
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

                {!isMe && guild.my_role === "leader" && m.role !== "leader" && (
                  <View style={s.memberActions}>
                    <TouchableOpacity
                      style={s.iconBtn}
                      disabled={busy}
                      onPress={() => doPromote(m.team_id, m.role !== "officer")}
                    >
                      <Text style={s.iconBtnText}>{m.role === "officer" ? "⬇" : "⬆"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.iconBtn} disabled={busy} onPress={() => doTransfer(m.team_id)}>
                      <Text style={s.iconBtnText}>👑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.iconBtn}
                      disabled={busy}
                      onPress={() => setConfirmAction({ type: "kick", teamId: m.team_id, teamName: m.team_name })}
                    >
                      <Text style={s.iconBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!isMe && guild.my_role === "officer" && m.role !== "leader" && (
                  <View style={s.memberActions}>
                    <TouchableOpacity
                      style={s.iconBtn}
                      disabled={busy}
                      onPress={() => setConfirmAction({ type: "kick", teamId: m.team_id, teamName: m.team_name })}
                    >
                      <Text style={s.iconBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {isLastMember && <Text style={s.disbandNotice}>{t("guild.disbandNotice")}</Text>}

          <TouchableOpacity style={s.leaveBtn} disabled={busy} onPress={() => setConfirmAction({ type: "leave" })}>
            <Text style={s.leaveBtnText}>{t("guild.leaveBtn")}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={!!confirmAction} transparent animationType="fade" onRequestClose={() => setConfirmAction(null)}>
        <Pressable style={s.confirmOverlay} onPress={() => !busy && setConfirmAction(null)}>
          <Pressable style={s.confirmCard} onPress={() => {}}>
            <Text style={s.confirmTitle}>
              {confirmAction?.type === "leave" ? t("guild.leaveConfirmTitle") : t("guild.kickConfirmTitle")}
            </Text>
            <Text style={s.confirmMessage}>
              {confirmAction?.type === "leave" ? t("guild.leaveConfirmMessage") : confirmAction?.teamName}
            </Text>
            <View style={s.confirmActions}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setConfirmAction(null)} disabled={busy}>
                <Text style={s.confirmCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmOkBtn} onPress={confirm} disabled={busy}>
                {busy ? <ActivityIndicator size="small" color="#080808" /> : <Text style={s.confirmOkText}>{t("guild.acceptBtn")}</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#080808" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  loadingText: { fontSize: 13, color: "#6B7280" },

  invitesBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  invitesIcon: { fontSize: 18 },
  invitesBadge: {
    position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  invitesBadgeText: { fontSize: 9, fontWeight: "900", color: "#FFFFFF" },

  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 15, fontWeight: "900", color: "#FFFFFF", textAlign: "center" },
  emptySubtitle: { fontSize: 12, color: "#6B7280", textAlign: "center" },
  emptyActions: { gap: 10, marginTop: 8, width: "100%" },
  primaryBtn: {
    backgroundColor: "#EC4899", borderRadius: 12, paddingVertical: 14, alignItems: "center",
  },
  primaryBtnText: { fontSize: 12, fontWeight: "900", color: "#080808", letterSpacing: 0.5 },
  secondaryBtn: {
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1F1F1F",
    borderRadius: 12, paddingVertical: 14, alignItems: "center",
  },
  secondaryBtnText: { fontSize: 12, fontWeight: "900", color: "#FFFFFF", letterSpacing: 0.5 },

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

  sectionLabel: {
    fontSize: 10, fontWeight: "900", color: "#6B7280",
    letterSpacing: 3, marginBottom: 10, marginTop: 4,
  },

  pendingRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#0D0D0D", borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 10, marginBottom: 8,
  },
  pendingTeamName: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  pendingKind: { fontSize: 10, color: "#6B7280", marginTop: 2 },
  acceptBtn: { backgroundColor: "#10B981", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  acceptBtnText: { fontSize: 10, fontWeight: "900", color: "#080808" },
  declineBtn: { backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  declineBtnText: { fontSize: 10, fontWeight: "900", color: "#9CA3AF" },

  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#0D0D0D", borderRadius: 14, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 12, marginBottom: 8,
  },
  memberRowMe: { borderColor: "#EC489966" },
  memberName: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  memberRole: { fontSize: 10, color: "#6B7280", marginTop: 2, fontWeight: "700" },
  memberPdl: { fontSize: 13, fontWeight: "900", color: "#EC4899" },
  memberActions: { flexDirection: "row", gap: 6, marginLeft: 8 },
  iconBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: "#161616",
    borderWidth: 1, borderColor: "#242424", alignItems: "center", justifyContent: "center",
  },
  iconBtnText: { fontSize: 12, color: "#FFFFFF" },

  disbandNotice: { fontSize: 11, color: "#F59E0B", textAlign: "center", marginBottom: 12 },

  leaveBtn: {
    backgroundColor: "#161000", borderWidth: 1, borderColor: "#EF444444",
    borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8,
  },
  leaveBtnText: { fontSize: 12, fontWeight: "900", color: "#EF4444", letterSpacing: 0.5 },

  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 24 },
  confirmCard: {
    width: "100%", backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1F1F1F",
    borderRadius: 16, padding: 20, gap: 14, alignItems: "center",
  },
  confirmTitle: { fontSize: 14, fontWeight: "900", color: "#FFFFFF", letterSpacing: 1 },
  confirmMessage: { fontSize: 12, color: "#9CA3AF", textAlign: "center" },
  confirmActions: { flexDirection: "row", gap: 10, width: "100%" },
  confirmCancelBtn: {
    flex: 1, backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    borderRadius: 10, paddingVertical: 12, alignItems: "center",
  },
  confirmCancelText: { fontSize: 12, fontWeight: "800", color: "#9CA3AF" },
  confirmOkBtn: { flex: 1, backgroundColor: "#EF4444", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  confirmOkText: { fontSize: 12, fontWeight: "900", color: "#080808" },
});
