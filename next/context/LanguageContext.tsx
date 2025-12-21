
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { en, LocaleType } from '../constants/en';
import { ja } from '../constants/ja';

type Language = 'en' | 'ja';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (path: string, params?: Record<string, string | number>) => string;
    locale: LocaleType;
    isDark: boolean;
    toggleTheme: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<Language>('en');
    const [isDark, setIsDark] = useState<boolean>(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Client-side only
        if (typeof window !== 'undefined') {
            // 1. Language Initialization
            const savedLang = localStorage.getItem('app_language') as Language;
            if (savedLang && (savedLang === 'en' || savedLang === 'ja')) {
                setLanguage(savedLang);
            } else {
                const browserLang = navigator.language;
                if (browserLang.startsWith('ja')) {
                    setLanguage('ja');
                }
            }

            // 2. Theme Initialization
            // Check 'app_theme' first (new standard), then 'theme' (legacy jotai)
            let initialDark = false;
            const savedAppTheme = localStorage.getItem('app_theme');
            const savedLegacyTheme = localStorage.getItem('theme');

            if (savedAppTheme) {
                initialDark = savedAppTheme === 'dark';
            } else if (savedLegacyTheme) {
                // Legacy 'theme' might be "true" or "false" (strings)
                initialDark = savedLegacyTheme === 'true';
            } else {
                // System preference fallback
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    initialDark = true;
                }
            }

            setIsDark(initialDark);
            if (initialDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            // 3. Unblock Render
            setIsLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && isLoaded) {
            localStorage.setItem('app_language', language);
        }
    }, [language, isLoaded]);

    useEffect(() => {
        if (typeof window !== 'undefined' && isLoaded) {
            localStorage.setItem('app_theme', isDark ? 'dark' : 'light');
            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, [isDark, isLoaded]);

    if (!isLoaded) {
        return null;
    }

    const t = (path: string, params?: Record<string, string | number>): string => {
        const keys = path.split('.');

        let value: any = language === 'ja' ? ja : en;
        let fallbackValue: any = en;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key as keyof typeof value];
            } else {
                value = undefined;
            }

            if (fallbackValue && typeof fallbackValue === 'object' && key in fallbackValue) {
                fallbackValue = fallbackValue[key as keyof typeof fallbackValue];
            } else {
                fallbackValue = undefined;
            }
        }

        if (value === undefined || value === null) {
            value = fallbackValue;
        }

        if (typeof value !== 'string') {
            if (process.env.NODE_ENV === 'development') {
                console.warn(`Translation missing for key: ${path}`);
            }
            return path; // Return key as fallback
        }

        let result = value;
        if (params) {
            Object.entries(params).forEach(([key, val]) => {
                result = result.replace(`{${key}}`, String(val));
            });
        }
        return result;
    };

    const toggleTheme = () => {
        setIsDark(prev => !prev);
    };

    // Helper to get the current locale object (mixed with fallback)
    // This is hard to do perfectly recursive efficiently, so we rely on t() mostly.
    // But we can return the raw object for iteration if needed.
    const locale = language === 'ja' ? ja : en;

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, locale, isDark, toggleTheme }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
}
