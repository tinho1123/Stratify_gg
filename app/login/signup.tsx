import { supabase } from "@/database/supabase";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async () => {
    setError(null);

    if (!email || !password || !confirm) {
      setError("Preencha todos os campos.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const { error: signupError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (signupError) {
      setError(signupError.message);
      return;
    }

    // Cadastro bem-sucedido — o trigger no banco já criou os 5 jogadores
    router.replace("/dashboard");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.bgEffect1} />
          <View style={styles.bgEffect2} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>⚡</Text>
              </View>
            </View>
            <Text style={styles.title}>CRIAR CONTA</Text>
            <Text style={styles.subtitle}>COMECE SUA JORNADA NO ESPORTS</Text>
            <View style={styles.dividerGreen} />
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>CADASTRO</Text>
              <View style={styles.formAccent} />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>▸ EMAIL</Text>
              <View
                style={[
                  styles.inputWrapper,
                  emailFocused && styles.inputWrapperFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="usuario@esports.gg"
                  placeholderTextColor="#4B5563"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Senha */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>▸ SENHA</Text>
              <View
                style={[
                  styles.inputWrapper,
                  passwordFocused && styles.inputWrapperFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#4B5563"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Text style={styles.eyeIconText}>
                    {showPassword ? "👁️" : "🔒"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirmar Senha */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>▸ CONFIRMAR SENHA</Text>
              <View
                style={[
                  styles.inputWrapper,
                  confirmFocused && styles.inputWrapperFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#4B5563"
                  value={confirm}
                  onChangeText={setConfirm}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Botão Cadastrar */}
            <TouchableOpacity
              style={[styles.signupButton, loading && styles.signupButtonDisabled]}
              onPress={handleSignup}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#000000" />
                  <Text style={styles.signupButtonText}>CRIANDO TIME...</Text>
                </View>
              ) : (
                <Text style={styles.signupButtonText}>[ CRIAR CONTA ]</Text>
              )}
            </TouchableOpacity>

            {/* Voltar para login */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Já tem conta? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>ENTRAR</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20, justifyContent: "center" },

  bgEffect1: {
    position: "absolute",
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#10B981",
    opacity: 0.1,
  },
  bgEffect2: {
    position: "absolute",
    bottom: -50,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#10B981",
    opacity: 0.08,
  },

  header: { alignItems: "center", marginBottom: 40 },
  logoContainer: { marginBottom: 20 },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: "#000000",
    borderWidth: 3,
    borderColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "45deg" }],
  },
  logoText: { fontSize: 50, transform: [{ rotate: "-45deg" }] },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#6B7280",
    letterSpacing: 2,
    marginTop: 8,
    fontWeight: "600",
  },
  dividerGreen: {
    width: 100,
    height: 2,
    backgroundColor: "#10B981",
    marginTop: 16,
  },

  formContainer: {
    backgroundColor: "#0A0A0A",
    borderRadius: 4,
    padding: 24,
    borderWidth: 2,
    borderColor: "#1F1F1F",
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  formHeader: { marginBottom: 24 },
  formTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 3,
  },
  formAccent: { width: 60, height: 2, backgroundColor: "#10B981", marginTop: 4 },

  errorBox: {
    backgroundColor: "#EF444420",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 4,
    padding: 12,
    marginBottom: 20,
  },
  errorText: { color: "#EF4444", fontSize: 13 },

  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#10B981",
    marginBottom: 8,
    letterSpacing: 1,
  },
  inputWrapper: {
    position: "relative",
    backgroundColor: "#000000",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },
  inputWrapperFocused: { borderColor: "#10B981" },
  input: {
    color: "#FFFFFF",
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  eyeIcon: { position: "absolute", right: 12, top: "50%", marginTop: -12 },
  eyeIconText: { fontSize: 20 },

  signupButton: {
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 4,
    alignItems: "center",
    marginBottom: 24,
  },
  signupButtonDisabled: { opacity: 0.6 },
  signupButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: { color: "#4B5563", fontSize: 13 },
  loginLink: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});
