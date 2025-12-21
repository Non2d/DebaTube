"use client";

import { Play, BarChart3, MessageSquare, Users, ArrowRight, Check } from 'lucide-react';
import { useAtom } from 'jotai';
import { themeAtom } from '../../components/store/userAtom';
import Header from '../../components/shared/Header';
import { useTranslation } from '../../context/LanguageContext';

export default function LandingPage() {
  const [isDark] = useAtom(themeAtom);

  const { t } = useTranslation();

  const features = [
    {
      icon: BarChart3,
      title: t('landingPage.features.items.llmAnalysis.title'),
      description: t('landingPage.features.items.llmAnalysis.desc')
    },
    {
      icon: MessageSquare,
      title: t('landingPage.features.items.visualization.title'),
      description: t('landingPage.features.items.visualization.desc')
    },
    {
      icon: Users,
      title: t('landingPage.features.items.structureMapping.title'),
      description: t('landingPage.features.items.structureMapping.desc')
    },
    {
      icon: Play,
      title: t('landingPage.features.items.endToEnd.title'),
      description: t('landingPage.features.items.endToEnd.desc')
    }
  ];

  const benefits = [
    t('landingPage.benefits.items.item1'),
    t('landingPage.benefits.items.item2'),
    t('landingPage.benefits.items.item3'),
    t('landingPage.benefits.items.item4'),
    t('landingPage.benefits.items.item5'),
    t('landingPage.benefits.items.item6')
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
    <>
      <Header />
      <div className={`min-h-screen transition-colors duration-300 ${bgColor} ${textColor} pt-16`}>

        {/* Hero Section */}
        <section className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
                  {t('landingPage.hero.titlePart1')}
                </span>
                <br />
                <span className={textColor}>
                  {t('landingPage.hero.titlePart2')}
                </span>
              </h1>
              <p className={`text-xl ${textSecondary} mb-8 max-w-3xl mx-auto`}>
                {t('landingPage.hero.description')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/record" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center">
                  {t('landingPage.hero.getStarted')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
                <button className={`border-2 ${isDark ? 'border-gray-600 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-50'} ${textColor} px-8 py-3 rounded-lg font-semibold transition-colors`}>
                  {t('landingPage.hero.watchDemo')}
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
                {t('landingPage.features.titlePart1')}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> {t('landingPage.features.titlePart2')}</span>
              </h2>
              <p className={`text-xl ${textSecondary} max-w-2xl mx-auto`}>
                {t('landingPage.features.description')}
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
                  {t('landingPage.benefits.titlePart1')}
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> {t('landingPage.benefits.titlePart2')}</span>
                </h2>
                <p className={`text-xl ${textSecondary} mb-8`}>
                  {t('landingPage.benefits.description')}
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
                <div className={`aspect-video ${cardBg} rounded-lg shadow-lg overflow-hidden`}>
                  <iframe
                    className="w-full h-full"
                    src="https://www.youtube.com/embed/WRu5sfoN7XM?si=example"
                    title="DebaTube Demo Video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Parliamentary Debate Section */}
        <section className={`py-20 ${sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t('landingPage.parliamentaryDebate.titlePart1')}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> {t('landingPage.parliamentaryDebate.titlePart2')}</span>
              </h2>
              <p className={`text-xl ${textSecondary} max-w-3xl mx-auto`}>
                {t('landingPage.parliamentaryDebate.description')}
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-6">{t('landingPage.parliamentaryDebate.keyFeaturesTitle')}</h3>
                <div className="space-y-6">
                  <div className={`${cardBg} p-6 rounded-lg shadow-md`}>
                    <h4 className="text-lg font-semibold mb-3 text-blue-600">{t('landingPage.parliamentaryDebate.features.govVsOpp.title')}</h4>
                    <p className={textSecondary}>
                      {t('landingPage.parliamentaryDebate.features.govVsOpp.desc')}
                    </p>
                  </div>
                  <div className={`${cardBg} p-6 rounded-lg shadow-md`}>
                    <h4 className="text-lg font-semibold mb-3 text-green-600">{t('landingPage.parliamentaryDebate.features.strategicArgs.title')}</h4>
                    <p className={textSecondary}>
                      {t('landingPage.parliamentaryDebate.features.strategicArgs.desc')}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-bold mb-6">{t('landingPage.parliamentaryDebate.visualizationTitle')}</h3>
                <div className={`${cardBg} p-8 rounded-xl shadow-lg`}>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                      <p className={textSecondary}>
                        <strong>{t('landingPage.parliamentaryDebate.visualizations.complexStructure.title')}</strong> {t('landingPage.parliamentaryDebate.visualizations.complexStructure.desc')}
                      </p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                      <p className={textSecondary}>
                        <strong>{t('landingPage.parliamentaryDebate.visualizations.realTime.title')}</strong> {t('landingPage.parliamentaryDebate.visualizations.realTime.desc')}
                      </p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                      <p className={textSecondary}>
                        <strong>{t('landingPage.parliamentaryDebate.visualizations.educational.title')}</strong> {t('landingPage.parliamentaryDebate.visualizations.educational.desc')}
                      </p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
                      <p className={textSecondary}>
                        <strong>{t('landingPage.parliamentaryDebate.visualizations.postRound.title')}</strong> {t('landingPage.parliamentaryDebate.visualizations.postRound.desc')}
                      </p>
                    </div>
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
              {t('landingPage.cta.title')}
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              {t('landingPage.cta.description')}
            </p>
            <a href="/record" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-lg">
              {t('landingPage.cta.button')}
            </a>
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
                {t('landingPage.footer.description')}
              </p>
              <div className="flex justify-center space-x-6">
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">{t('landingPage.footer.privacy')}</a>
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">{t('landingPage.footer.terms')}</a>
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">{t('landingPage.footer.support')}</a>
              </div>
              <p className="text-gray-400 text-sm mt-4">
                {t('landingPage.footer.copyright')}
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}