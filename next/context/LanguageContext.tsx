
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { languageAtom } from '../components/store/languageAtom';
import { en, LocaleType } from '../constants/en';
import { ja } from '../constants/ja';

type Language = 'en' | 'ja';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (path: string, params?: Record<string, string | number>) => string;
    locale: LocaleType;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useAtom(languageAtom);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Effect to auto-detect browser language if no preference is stored
    useEffect(() => {
        if (isMounted) {
            const stored = localStorage.getItem('app_language');
            if (!stored) {
                const browserLang = navigator.language;
                if (browserLang.startsWith('ja')) {
                    setLanguage('ja');
                }
            }
        }
    }, [isMounted, setLanguage]);

    if (!isMounted) {
        return null; //ここのおかげでhydration errorは防げてるけど，ロード時の空表示も発生させている
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
