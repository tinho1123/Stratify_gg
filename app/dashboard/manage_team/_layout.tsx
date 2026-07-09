import { Stack } from "expo-router";
import React from "react";

export default function ManageTeamLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Manage Team",
        }}
      />
      <Stack.Screen name="shield" options={{ title: "Escudo" }} />
    </Stack>
  );
}
