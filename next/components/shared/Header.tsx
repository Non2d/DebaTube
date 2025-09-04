"use client";

import { useState } from 'react';
import { Moon, Sun, Menu, X } from 'lucide-react';
import { useAtom } from 'jotai';
import { themeAtom } from '../store/userAtom';

export default function Header() {
  const [isDark, setIsDark] = useAtom(themeAtom);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const navBg = isDark ? 'bg-gray-900/80' : 'bg-white/80';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const btnBg = isDark ? 'bg-gray-800' : 'bg-gray-100';
  const btnHover = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200';

  return (
    <nav className={`fixed top-0 w-full ${navBg} backdrop-blur-md z-50 border-b ${borderColor}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <a href="/landing" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:text-blue-600 transition-colors">
              DebaTube
            </a>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="/" className="hover:text-blue-600 transition-colors">Explore</a>
            <a href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</a>
            <a href="/record" className="hover:text-blue-600 transition-colors">Record</a>
            {/* <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${btnBg} ${btnHover} transition-colors`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button> */}
          </div>
        </div>
      </div>
    </nav>
  );
}