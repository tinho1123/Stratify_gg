import { Stack } from "expo-router";
import React from "react";

export default function GuildLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Guilda" }} />
      <Stack.Screen name="create" options={{ presentation: "modal", title: "Criar Guilda" }} />
      <Stack.Screen name="browse" options={{ title: "Buscar Guilda" }} />
      <Stack.Screen name="invites" options={{ title: "Convites" }} />
      <Stack.Screen name="[id]" options={{ title: "Perfil da Guilda" }} />
      <Stack.Screen name="shield" options={{ title: "Escudo da Guilda" }} />
    </Stack>
  );
}
