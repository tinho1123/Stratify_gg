import { Stack } from "expo-router";
import React from "react";

export default function MatchesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Partidas" }} />
      <Stack.Screen name="season" options={{ title: "Liga" }} />
      <Stack.Screen name="tournament" options={{ title: "Torneio" }} />
      <Stack.Screen name="challenges" options={{ title: "Desafios" }} />
      <Stack.Screen name="live" options={{ title: "Ao Vivo" }} />
      <Stack.Screen name="[id]" options={{ title: "Partida" }} />
    </Stack>
  );
}
