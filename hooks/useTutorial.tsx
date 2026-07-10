import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "stratify_tutorials_completed";

interface TutorialContextValue {
  loaded: boolean;
  isCompleted: (id: string) => boolean;
  markCompleted: (id: string) => void;
  replayRequested: string | null;
  requestReplay: (id: string) => void;
  clearReplayRequest: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [replayRequested, setReplayRequested] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v) {
        try {
          setCompleted(JSON.parse(v));
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const markCompleted = (id: string) => {
    setCompleted((prev) => {
      const next = { ...prev, [id]: true };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return (
    <TutorialContext.Provider
      value={{
        loaded,
        isCompleted: (id) => !!completed[id],
        markCompleted,
        replayRequested,
        requestReplay: (id) => setReplayRequested(id),
        clearReplayRequest: () => setReplayRequested(null),
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within a TutorialProvider");
  return ctx;
}
