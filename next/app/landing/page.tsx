"use client";

import { useState } from 'react';
import { Moon, Sun, Menu, X, Play, BarChart3, MessageSquare, Users, ArrowRight, Check } from 'lucide-react';
import { useAtom } from 'jotai';
import { themeAtom } from '../../components/store/userAtom';

export default function LandingPage() {
  const [isDark, setIsDark] = useAtom(themeAtom);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const features = [
    {
      icon: BarChart3,
      title: "LLM-Powered Analysis",
      description: "Advanced LLM technology analyzes debate arguments and rebuttals with precision"
    },
    {
      icon: MessageSquare,
      title: "Real-time Visualization",
      description: "Dynamic flowcharts show argument structures and counter-arguments instantly"
    },
    {
      icon: Users,
      title: "Debate Structure Mapping",
      description: "Comprehensive mapping of government and opposition positions"
    },
    {
      icon: Play,
      title: "End-to-End Processing",
      description: "Automatic transcription and speaker diarization from debate recordings"
    }
  ];

  const benefits = [
    "Instant argument structure visualization",
    "AI-powered rebuttal detection",
    "Multi-format export capabilities",
    "Real-time collaborative editing",
    "Comprehensive debate archives",
    "Performance analytics"
  ];

  const bgColor = isDark ? 'bg-gray-900' : 'bg-white';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const navBg = isDark ? 'bg-gray-900/80' : 'bg-white/80';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const btnBg = isDark ? 'bg-gray-800' : 'bg-gray-100';
  const btnHover = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200';
  const sectionBg = isDark ? 'bg-gray-800' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-900' : 'bg-white';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-300' : 'text-gray-700';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${bgColor} ${textColor}`}>
      {/* Navigation */}
      <nav className={`fixed top-0 w-full ${navBg} backdrop-blur-md z-50 border-b ${borderColor}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                DebaTube
              </h1>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="/" className="hover:text-blue-600 transition-colors">Browse Videos</a>
              <a href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</a>
              <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
              <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
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
              <a href="/" className="block py-2 hover:text-blue-600">Browse Videos</a>
              <a href="/dashboard" className="block py-2 hover:text-blue-600">Dashboard</a>
              <a href="#about" className="block py-2 hover:text-blue-600">About</a>
              <a href="#contact" className="block py-2 hover:text-blue-600">Contact</a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
                LLM Visualizes
              </span>
              <br />
              <span className={textColor}>
                Parliamentary Debate
              </span>
            </h1>
            <p className={`text-xl ${textSecondary} mb-8 max-w-3xl mx-auto`}>
              Transform competitive debate analysis with cutting-edge LLM technology. 
              Visualize argument flows, analyze rebuttals, and understand debate structures like never before.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center">
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
              <button className={`border-2 ${isDark ? 'border-gray-600 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-50'} ${textColor} px-8 py-3 rounded-lg font-semibold transition-colors`}>
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={`py-20 ${sectionBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful Features for
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Debate Analysis</span>
            </h2>
            <p className={`text-xl ${textSecondary} max-w-2xl mx-auto`}>
              Our advanced AI-powered platform provides comprehensive tools for analyzing and visualizing competitive debates.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className={`${cardBg} p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:transform hover:scale-105`}
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className={textSecondary}>{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Why Choose
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> DebaTube?</span>
              </h2>
              <p className={`text-xl ${textSecondary} mb-8`}>
                Experience the future of debate analysis with our comprehensive platform designed for coaches, students, and researchers.
              </p>
              
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center">
                    <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className={textMuted}>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className={`${isDark ? 'bg-gradient-to-br from-gray-800 to-gray-900' : 'bg-gradient-to-br from-blue-50 to-purple-50'} p-8 rounded-2xl`}>
              <div className={`aspect-video ${cardBg} rounded-lg shadow-lg flex items-center justify-center`}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                  <p className={textSecondary}>Interactive Demo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Debate Analysis?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of debaters, coaches, and researchers who are already using DebateViz to enhance their competitive debate experience.
          </p>
          <button className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-lg">
            Start Your Free Trial
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 ${sectionBg} border-t ${borderColor}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              DebaTube
            </h3>
            <p className={`${textSecondary} mb-4`}>
              Revolutionizing debate analysis through AI-powered visualization
            </p>
            <div className="flex justify-center space-x-6">
              <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">Terms</a>
              <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">Support</a>
            </div>
            <p className="text-gray-400 text-sm mt-4">
              © 2024 DebaTube. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}