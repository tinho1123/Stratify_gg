import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TextStyle, TouchableOpacity, View } from "react-native";

interface ScreenHeaderProps {
  title: string;
  titleStyle?: TextStyle;
  centered?: boolean;
  dotColor?: string;
  subtitle?: string;
  subtitleStyle?: TextStyle;
  right?: React.ReactNode;
  onBack?: () => void;
}

// Header padrão de tela (botão voltar + título), usado em quase toda tela do dashboard.
// `dotColor`/`subtitle`/`right` cobrem as variações específicas de cada tela (indicador de
// elo, pill de orçamento/créditos, botão de ação); `titleStyle`/`subtitleStyle` são um escape
// hatch pra ajustes pontuais (tamanho de fonte, cor) sem precisar de mais props dedicadas.
export function ScreenHeader({
  title,
  titleStyle,
  centered = false,
  dotColor,
  subtitle,
  subtitleStyle,
  right,
  onBack,
}: ScreenHeaderProps) {
  return (
    <View style={s.header}>
      <TouchableOpacity style={s.backBtn} onPress={onBack ?? (() => router.back())}>
        <Text style={s.backIcon}>‹</Text>
      </TouchableOpacity>

      <View style={[s.headerCenter, centered && s.headerCenterCentered]}>
        {subtitle ? (
          <View style={centered ? { alignItems: "center" } : undefined}>
            <Text style={[s.headerTitle, titleStyle]} numberOfLines={1}>{title}</Text>
            <Text style={[s.headerSubtitle, subtitleStyle]} numberOfLines={1}>{subtitle}</Text>
          </View>
        ) : (
          <>
            {!!dotColor && <View style={[s.headerDot, { backgroundColor: dotColor }]} />}
            <Text style={[s.headerTitle, titleStyle]} numberOfLines={1}>{title}</Text>
          </>
        )}
      </View>

      {right ?? <View style={{ width: 36 }} />}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    justifyContent: "center", alignItems: "center",
  },
  backIcon: { fontSize: 22, color: "#FFFFFF", lineHeight: 24, marginTop: -2 },

  headerCenter:         { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  headerCenterCentered: { justifyContent: "center" },
  headerDot:            { width: 8, height: 8, borderRadius: 4 },
  headerTitle:          { fontSize: 16, fontWeight: "900", color: "#FFFFFF", letterSpacing: 4 },
  headerSubtitle:       { fontSize: 9, fontWeight: "800", color: "#4B5563", letterSpacing: 1, marginTop: 2 },
});
