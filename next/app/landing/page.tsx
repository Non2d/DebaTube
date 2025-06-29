"use client";

import { useState, useEffect } from 'react';
import { Moon, Sun, Menu, X, Play, BarChart3, MessageSquare, Users, ArrowRight, Check } from 'lucide-react';

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const features = [
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "AI-Powered Analysis",
      description: "Advanced LLM technology analyzes debate arguments and rebuttals with precision"
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Real-time Visualization",
      description: "Dynamic flowcharts show argument structures and counter-arguments instantly"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Debate Structure Mapping",
      description: "Comprehensive mapping of government and opposition positions"
    },
    {
      icon: <Play className="w-6 h-6" />,
      title: "Audio Processing",
      description: "Automatic transcription and speaker diarization from debate recordings"
    }
  ];

  const benefits = [
    "Instant argument flow visualization",
    "AI-powered rebuttal analysis",
    "Multi-format export capabilities",
    "Real-time collaborative editing",
    "Comprehensive debate archives",
    "Performance analytics"
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark' : ''}`}>
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {/* Navigation */}
        <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-50 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  DebateViz
                </h1>
              </div>
              
              <div className="hidden md:flex items-center space-x-8">
                <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
                <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
                <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>

              <div className="md:hidden flex items-center space-x-2">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800"
                >
                  {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <div className="px-4 py-2 space-y-2">
                <a href="#features" className="block py-2 hover:text-blue-600">Features</a>
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
                  Visualize Debate
                </span>
                <br />
                <span className="text-gray-900 dark:text-white">
                  Arguments with AI
                </span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
                Transform competitive debate analysis with cutting-edge LLM technology. 
                Visualize argument flows, analyze rebuttals, and understand debate structures like never before.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center">
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </button>
                <button className="border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Watch Demo
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Powerful Features for
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Debate Analysis</span>
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Our advanced AI-powered platform provides comprehensive tools for analyzing and visualizing competitive debates.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:transform hover:scale-105"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
                </div>
              ))}
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
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> DebateViz?</span>
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                  Experience the future of debate analysis with our comprehensive platform designed for coaches, students, and researchers.
                </p>
                
                <div className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mr-3">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 p-8 rounded-2xl">
                <div className="aspect-video bg-white dark:bg-gray-800 rounded-lg shadow-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-300">Interactive Demo</p>
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
        <footer className="py-12 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                DebateViz
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Revolutionizing debate analysis through AI-powered visualization
              </p>
              <div className="flex justify-center space-x-6">
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">Privacy</a>
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">Terms</a>
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">Support</a>
              </div>
              <p className="text-gray-400 text-sm mt-4">
                © 2024 DebateViz. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}