"use client";

import { useState } from 'react';
import { Moon, Sun, Globe } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from '../../context/LanguageContext';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = "DebaTube" }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ja' : 'en');
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const navBg = isDark ? 'bg-gray-900/80' : 'bg-white/80';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const btnBg = isDark ? 'bg-gray-800' : 'bg-gray-100';
  const btnHover = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200';
  const textPrimary = isDark ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';

  return (
    <nav className={`fixed top-0 w-full ${navBg} backdrop-blur-md z-50 border-b ${borderColor} transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <a href="/landing" className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:text-blue-600 transition-colors">
              {t('header.title')}
            </a>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <a href="/" className={`${textSecondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-lg`}>{t('header.explore')}</a>
            <a href="/dashboard" className={`${textSecondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-lg`}>{t('header.dashboard')}</a>
            <a href="/record" className={`${textSecondary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-lg`}>{t('header.record')}</a>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleLanguage}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${btnBg} ${btnHover} transition-colors text-sm font-medium ${textPrimary}`}
              >
                <Globe size={16} />
                {language === 'en' ? 'EN' : 'JP'}
              </button>

              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg ${btnBg} ${btnHover} transition-colors ${textPrimary}`}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}