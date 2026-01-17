import { Stack } from "expo-router";
import React from "react";

export default function TrainingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Training",
        }}
      />
    </Stack>
  );
}
