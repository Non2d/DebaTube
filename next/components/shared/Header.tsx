"use client";

import Link from 'next/link';
import { Mic, Globe, LayoutDashboard, Podcast, Languages, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from '../../context/LanguageContext';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = "DebaTube" }: HeaderProps) {
  const { t, language: currentLang, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();

  const toggleLanguage = () => {
    setLanguage(currentLang === 'en' ? 'ja' : 'en');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <nav className="fixed top-0 w-full transition-colors duration-300 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-50 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href={`/${currentLang}/landing`} className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:text-blue-600 transition-colors">
              {t('header.title')}
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link href={`/${currentLang}`} className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-lg">{t('header.explore')}</Link>
            <Link href={`/${currentLang}/dashboard/video`} className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-lg">{t('header.dashboardVideo')}</Link>
            <Link href={`/${currentLang}/record`} className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-lg">{t('header.record')}</Link>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                <Globe size={16} />
                {currentLang === 'en' ? 'EN' : 'JP'}
              </button>

              <button
                onClick={toggleTheme}
                className="relative p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100"
                aria-label="Toggle theme"
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}