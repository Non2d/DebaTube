
"use client";

import React, { createContext, useContext } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
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

export function LanguageProvider({ children, lang }: { children: React.ReactNode, lang: Language }) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    // The language is now strictly determined by the prop passed from [lang]/layout.tsx (which comes from URL)
    const language = lang;

    const setLanguage = (newLang: Language) => {
        if (newLang === language) return;

        // Construct new path
        // Current pathname is like "/en/record" or "/en"
        // We replace the first segment
        const segments = pathname.split('/');
        segments[1] = newLang; // segments[0] is empty string
        const newPath = segments.join('/');

        // Preserve query params
        const queryString = params.toString();
        const finalUrl = queryString ? `${newPath}?${queryString}` : newPath;

        router.push(finalUrl);
    };

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
