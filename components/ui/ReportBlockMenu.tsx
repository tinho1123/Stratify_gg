import { useLanguage } from "@/i18n/LanguageContext";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Menu de denúncia/bloqueio de usuário, exigido pela Apple (Guideline 1.2, User-Generated
// Content) e pelas políticas de conteúdo do Google Play pra apps com chat entre usuários.
// Reutilizado tanto no chat global (por mensagem) quanto nas mensagens diretas (pela conversa).

export type ReportReason = "harassment" | "hate_speech" | "spam" | "inappropriate_content" | "other";

const REASONS: ReportReason[] = ["harassment", "hate_speech", "spam", "inappropriate_content", "other"];

interface ReportBlockMenuProps {
  visible: boolean;
  onClose: () => void;
  targetName: string;
  onReport: (reason: ReportReason) => void;
  onBlock: () => void;
  isBlocked?: boolean;
  onUnblock?: () => void;
}

export function ReportBlockMenu({
  visible,
  onClose,
  targetName,
  onReport,
  onBlock,
  isBlocked,
  onUnblock,
}: ReportBlockMenuProps) {
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={s.sheet}>
          <Text style={s.title} numberOfLines={1}>{targetName}</Text>

          <Text style={s.sectionLabel}>{t("moderation.reportSectionTitle")}</Text>
          {REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={s.item}
              onPress={() => { onClose(); onReport(reason); }}
            >
              <Text style={s.itemText}>{t(`moderation.reason_${reason}`)}</Text>
            </TouchableOpacity>
          ))}

          <View style={s.divider} />

          {isBlocked ? (
            <TouchableOpacity style={s.item} onPress={() => { onClose(); onUnblock?.(); }}>
              <Text style={s.unblockText}>{t("moderation.unblockBtn")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.item} onPress={() => { onClose(); onBlock(); }}>
              <Text style={s.blockText}>{t("moderation.blockBtn")}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0D0D0D",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    padding: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#4B5563",
    letterSpacing: 1.5,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  item: {
    paddingVertical: 13,
    paddingHorizontal: 8,
  },
  itemText: { fontSize: 13, color: "#D1D5DB", fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#1A1A1A", marginVertical: 8 },
  blockText: { fontSize: 13, color: "#EF4444", fontWeight: "800" },
  unblockText: { fontSize: 13, color: "#10B981", fontWeight: "800" },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#161616",
    alignItems: "center",
  },
  cancelText: { fontSize: 12, fontWeight: "800", color: "#9CA3AF", letterSpacing: 0.5 },
});
