import { supabase } from "@/database/supabase";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Pede permissão, pega o Expo push token e salva via RPC (client nunca escreve em
// `push_tokens` direto). Precisa de EAS configurado (`extra.eas.projectId` no app config) pra
// `getExpoPushTokenAsync` funcionar — sem isso (ou em simulador/emulador, sem `Device.isDevice`),
// falha em silêncio e o app segue normal, só sem push.
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    console.warn("[push] pulado: não é um dispositivo físico (emulador/simulador)");
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn("[push] pulado: permissão de notificação negada");
    return;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    console.warn("[push] token obtido:", token.data);
    const { error } = await supabase.rpc("save_push_token", { p_token: token.data });
    if (error) {
      console.warn("[push] save_push_token falhou:", error.message);
    } else {
      console.warn("[push] token salvo com sucesso");
    }
  } catch (err: any) {
    console.warn("[push] getExpoPushTokenAsync falhou:", err?.message ?? err);
  }
}
