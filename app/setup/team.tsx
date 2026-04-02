import { supabase } from "@/database/supabase";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SetupTeamScreen() {
  const [teamName, setTeamName] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    const name = teamName.trim();
    if (!name) {
      setError("Digite um nome para o seu time.");
      return;
    }
    if (name.length < 2) {
      setError("O nome deve ter pelo menos 2 caracteres.");
      return;
    }
    if (name.length > 32) {
      setError("O nome deve ter no máximo 32 caracteres.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase
      .from("teams")
      .update({ name, onboarded: true })
      .eq("onboarded", false);
    setLoading(false);
    if (updateError) {
      setError("Erro ao salvar. Tente novamente.");
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View style={styles.bgGlow} />

        <View style={styles.header}>
          <Image
            source={require("@/assets/images/stratify-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.step}>PASSO 1 DE 1</Text>
          <Text style={styles.title}>NOME DO SEU TIME</Text>
          <Text style={styles.subtitle}>
            Escolha um nome épico — você poderá mudá-lo depois
          </Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠ {error}</Text>
            </View>
          )}

          <Text style={styles.label}>Nome do time</Text>
          <View style={[styles.inputWrapper, focused && styles.inputFocused]}>
            <TextInput
              style={styles.input}
              placeholder="ex: Stratify Esports"
              placeholderTextColor="#4B5563"
              value={teamName}
              onChangeText={setTeamName}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoCapitalize="words"
              maxLength={32}
              editable={!loading}
              autoFocus
            />
          </View>
          <Text style={styles.charCount}>{teamName.length}/32</Text>

          <View style={styles.statsPreview}>
            <Text style={styles.statsPreviewTitle}>CONDIÇÕES INICIAIS</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>$10K</Text>
                <Text style={styles.statLabel}>Orçamento</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>—</Text>
                <Text style={styles.statLabel}>Ranking</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Fãs</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0-0</Text>
                <Text style={styles.statLabel}>Recorde</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, (!teamName.trim() || loading) && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          activeOpacity={0.85}
          disabled={!teamName.trim() || loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#000" />
              <Text style={styles.confirmButtonText}>Salvando...</Text>
            </View>
          ) : (
            <Text style={styles.confirmButtonText}>ENTRAR NO JOGO  →</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },
  bgGlow: {
    position: "absolute",
    top: -100,
    alignSelf: "center",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "#10B981",
    opacity: 0.07,
  },
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 16,
  },
  step: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  form: {
    backgroundColor: "#161616",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#242424",
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: "#0D0D0D",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
  },
  inputFocused: {
    borderColor: "#10B981",
  },
  input: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  charCount: {
    fontSize: 11,
    color: "#4B5563",
    textAlign: "right",
    marginTop: 6,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
  },
  statsPreview: {
    backgroundColor: "#0D0D0D",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1F1F1F",
    padding: 16,
  },
  statsPreviewTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4B5563",
    letterSpacing: 2,
    marginBottom: 14,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#1F1F1F",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#10B981",
  },
  statLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 4,
  },
  confirmButton: {
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
