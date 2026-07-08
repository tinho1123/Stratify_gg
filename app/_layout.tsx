import { AppAlertProvider } from "@/components/ui/AppAlert";
import { UpdateRequiredScreen } from "@/components/ui/UpdateRequiredScreen";
import { supabase } from "@/database/supabase";
import { FeatureFlagsProvider } from "@/hooks/useFeatureFlags";
import { useMinVersionCheck } from "@/hooks/useMinVersionCheck";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { registerForPushNotifications } from "@/services/notifications";
import { configureRevenueCat } from "@/services/revenuecat";
import { initializeAds } from "@/services/adsInit";
import { initSentry, wrapRootComponent } from "@/services/sentryInit";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import "react-native-reanimated";

// O mais cedo possível, antes de qualquer render — pra capturar erros que aconteçam
// durante a montagem inicial do app.
initSentry();

async function redirectAfterLogin() {
  const { data } = await supabase
    .from("teams")
    .select("onboarded")
    .single();

  if (!data || !data.onboarded) {
    router.replace("/setup/team");
  } else {
    router.replace("/dashboard");
  }
}

function RootLayout() {
  const [checking, setChecking] = useState(true);
  const { checking: checkingVersion, updateRequired } = useMinVersionCheck();

  useEffect(() => {
    (async () => {
      // A Apple exige esse prompt antes de qualquer SDK de ads rodar rastreamento no iOS
      // (App Tracking Transparency, iOS 14.5+) — sem isso, o app é rejeitado na review.
      // O Android não tem esse prompt; segue direto pra inicialização do AdMob.
      if (Platform.OS === "ios") {
        await requestTrackingPermissionsAsync();
      }
      await initializeAds();
    })();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectAfterLogin();
        configureRevenueCat(session.user.id);
        registerForPushNotifications();
      }
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        redirectAfterLogin();
        if (session) configureRevenueCat(session.user.id);
        registerForPushNotifications();
      } else if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checkingVersion || checking) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0D0D0D", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (updateRequired) {
    return (
      <LanguageProvider>
        <UpdateRequiredScreen />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <FeatureFlagsProvider>
        <AppAlertProvider>
          <ThemeProvider value={DarkTheme}>
            <Stack initialRouteName="login" screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="setup/team" options={{ headerShown: false }} />
              <Stack.Screen name="dashboard" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </AppAlertProvider>
      </FeatureFlagsProvider>
    </LanguageProvider>
  );
}

export default wrapRootComponent(RootLayout);
