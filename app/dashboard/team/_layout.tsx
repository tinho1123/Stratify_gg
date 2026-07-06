import { Stack } from "expo-router";
import React from "react";

export default function TeamLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" options={{ title: "Perfil do Time" }} />
    </Stack>
  );
}
