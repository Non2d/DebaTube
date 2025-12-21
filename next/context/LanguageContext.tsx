
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { en, LocaleType } from '../constants/en';
import { ja } from '../constants/ja';

type Language = 'en' | 'ja';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (path: string, params?: Record<string, string | number>) => string;
    locale: LocaleType; // Expose the full object for direct access if needed (though t() is preferred for fallback)
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<Language>('en');

    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Client-side only
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('app_language') as Language;
            if (saved && (saved === 'en' || saved === 'ja')) {
                setLanguage(saved);
            } else {
                const browserLang = navigator.language;
                if (browserLang.startsWith('ja')) {
                    setLanguage('ja');
                }
            }
            setIsLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && isLoaded) {
            localStorage.setItem('app_language', language);
        }
    }, [language, isLoaded]);

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

    // Helper to get the current locale object (mixed with fallback)
    // This is hard to do perfectly recursive efficiently, so we rely on t() mostly.
    // But we can return the raw object for iteration if needed.
    const locale = language === 'ja' ? ja : en;

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, locale }}>
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
