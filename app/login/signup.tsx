import { supabase } from "@/database/supabase";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

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
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("A senha deve conter pelo menos uma letra maiúscula.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("A senha deve conter pelo menos um número.");
      return;
    }
    setLoading(true);
    const { data, error: signupError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signupError) {
      setError(signupError.message);
      return;
    }
    // session null = Supabase aguarda confirmação de e-mail
    if (!data.session) {
      setPendingConfirmation(true);
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.bgGlow} />

          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require("@/assets/images/stratify-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>CRIAR CONTA</Text>
            <Text style={styles.subtitle}>Comece sua jornada no esports</Text>
          </View>

          {pendingConfirmation ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmIcon}>📬</Text>
              <Text style={styles.confirmTitle}>Confirme seu e-mail</Text>
              <Text style={styles.confirmDesc}>
                Enviamos um link de confirmação para{"\n"}
                <Text style={styles.confirmEmail}>{email}</Text>
                {"\n\n"}Acesse seu e-mail e clique no link antes de fazer login.
              </Text>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => router.replace("/login")}
              >
                <Text style={styles.confirmButtonText}>Ir para o login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Form */}
              <View style={styles.form}>
                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠ {error}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>E-mail</Text>
                  <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
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

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Senha</Text>
                  <View style={[styles.inputWrapper, passwordFocused && styles.inputFocused]}>
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
                      style={styles.eyeButton}
                    >
                      <Text style={styles.eyeButtonText}>{showPassword ? "👁" : "🙈"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirmar senha</Text>
                  <View style={[styles.inputWrapper, confirmFocused && styles.inputFocused]}>
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

                <TouchableOpacity
                  style={[styles.signupButton, loading && styles.signupButtonDisabled]}
                  onPress={handleSignup}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#000" />
                      <Text style={styles.signupButtonText}>Criando conta...</Text>
                    </View>
                  ) : (
                    <Text style={styles.signupButtonText}>Criar conta</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Já tem conta? </Text>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={styles.loginLink}>Entrar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },
  bgGlow: {
    position: "absolute",
    top: -120,
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
    width: 72,
    height: 72,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    letterSpacing: 0.3,
  },
  form: {
    backgroundColor: "#161616",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#242424",
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D0D0D",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
  },
  inputFocused: {
    borderColor: "#10B981",
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeButtonText: {
    fontSize: 17,
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
  signupButton: {
    backgroundColor: "#10B981",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  signupButtonDisabled: {
    opacity: 0.5,
  },
  signupButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    color: "#6B7280",
    fontSize: 14,
  },
  loginLink: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "600",
  },
  confirmBox: {
    backgroundColor: "#0D1F16",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1A3D2A",
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  confirmIcon: {
    fontSize: 40,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  confirmDesc: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
  confirmEmail: {
    color: "#10B981",
    fontWeight: "700",
  },
  confirmButton: {
    marginTop: 8,
    backgroundColor: "#10B981",
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  confirmButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
});
