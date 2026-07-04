import { Stack } from "expo-router";

export default function DashboardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
          headerShown: false,
          title: "Dashboard",
        }}
      />
      <Stack.Screen
        name="manage_team"
        options={{
          headerShown: false,
          title: "Manage Team",
        }}
      />
      <Stack.Screen
        name="training"
        options={{
          headerShown: false,
          title: "Training",
        }}
      />
      <Stack.Screen
        name="tactics"
        options={{
          headerShown: false,
          title: "Táticas",
        }}
      />
      <Stack.Screen
        name="matches"
        options={{
          headerShown: false,
          title: "Partidas",
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: false,
          title: "Profile",
        }}
      />
    </Stack>
  );
}
