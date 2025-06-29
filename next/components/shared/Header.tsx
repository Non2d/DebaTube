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
  const bgColor = isDark ? 'bg-gray-900' : 'bg-white';

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
            {/* <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a> */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${btnBg} ${btnHover} transition-colors`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${btnBg}`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2 rounded-lg ${btnBg}`}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className={`md:hidden ${bgColor} border-t ${borderColor}`}>
          <div className="px-4 py-2 space-y-2">
            <a href="/" className="block py-2 hover:text-blue-600">Explore</a>
            <a href="/dashboard" className="block py-2 hover:text-blue-600">Dashboard</a>
            {/* <a href="#about" className="block py-2 hover:text-blue-600">About</a>
            <a href="#contact" className="block py-2 hover:text-blue-600">Contact</a> */}
          </div>
        </div>
      )}
    </nav>
  );
}