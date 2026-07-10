import React from "react";
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Mask, Rect } from "react-native-svg";

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TutorialOverlayProps {
  visible: boolean;
  stepIndex: number;
  totalSteps: number;
  title: string;
  description: string;
  spotlight: SpotlightRect | null;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
  nextLabel: string;
  finishLabel: string;
  skipLabel: string;
}

const C = {
  emerald: "#10B981",
  surfaceDeep: "#0D0D0D",
  borderStrong: "#242424",
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  textFaint: "#4B5563",
};

const PAD = 10;
const CARD_MARGIN = 16;

export function TutorialOverlay({
  visible,
  stepIndex,
  totalSteps,
  title,
  description,
  spotlight,
  onNext,
  onSkip,
  isLast,
  nextLabel,
  finishLabel,
  skipLabel,
}: TutorialOverlayProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const { width: screenW, height: screenH } = Dimensions.get("window");

  // Alvos maiores que a tela (ex.: uma lista inteira de jogadores) não deixam espaço livre
  // nem acima nem abaixo do destaque — sem esse fallback, o card era empurrado pra fora da
  // área visível e cortava o texto. `ESTIMATED_CARD_HEIGHT` é uma estimativa generosa (o
  // card real quase sempre é menor); os limites usam os safe-area insets pra nunca cobrir
  // a barra de status nem a borda inferior do aparelho.
  const ESTIMATED_CARD_HEIGHT = 200;
  const CARD_MIN_TOP = insets.top + 12;
  const CARD_MAX_TOP = screenH - ESTIMATED_CARD_HEIGHT - insets.bottom - 16;

  let cardTop = CARD_MIN_TOP;
  if (spotlight) {
    const spaceBelow = screenH - (spotlight.y + spotlight.height) - PAD - insets.bottom - 16 - ESTIMATED_CARD_HEIGHT;
    const spaceAbove = spotlight.y - PAD - CARD_MIN_TOP - ESTIMATED_CARD_HEIGHT;
    if (spaceBelow >= 0) {
      cardTop = spotlight.y + spotlight.height + PAD * 2;
    } else if (spaceAbove >= 0) {
      cardTop = spotlight.y - PAD * 2 - ESTIMATED_CARD_HEIGHT;
    } else {
      cardTop = CARD_MIN_TOP;
    }
    cardTop = Math.max(CARD_MIN_TOP, Math.min(cardTop, CARD_MAX_TOP));
  }

  const card = (
    <View style={styles.card}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {stepIndex + 1} / {totalSteps}
        </Text>
        <View style={styles.dotsRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View key={i} style={[styles.dot, i === stepIndex && styles.dotActive]} />
          ))}
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      <View style={styles.btnRow}>
        <TouchableOpacity onPress={onSkip} hitSlop={8}>
          <Text style={styles.skipText}>{skipLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={onNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>{isLast ? finishLabel : nextLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="spotlight-mask">
              <Rect x={0} y={0} width={screenW} height={screenH} fill="#fff" />
              {spotlight && (
                <Rect
                  x={spotlight.x - PAD}
                  y={spotlight.y - PAD}
                  width={spotlight.width + PAD * 2}
                  height={spotlight.height + PAD * 2}
                  rx={16}
                  fill="#000"
                />
              )}
            </Mask>
          </Defs>
          <Rect x={0} y={0} width={screenW} height={screenH} fill="rgba(3,7,5,0.85)" mask="url(#spotlight-mask)" />
          {spotlight && (
            <Rect
              x={spotlight.x - PAD}
              y={spotlight.y - PAD}
              width={spotlight.width + PAD * 2}
              height={spotlight.height + PAD * 2}
              rx={16}
              fill="none"
              stroke={C.emerald}
              strokeWidth={2}
            />
          )}
        </Svg>

        {spotlight ? (
          <View
            pointerEvents="box-none"
            style={[styles.cardWrap, { left: CARD_MARGIN, right: CARD_MARGIN, top: cardTop }]}
          >
            {card}
          </View>
        ) : (
          <View style={styles.centeredWrap} pointerEvents="box-none">
            {card}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    position: "absolute",
  },
  centeredWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    paddingHorizontal: CARD_MARGIN,
  },
  card: {
    backgroundColor: C.surfaceDeep,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderStrong,
    padding: 18,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.emerald,
    letterSpacing: 1,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2A2A2A",
  },
  dotActive: {
    backgroundColor: C.emerald,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: C.textPrimary,
  },
  desc: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 19,
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  skipText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textFaint,
    letterSpacing: 0.5,
  },
  nextBtn: {
    backgroundColor: C.emerald,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  nextBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 0.5,
  },
});
