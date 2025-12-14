import { Text, View } from "react-native";
type PercentageCardProps = { title: string; value: number };
export function PercentageCard({ title, value }: PercentageCardProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <View
      style={{
        backgroundColor: "#121212",
        borderRadius: 16,
        padding: 16,
        width: "100%",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#1F1F1F",
      }}
    >
      <Text style={{ fontSize: 13, color: "#9E9E9E" }}>{title}</Text>
      <Text
        style={{
          fontSize: 28,
          fontWeight: "700",
          color: "#fff",
          marginVertical: 8,
        }}
      >
        {clampedValue}%
      </Text>
      <View
        style={{
          height: 8,
          backgroundColor: "#1F1F1F",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${clampedValue}%`,
            height: "100%",
            backgroundColor: "#4CAF50",
            borderRadius: 8,
          }}
        />
      </View>
    </View>
  );
}
