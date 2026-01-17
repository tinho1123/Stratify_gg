import { router } from "expo-router";
import React, { useState } from "react";
import {
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

export default function LoginScreen() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [emailFocused, setEmailFocused] = useState<boolean>(false);
  const [passwordFocused, setPasswordFocused] = useState<boolean>(false);

  const handleLogin = (): void => {
    if (email === "carvalho.cwell@gmail.com" && password === "123") {
      router.replace("/dashboard");
      return;
    }

    console.log("Login inválido", { email, password });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Efeitos de fundo */}
          <View style={styles.bgEffect1} />
          <View style={styles.bgEffect2} />
          <View style={styles.bgEffect3} />

          {/* Grid lines decoration */}
          <View style={styles.gridLines}>
            <View style={styles.gridLineHorizontal} />
            <View style={styles.gridLineVertical} />
          </View>

          {/* Header com tema gaming */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>⚡</Text>
              </View>
              <View style={styles.logoGlow} />
            </View>
            <Text style={styles.title}>ESPORTS MANAGER</Text>
            <Text style={styles.subtitle}>
              CONQUISTE O TOPO DA CLASSIFICAÇÃO
            </Text>
            <View style={styles.dividerGreen} />
          </View>

          {/* Formulário com tema cyberpunk */}
          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>LOGIN</Text>
              <View style={styles.formAccent} />
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>▸ EMAIL</Text>
              <View
                style={[
                  styles.inputWrapper,
                  emailFocused && styles.inputWrapperFocused,
                ]}
              >
                <View style={styles.inputBorder} />
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
                />
                {emailFocused && <View style={styles.inputGlow} />}
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>▸ SENHA</Text>
              <View
                style={[
                  styles.inputWrapper,
                  passwordFocused && styles.inputWrapperFocused,
                ]}
              >
                <View style={styles.inputBorder} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#4B5563"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Text style={styles.eyeIconText}>
                    {showPassword ? "👁️" : "🔒"}
                  </Text>
                </TouchableOpacity>
                {passwordFocused && <View style={styles.inputGlow} />}
              </View>
            </View>

            {/* Options */}
            <View style={styles.optionsRow}>
              <TouchableOpacity style={styles.rememberMe}>
                <View style={styles.checkbox} />
                <Text style={styles.rememberMeText}>Manter conectado</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.forgotPassword}>Recuperar conta</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              activeOpacity={0.8}
            >
              <View style={styles.buttonGlow} />
              <Text style={styles.loginButtonText}>[ ENTRAR NO JOGO ]</Text>
              <View style={styles.buttonCorner1} />
              <View style={styles.buttonCorner2} />
              <View style={styles.buttonCorner3} />
              <View style={styles.buttonCorner4} />
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OU</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login */}
            <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
              <Text style={styles.socialButtonIcon}>🎮</Text>
              <Text style={styles.socialButtonText}>CONECTAR COM STEAM</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
              <Text style={styles.socialButtonIcon}>🎯</Text>
              <Text style={styles.socialButtonText}>CONECTAR COM DISCORD</Text>
            </TouchableOpacity>

            {/* Sign Up */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Novo jogador? </Text>
              <TouchableOpacity>
                <Text style={styles.signupLink}>CRIAR CONTA</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>v1.0.0 | ALPHA BUILD</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  // Efeitos de fundo
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
  bgEffect3: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "#10B981",
    opacity: 0.03,
    marginLeft: -200,
    marginTop: -200,
  },
  gridLines: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLineHorizontal: {
    position: "absolute",
    top: "30%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#10B981",
    opacity: 0.1,
  },
  gridLineVertical: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#10B981",
    opacity: 0.1,
  },
  // Header
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    position: "relative",
    marginBottom: 20,
  },
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
  logoText: {
    fontSize: 50,
    transform: [{ rotate: "-45deg" }],
  },
  logoGlow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: "#10B981",
    opacity: 0.2,
    transform: [{ rotate: "45deg" }],
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 4,
    textShadowColor: "#10B981",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 12,
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
  // Formulário
  formContainer: {
    backgroundColor: "#0A0A0A",
    borderRadius: 4,
    padding: 24,
    borderWidth: 2,
    borderColor: "#1F1F1F",
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  formHeader: {
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#10B981",
    letterSpacing: 3,
  },
  formAccent: {
    width: 60,
    height: 2,
    backgroundColor: "#10B981",
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
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
  inputWrapperFocused: {
    borderColor: "#10B981",
  },
  inputBorder: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 4,
  },
  inputGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  input: {
    color: "#FFFFFF",
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -12,
  },
  eyeIconText: {
    fontSize: 20,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  rememberMe: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: "#10B981",
    marginRight: 8,
  },
  rememberMeText: {
    color: "#6B7280",
    fontSize: 12,
  },
  forgotPassword: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "600",
  },
  loginButton: {
    position: "relative",
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 4,
    alignItems: "center",
    marginBottom: 24,
    overflow: "hidden",
  },
  buttonGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    opacity: 0.1,
  },
  loginButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  buttonCorner1: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#FFFFFF",
  },
  buttonCorner2: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#FFFFFF",
  },
  buttonCorner3: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#FFFFFF",
  },
  buttonCorner4: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#FFFFFF",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1F1F1F",
  },
  dividerText: {
    color: "#4B5563",
    fontSize: 12,
    marginHorizontal: 12,
    letterSpacing: 2,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#1F1F1F",
    borderRadius: 4,
    paddingVertical: 14,
    marginBottom: 12,
  },
  socialButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  socialButtonText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  signupText: {
    color: "#4B5563",
    fontSize: 13,
  },
  signupLink: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
  },
  footerText: {
    color: "#1F1F1F",
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});
