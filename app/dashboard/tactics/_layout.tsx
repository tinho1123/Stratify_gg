import { Stack } from "expo-router";
import React from "react";

export default function TacticsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Táticas" }} />
    </Stack>
  );
}
