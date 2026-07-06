import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { supabase } from "@/database/supabase";

const STORAGE_KEY = "stratify_feature_flags";

interface FeatureFlagsContextValue {
  loaded: boolean;
  isEnabled: (key: string) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

async function fetchFlags(): Promise<Record<string, boolean> | null> {
  const { data, error } = await supabase.from("feature_flags").select("key, enabled");
  if (error || !data) return null;
  return Object.fromEntries(data.map((row) => [row.key, row.enabled]));
}

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached && !cancelled) {
        try {
          setFlags(JSON.parse(cached));
          setLoaded(true);
        } catch {}
      }

      const fresh = await fetchFlags();
      if (fresh && !cancelled) {
        setFlags(fresh);
        setLoaded(true);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)).catch(() => {});
      }
    })();

    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        fetchFlags().then((fresh) => {
          if (fresh) {
            setFlags(fresh);
            setLoaded(true);
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)).catch(() => {});
          }
        });
      }
      appState.current = next;
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  // Antes de a primeira busca (desta sessão ou por cache) ser bem-sucedida, toda
  // chave é tratada como desligada (fail-closed) — nunca mostra uma feature
  // incompleta por causa de uma falha de rede no primeiro load.
  const isEnabled = (key: string): boolean => {
    if (!loaded) return false;
    return flags[key] ?? true;
  };

  return (
    <FeatureFlagsContext.Provider value={{ loaded, isEnabled }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags must be used within a FeatureFlagsProvider");
  return ctx;
}
