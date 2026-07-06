import { useAppAlert } from "@/components/ui/AppAlert";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { getTierInfo } from "@/constants/tiers";
import { supabase } from "@/database/supabase";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useLanguage } from "@/i18n/LanguageContext";
import { router } from "expo-router";
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

interface ChatMessage {
  id: string;
  team_id: string;
  team_name: string;
  team_pdl: number;
  name_color: string | null;
  message: string;
  created_at: string;
}

interface ReactionRow {
  message_id: string;
  team_id: string;
  emoji: string;
}

interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function summarizeReactions(rows: ReactionRow[], myTeamId: string | null): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>();
  for (const r of rows) {
    const entry = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    entry.count += 1;
    if (r.team_id === myTeamId) entry.mine = true;
    byEmoji.set(r.emoji, entry);
  }
  return ALLOWED_EMOJIS.map((e) => byEmoji.get(e)).filter((e): e is ReactionSummary => !!e);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { t } = useLanguage();
  const { isEnabled, loaded } = useFeatureFlags();

  useEffect(() => {
    if (loaded && !isEnabled("chat")) router.replace("/dashboard");
  }, [loaded]);
  const { alert } = useAppAlert();

  const [loading, setLoading]     = useState(true);
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [myTeamId, setMyTeamId]   = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, ReactionRow[]>>({});
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: team } = await supabase.from("teams").select("id").single();
      if (!team || cancelled) { setLoading(false); return; }
      setMyTeamId(team.id);

      const { data: history } = await supabase
        .from("chat_messages")
        .select("id, team_id, team_name, team_pdl, name_color, message, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (cancelled) return;
      const loaded = ((history ?? []) as ChatMessage[]).slice().reverse();
      setMessages(loaded);
      setLoading(false);

      if (loaded.length > 0) {
        const { data: reactionRows } = await supabase
          .from("chat_message_reactions")
          .select("message_id, team_id, emoji")
          .in("message_id", loaded.map((m) => m.id));

        if (!cancelled && reactionRows) {
          const grouped: Record<string, ReactionRow[]> = {};
          for (const r of reactionRows as ReactionRow[]) {
            (grouped[r.message_id] ??= []).push(r);
          }
          setReactions(grouped);
        }
      }

      channel = supabase
        .channel("chat:global")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as ChatMessage]);
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_message_reactions" },
          (payload) => {
            const row = payload.new as ReactionRow;
            setReactions((prev) => ({
              ...prev,
              [row.message_id]: [...(prev[row.message_id] ?? []), row],
            }));
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "chat_message_reactions" },
          (payload) => {
            const row = payload.old as ReactionRow;
            setReactions((prev) => ({
              ...prev,
              [row.message_id]: (prev[row.message_id] ?? []).filter(
                (r) => !(r.team_id === row.team_id && r.emoji === row.emoji),
              ),
            }));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    const { error } = await supabase.rpc("send_chat_message", { p_message: text });
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

  const toggleReaction = async (messageId: string, emoji: string) => {
    setPickerFor(null);
    await supabase.rpc("toggle_chat_reaction", { p_message_id: messageId, p_emoji: emoji });
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <ScreenHeader title={t("chat.headerTitle")} centered />
      <Text style={s.tierSub}>{t("chat.globalSub")}</Text>

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
                <Text style={s.emptyEmoji}>💬</Text>
                <Text style={s.emptyText}>{t("chat.emptyState")}</Text>
              </View>
            ) : (
              messages.map((m) => {
                const isMe = m.team_id === myTeamId;
                const info = getTierInfo(m.team_pdl ?? 0);
                const summary = summarizeReactions(reactions[m.id] ?? [], myTeamId);
                const showPicker = pickerFor === m.id;
                return (
                  <View key={m.id} style={[s.msgRow, isMe && s.msgRowMe]}>
                    <TouchableOpacity
                      style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}
                      activeOpacity={0.9}
                      onLongPress={() => setPickerFor(showPicker ? null : m.id)}
                    >
                      {!isMe && (
                        <TouchableOpacity
                          style={s.senderRow}
                          onPress={() => router.push({ pathname: "/dashboard/team/[id]", params: { id: m.team_id } })}
                        >
                          <Text
                            style={[s.msgSender, m.name_color ? { color: m.name_color } : null]}
                            numberOfLines={1}
                          >
                            {m.team_name}
                          </Text>
                          <View style={[s.eloDot, { backgroundColor: info.color }]} />
                          <Text style={[s.eloText, { color: info.color }]} numberOfLines={1}>
                            {info.tier}{info.division ? ` ${info.division}` : ""}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <Text style={s.msgText}>{m.message}</Text>
                      <Text style={s.msgTime}>{formatTime(m.created_at)}</Text>
                    </TouchableOpacity>

                    {(summary.length > 0 || showPicker) && (
                      <View style={[s.reactionsRow, isMe && s.reactionsRowMe]}>
                        {summary.map((r) => (
                          <TouchableOpacity
                            key={r.emoji}
                            style={[s.reactionChip, r.mine && s.reactionChipMine]}
                            onPress={() => toggleReaction(m.id, r.emoji)}
                          >
                            <Text style={s.reactionEmoji}>{r.emoji}</Text>
                            <Text style={[s.reactionCount, r.mine && s.reactionCountMine]}>{r.count}</Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={s.reactionAddBtn}
                          onPress={() => setPickerFor(showPicker ? null : m.id)}
                        >
                          <Text style={s.reactionAddIcon}>{showPicker ? "✕" : "+"}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {showPicker && (
                      <View style={[s.pickerRow, isMe && s.pickerRowMe]}>
                        {ALLOWED_EMOJIS.map((e) => (
                          <TouchableOpacity key={e} style={s.pickerEmojiBtn} onPress={() => toggleReaction(m.id, e)}>
                            <Text style={s.pickerEmoji}>{e}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
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

  tierSub: {
    textAlign: "center", fontSize: 10, fontWeight: "800", color: "#4B5563",
    letterSpacing: 2, marginBottom: 8,
  },

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
  senderRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  msgSender: { fontSize: 10, fontWeight: "800", color: "#6B7280" },
  eloDot:    { width: 5, height: 5, borderRadius: 2.5 },
  eloText:   { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  msgText:   { fontSize: 13, color: "#FFFFFF", lineHeight: 18 },
  msgTime:   { fontSize: 9, color: "#4B5563", marginTop: 4, alignSelf: "flex-end" },

  reactionsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5, alignSelf: "flex-start",
  },
  reactionsRowMe: { alignSelf: "flex-end" },
  reactionChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
  },
  reactionChipMine: { backgroundColor: "#EC489918", borderColor: "#EC489966" },
  reactionEmoji:    { fontSize: 11 },
  reactionCount:    { fontSize: 10, fontWeight: "800", color: "#6B7280" },
  reactionCountMine: { color: "#EC4899" },
  reactionAddBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
    justifyContent: "center", alignItems: "center",
  },
  reactionAddIcon: { fontSize: 12, fontWeight: "800", color: "#6B7280" },

  pickerRow: {
    flexDirection: "row", gap: 6, marginTop: 6, alignSelf: "flex-start",
    backgroundColor: "#0D0D0D", borderWidth: 1, borderColor: "#1A1A1A",
    borderRadius: 14, paddingHorizontal: 8, paddingVertical: 6,
  },
  pickerRowMe: { alignSelf: "flex-end" },
  pickerEmojiBtn: { padding: 3 },
  pickerEmoji:    { fontSize: 18 },

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
