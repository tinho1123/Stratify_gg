import { Stack } from "expo-router";
import React from "react";

export default function MessagesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Mensagens" }} />
      <Stack.Screen name="[id]" options={{ title: "Conversa" }} />
    </Stack>
  );
}
