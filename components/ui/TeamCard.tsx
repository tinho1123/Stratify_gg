import { Colors } from "@/constants/theme";
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type TeamCardProps = {
  title?: string;
  players: Player[];
  onPress?: () => void;
};

type PlayerStatus = "online" | "offline" | "injured" | "banned";
type PlayerRole = "IGL" | "AWPer" | "Support" | "Entry" | "Flex";

export type Player = {
  id: string;
  name: string;
  role: PlayerRole;
  status: PlayerStatus;
};

const statusColors: Record<PlayerStatus, string> = {
  online: "#4CAF50",
  offline: "#9E9E9E",
  injured: "#FFC107",
  banned: "#F44336",
};

const roleAbbrs: Record<PlayerRole, string> = {
  IGL: "IGL",
  AWPer: "AWP",
  Support: "SUP",
  Entry: "ENT",
  Flex: "FLX",
};

const AVATAR_SIZE = 40;

export function TeamCardAdvanced({
  title = "Time",
  players,
  onPress,
}: TeamCardProps) {
  const maxVisible = 5;
  const extraCount = players.length - maxVisible;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.avatarRow}>
        {players.slice(0, maxVisible).map((player, index) => {
          const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/png?seed=${encodeURIComponent(
            player.name
          )}`;

          return (
            <View
              key={player.id}
              style={[
                styles.avatarWrapper,
                { marginLeft: index === 0 ? 0 : -AVATAR_SIZE / 100 },
              ]}
            >
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                contentFit="cover"
              />
              {/* Status circle */}
              <View
                style={[styles.statusDot, { backgroundColor: statusColors[player.status] }]}
              />
              {/* Role badge */}
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {roleAbbrs[player.role]}
                </Text>
              </View>
            </View>
          );
        })}

        {extraCount > 0 && (
          <View
            style={[
              styles.avatarWrapper,
              {
                marginLeft: -AVATAR_SIZE / 100,
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
          >
            <View style={styles.extraCount}>
              <Text style={styles.extraText}>+{extraCount}</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor:  Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    width: "100%",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1F1F1F",
  },

  title: {
    fontSize: 13,
    color: "#9E9E9E",
    marginBottom: 12,
  },

  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },

  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },

  statusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#121212",
  },

  roleBadge: {
    position: "absolute",
    top: -6,
    left: -6,
    backgroundColor: "#333",
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },

  roleText: {
    fontSize: 8,
    color: "#fff",
    fontWeight: "700",
  },

  extraCount: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },

  extraText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
