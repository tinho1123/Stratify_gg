import { SpotlightRect } from "@/components/ui/TutorialOverlay";
import { useTutorial } from "@/hooks/useTutorial";
import { useEffect, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from "react-native";

export interface TutorialStepDef {
  ref: React.RefObject<View | null> | null;
  title: string;
  desc: string;
}

interface UseScreenTutorialOptions {
  id: string;
  steps: TutorialStepDef[];
  ready: boolean;
  scrollRef: React.RefObject<ScrollView | null>;
}

const TARGET_TOP_OFFSET = 140;

// Estado + navegação de um tour guiado sobre elementos reais da tela (spotlight). Rola até
// o elemento-alvo e só então mede a posição na tela usando apenas `.measure()` — no New
// Architecture (Fabric), `.measureLayout()` exige que o "relativeTo" seja a instância nativa
// do próprio componente, e passar um node handle (via findNodeHandle) dispara o warning
// "ref.measureLayout must be called with a ref to a native component" e nunca rola a tela.
export function useScreenTutorial({ id, steps, ready, scrollRef }: UseScreenTutorialOptions) {
  const { loaded, isCompleted, markCompleted, replayRequested, clearReplayRequest } = useTutorial();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const autoStartedRef = useRef(false);
  const scrollYRef = useRef(0);

  const goToStep = (index: number) => {
    setStep(index);
    const targetRef = steps[index]?.ref;
    if (!targetRef?.current) {
      setSpotlight(null);
      return;
    }
    targetRef.current.measure((_x, _y, w, h, pageX, pageY) => {
      const delta = pageY - TARGET_TOP_OFFSET;
      if (Math.abs(delta) > 4) {
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollYRef.current + delta), animated: true });
        setTimeout(() => {
          targetRef.current?.measure((_x2, _y2, w2, h2, pageX2, pageY2) => {
            setSpotlight({ x: pageX2, y: pageY2, width: w2, height: h2 });
          });
        }, 380);
      } else {
        setSpotlight({ x: pageX, y: pageY, width: w, height: h });
      }
    });
  };

  const finish = () => {
    setActive(false);
    setSpotlight(null);
    markCompleted(id);
  };

  const next = () => {
    if (step >= steps.length - 1) {
      finish();
      return;
    }
    goToStep(step + 1);
  };

  const start = () => {
    setActive(true);
    goToStep(0);
  };

  // Auto-inicia o tour na primeira vez que a tela carrega com dados reais (evita destacar
  // elementos ainda vazios/placeholder) — dispara só uma vez por sessão.
  useEffect(() => {
    if (autoStartedRef.current || !loaded || isCompleted(id) || !ready) return;
    autoStartedRef.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, ready]);

  // Disparado pelo botão "Rever tutorial" da tela de Perfil.
  useEffect(() => {
    if (replayRequested !== id || !ready) return;
    clearReplayRequest();
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayRequested, ready]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  return {
    active,
    step,
    spotlight,
    next,
    skip: finish,
    isLast: step === steps.length - 1,
    onScroll,
  };
}
