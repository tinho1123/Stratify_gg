import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Language, translations } from "./translations";

const STORAGE_KEY = "stratify_language";

// Default por região: Brasil (ou qualquer locale pt-*) começa em português, o resto em inglês.
// Só é usado enquanto o usuário não escolheu nada manualmente (ver STORAGE_KEY acima).
function detectDefaultLanguage(): Language {
  try {
    const locales = Localization.getLocales();
    const first = locales?.[0];
    if (first?.regionCode === "BR" || first?.languageCode === "pt") return "pt";
    return "en";
  } catch {
    return "pt";
  }
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolve(dict: any, key: string): string | undefined {
  const value = key.split(".").reduce<any>(
    (obj, part) => (obj && typeof obj === "object" ? obj[part] : undefined),
    dict,
  );
  return typeof value === "string" ? value : undefined;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => detectDefaultLanguage());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "pt" || stored === "en") setLanguageState(stored);
    });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }, []);

  const t = useCallback((key: string): string => {
    return resolve(translations[language], key) ?? resolve(translations.pt, key) ?? key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
