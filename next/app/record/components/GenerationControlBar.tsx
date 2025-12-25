
import { List, Zap } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { DebateFormatType } from '../../../constants/constants';
import { useTranslation } from '../../../context/LanguageContext';

interface GenerationControlBarProps {
    debateFormat: DebateFormatType;
    setDebateFormat: (format: DebateFormatType) => void;
    roundName: string;
    setRoundName: (name: string) => void;
    motion: string;
    setMotion: (motion: string) => void;
    roundCandidates: string[];
    generateDebateGraph: () => void;
    isGeneratingGraph: boolean;
    areAllAudioFilesReady: boolean;
}

export default function GenerationControlBar({
    debateFormat,
    setDebateFormat,
    roundName,
    setRoundName,
    motion,
    setMotion,
    roundCandidates,
    generateDebateGraph,
    isGeneratingGraph,
    areAllAudioFilesReady
}: GenerationControlBarProps) {
    const { t } = useTranslation();

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 mt-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                {/* Format Input Group */}
                <div className="lg:col-span-3">
                    <div className="relative group h-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                            <List size={18} strokeWidth={2} />
                        </div>
                        <select
                            value={debateFormat}
                            onChange={(e) => setDebateFormat(e.target.value as DebateFormatType)}
                            className="h-12 w-full pl-10 pr-10 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-700/50"
                        >
                            <option value="NA">{t('recordPage.formatOptions.na')}</option>
                            <option value="ASIAN">{t('recordPage.formatOptions.asian')}</option>
                            <option value="BP">{t('recordPage.formatOptions.bp')}</option>
                            <option value="OPENING_HALF_BP_ORDER">{t('recordPage.formatOptions.openingHalfBp')}</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="transition-transform group-focus-within:rotate-180">
                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] uppercase tracking-wider font-bold text-slate-400 pointer-events-none">{t('recordPage.controls.format')}</label>
                    </div>
                </div>

                {/* Round ID Input Group (Combined) */}
                <div className="lg:col-span-9 flex gap-2">
                    <div className="relative group h-full flex-1">
                        <SearchableSelect
                            options={roundCandidates}
                            value={roundName}
                            onChange={setRoundName}
                            placeholder={t('recordPage.controls.enterRoundId')}
                            label={t('recordPage.controls.roundId')}
                        />
                    </div>
                    {/* Motion Input */}
                    <div className="relative group h-full flex-[2]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors z-10">
                            <List size={18} strokeWidth={2} />
                        </div>
                        <input
                            type="text"
                            value={motion}
                            onChange={(e) => setMotion(e.target.value)}
                            className="h-12 w-full pl-10 pr-3 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all hover:bg-slate-50/50 dark:hover:bg-slate-700/50"
                            placeholder={t('recordPage.controls.motionPlaceholder')}
                        />
                        <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] uppercase tracking-wider font-bold text-slate-400 pointer-events-none">{t('recordPage.controls.motion')}</label>
                    </div>
                </div>

                {/* Primary Action Button */}
                <div className="lg:col-span-12">
                    <button
                        onClick={generateDebateGraph}
                        disabled={!areAllAudioFilesReady || isGeneratingGraph || !roundName}
                        className={`h-12 w-full flex items-center justify-center gap-2.5 rounded-xl text-sm font-bold tracking-wide transition-all shadow-md active:scale-[0.98] ${isGeneratingGraph
                            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200 cursor-wait'
                            : !roundName
                                ? 'bg-slate-100 text-slate-400 ring-1 ring-slate-200 cursor-not-allowed'
                                : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg focus:ring-4 focus:ring-indigo-500/20'
                            }`}
                    >
                        <Zap size={18} className={isGeneratingGraph ? "animate-pulse" : "fill-current"} />
                        <span>{isGeneratingGraph ? t('recordPage.controls.processing') : t('recordPage.controls.generateGraph')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
