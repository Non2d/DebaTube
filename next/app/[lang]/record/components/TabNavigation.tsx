
import { Zap, Eye, LayoutDashboard } from 'lucide-react';
import { useTranslation } from '../../../../context/LanguageContext';

export type TabType = 'dashboard' | 'audio' | 'visualization';

interface TabNavigationProps {
    activeTab: TabType;
    onTabSwitch: (tab: TabType) => void;
}

export default function TabNavigation({ activeTab, onTabSwitch }: TabNavigationProps) {
    const { t } = useTranslation();

    return (
        <div className="flex justify-center mb-2">
            <div className="bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl inline-flex shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 backdrop-blur-sm">
                <button
                    onClick={() => onTabSwitch('dashboard')}
                    className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'dashboard'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                        }`}
                >
                    <div className={`p-1 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-50 dark:bg-indigo-500/20' : 'bg-transparent'}`}>
                        <LayoutDashboard size={16} />
                    </div>
                    <span>{t('recordPage.tabs.dashboard')}</span>
                </button>
                <button
                    onClick={() => onTabSwitch('audio')}
                    className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'audio'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                        }`}
                >
                    <div className={`p-1 rounded-lg ${activeTab === 'audio' ? 'bg-indigo-50 dark:bg-indigo-500/20' : 'bg-transparent'}`}>
                        <Zap size={16} className={activeTab === 'audio' ? "fill-indigo-600 dark:fill-indigo-400" : ""} />
                    </div>
                    <span>{t('recordPage.tabs.audio')}</span>
                </button>
                <button
                    onClick={() => onTabSwitch('visualization')}
                    className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'visualization'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                        }`}
                >
                    <div className={`p-1 rounded-lg ${activeTab === 'visualization' ? 'bg-indigo-50 dark:bg-indigo-500/20' : 'bg-transparent'}`}>
                        <Eye size={16} />
                    </div>
                    <span>{t('recordPage.tabs.visualization')}</span>
                </button>
            </div>
        </div>
    );
}
