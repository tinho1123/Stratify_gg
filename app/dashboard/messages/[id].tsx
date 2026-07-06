import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { getTierInfo } from "@/constants/tiers";
import { supabase } from "@/database/supabase";
import { useLanguage } from "@/i18n/LanguageContext";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DmMessage {
  id: string;
  conversation_id: string;
  sender_team_id: string;
  message: string;
  created_at: string;
}

interface OtherTeamInfo {
  team_id: string;
  team_name: string;
  pdl: number;
  name_color: string | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DmThreadScreen() {
  const { t } = useLanguage();
  const { alert } = useAppAlert();
  const params = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading]     = useState(true);
  const [messages, setMessages]   = useState<DmMessage[]>([]);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [myTeamId, setMyTeamId]   = useState<string | null>(null);
  const [otherTeam, setOtherTeam] = useState<OtherTeamInfo | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const conversationId = params.id;

      const [{ data: team }, { data: conv }] = await Promise.all([
        supabase.from("teams").select("id").single(),
        supabase.from("dm_conversations").select("team_a_id, team_b_id").eq("id", conversationId).single(),
      ]);

      if (!team || !conv || cancelled) { setLoading(false); return; }
      setMyTeamId(team.id);

      const otherTeamId = conv.team_a_id === team.id ? conv.team_b_id : conv.team_a_id;
      const { data: profile } = await supabase.rpc("get_team_public_profile", { p_team_id: otherTeamId });
      if (profile && !cancelled) {
        setOtherTeam({
          team_id: (profile as any).team_id,
          team_name: (profile as any).team_name,
          pdl: (profile as any).pdl,
          name_color: (profile as any).name_color,
        });
      }

      const { data: history } = await supabase
        .from("dm_messages")
        .select("id, conversation_id, sender_team_id, message, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (cancelled) return;
      setMessages(((history ?? []) as DmMessage[]).slice().reverse());
      setLoading(false);

      channel = supabase
        .channel(`dm:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "dm_messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as DmMessage]);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [params.id]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    const { error } = await supabase.rpc("send_dm_message", {
      p_conversation_id: params.id,
      p_message: text,
    });
    setSending(false);
    if (error) {
      const msg = error.message?.includes("rate_limited")
        ? t("chat.errRateLimited")
        : error.message?.includes("message_too_long")
        ? t("chat.errTooLong")
        : t("chat.errSendGeneric");
      alert(t("common.error"), msg);
    }
  };

  const info = otherTeam ? getTierInfo(otherTeam.pdl) : null;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader
        title={otherTeam?.team_name ?? t("messages.headerTitle")}
        titleStyle={{ fontSize: 15, letterSpacing: 1, ...(otherTeam?.name_color ? { color: otherTeam.name_color } : null) }}
        subtitle={info ? `${info.tier}${info.division ? ` ${info.division}` : ""}` : undefined}
        subtitleStyle={info ? { color: info.color } : undefined}
        centered
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#EC4899" />
            <Text style={s.loadingText}>{t("common.loading")}</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyEmoji}>✉️</Text>
                <Text style={s.emptyText}>{t("messages.threadEmpty")}</Text>
              </View>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_team_id === myTeamId;
                return (
                  <View key={m.id} style={[s.msgRow, isMe && s.msgRowMe]}>
                    <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
                      <Text style={s.msgText}>{m.message}</Text>
                      <Text style={s.msgTime}>{formatTime(m.created_at)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* ── INPUT ─────────────────────────────────────── */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder={t("chat.inputPlaceholder")}
            placeholderTextColor="#4B5563"
            maxLength={300}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#080808" />
              : <Text style={s.sendBtnText}>{t("chat.sendBtn")}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#080808" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#6B7280" },

  emptyCard: { alignItems: "center", gap: 8, paddingVertical: 48 },
  emptyEmoji: { fontSize: 32 },
  emptyText:  { fontSize: 12, color: "#6B7280", textAlign: "center" },

  msgRow:   { marginBottom: 10, alignItems: "flex-start" },
  msgRowMe: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "80%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1,
  },
  bubbleOther: { backgroundColor: "#0D0D0D", borderColor: "#1A1A1A" },
  bubbleMe:    { backgroundColor: "#EC489918", borderColor: "#EC489944" },
  msgText:   { fontSize: 13, color: "#FFFFFF", lineHeight: 18 },
  msgTime:   { fontSize: 9, color: "#4B5563", marginTop: 4, alignSelf: "flex-end" },

  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: "#1A1A1A",
  },
  input: {
    flex: 1, maxHeight: 90, minHeight: 40, backgroundColor: "#0D0D0D",
    borderRadius: 12, borderWidth: 1, borderColor: "#1A1A1A",
    paddingHorizontal: 12, paddingVertical: 10, color: "#FFFFFF", fontSize: 13,
  },
  sendBtn: {
    height: 40, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: "#EC4899", justifyContent: "center", alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#242424" },
  sendBtnText: { fontSize: 11, fontWeight: "900", color: "#080808", letterSpacing: 0.5 },
});
