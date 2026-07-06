import { Stack } from "expo-router";
import React from "react";

export default function StoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Loja" }} />
    </Stack>
  );
}
