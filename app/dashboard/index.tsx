import { PercentageCard } from "@/components/ui/PercentageCard";
import { Player, TeamCardAdvanced } from "@/components/ui/TeamCard";
import { Colors } from "@/constants/theme";
import { Image } from "expo-image";
import { Dimensions, ScrollView, StyleSheet, View } from "react-native";

const { height } = Dimensions.get("window");

export default function HomeScreen() {

   const players: Player[] = [
     { id: "1", name: "Alice", role: "IGL", status: "online" },
     { id: "2", name: "Bob", role: "AWPer", status: "offline" },
     { id: "3", name: "Charlie", role: "Support", status: "online" },
     { id: "4", name: "Diana", role: "Entry", status: "injured" },
     { id: "5", name: "Eve", role: "Flex", status: "banned" },
     { id: "6", name: "Frank", role: "AWPer", status: "online" },
   ];
   
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HERO IMAGE */}
      <View style={styles.heroContainer}>
        <Image
          source={require("../../assets/images/stratify-logo.png")}
          style={styles.heroImage}
          contentFit="cover"
        />

        {/* ICON OVER IMAGE */}
        <Image
          source={require("../../assets/images/stratify-logo.png")}
          style={styles.avatar}
          contentFit="contain"
        />
      </View>

      <View style={styles.cards_container}>
        <TeamCardAdvanced
          title="Time Principal"
          players={players}
          onPress={() => console.log("Gerenciar time")}
        />
        <PercentageCard title="Perfil Completo" value={75} />
        <PercentageCard title="Meta Mensal" value={42} />
        <PercentageCard title="Treinamento" value={90} />
        <PercentageCard title="Moral do Time" value={60} />
        <PercentageCard title="Torneios Ganhos" value={80} />
      </View>
    </ScrollView>
  );
}

const AVATAR_SIZE = 120;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  heroContainer: {
    width: "100%",
    height: height * 0.15 + AVATAR_SIZE / 2,
    position: "relative",
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  avatar: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: Colors.dark.background,
  },

  cards_container: {
    flex: 1,
    backgroundColor: "#000",
  },
  cards_grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
});
