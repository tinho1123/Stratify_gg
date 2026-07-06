import React, { createContext, useCallback, useContext, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

// Substitui o Alert.alert() nativo (janela cinza do sistema, fora do visual do app) por um
// diálogo no estilo do design system: scrim rgba(0,0,0,0.7), cartão #0D0D0D com borda hairline,
// ícone com tint de 12% + anel de 30%, botão cheio de 48px — mesmos tokens usados no resto do
// app (docs/design_system/tokens/colors.css, effects.css).

export type AppAlertType = "error" | "success" | "info";

interface AppAlertOptions {
  title: string;
  message: string;
  type?: AppAlertType;
}

interface AppAlertContextValue {
  alert: (title: string, message: string, type?: AppAlertType) => void;
}

const AppAlertContext = createContext<AppAlertContextValue | null>(null);

const TYPE_STYLE: Record<AppAlertType, { icon: string; color: string }> = {
  error:   { icon: "⚠",  color: "#EF4444" },
  success: { icon: "✓",  color: "#10B981" },
  info:    { icon: "ℹ",  color: "#6366F1" },
};

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<AppAlertOptions | null>(null);

  const alert = useCallback((title: string, message: string, type: AppAlertType = "error") => {
    setCurrent({ title, message, type });
  }, []);

  const dismiss = () => setCurrent(null);
  const { icon, color } = TYPE_STYLE[current?.type ?? "error"];

  return (
    <AppAlertContext.Provider value={{ alert }}>
      {children}
      <Modal visible={!!current} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
          <View style={s.card}>
            <View style={[s.iconWrap, { backgroundColor: color + "1F", borderColor: color + "4D" }]}>
              <Text style={[s.icon, { color }]}>{icon}</Text>
            </View>
            <Text style={s.title}>{current?.title}</Text>
            <Text style={s.message}>{current?.message}</Text>
            <Pressable style={s.btn} onPress={dismiss}>
              <Text style={s.btnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppAlertContext.Provider>
  );
}

export function useAppAlert(): AppAlertContextValue {
  const ctx = useContext(AppAlertContext);
  if (!ctx) throw new Error("useAppAlert must be used within an AppAlertProvider");
  return ctx;
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 340, backgroundColor: "#0D0D0D",
    borderRadius: 16, borderWidth: 1, borderColor: "#1A1A1A",
    padding: 24, alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.7, shadowRadius: 60,
    elevation: 12,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 1,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  icon: { fontSize: 26, fontWeight: "900" },
  title: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
  message: { fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 19, marginBottom: 8 },
  btn: {
    width: "100%", height: 48, borderRadius: 8,
    backgroundColor: "#161616", borderWidth: 1, borderColor: "#242424",
    justifyContent: "center", alignItems: "center",
  },
  btnText: { fontSize: 13, fontWeight: "900", color: "#9CA3AF", letterSpacing: 1 },
});
