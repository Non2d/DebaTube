

import SearchableSelect from './SearchableSelect';
import { useTranslation } from '../../../context/LanguageContext';

interface VisualizationControlBarProps {
    roundName: string;
    setRoundName: (name: string) => void;
    tryCount: number | null;
    setTryCount: (count: number | null) => void;
    roundCandidates: string[];
    showPoiColors: boolean;
    setShowPoiColors: (show: boolean) => void;
    showNodeIds: boolean;
    setShowNodeIds: (show: boolean) => void;
}

export default function VisualizationControlBar({
    roundName,
    setRoundName,
    tryCount,
    setTryCount,
    roundCandidates,
    showPoiColors,
    setShowPoiColors,
    showNodeIds,
    setShowNodeIds
}: VisualizationControlBarProps) {
    const { t } = useTranslation();

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">

                {/* Round ID Badge (Editable) */}
                <div className="w-full lg:w-auto flex gap-2">
                    <div className="relative group h-full flex-1 lg:w-80">
                        <SearchableSelect
                            options={roundCandidates}
                            value={roundName}
                            onChange={setRoundName}
                            placeholder={t('recordPage.controls.searchRoundId')}
                            label={t('recordPage.controls.roundId')}
                        />
                    </div>
                    <div className="w-64 relative group h-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 z-10 font-bold text-sm">
                            v
                        </div>
                        <input
                            type="number"
                            min="1"
                            value={tryCount ?? ''}
                            onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) : null;
                                setTryCount(val);
                            }}
                            className="h-12 w-full pl-10 pr-3 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-xl text-sm font-semibold font-mono text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all hover:bg-slate-50/50 dark:hover:bg-slate-700/50"
                            placeholder={t('recordPage.manualMode.tryCountPlaceholder') || ""}
                        />
                        <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-800 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-400 pointer-events-none">{t('recordPage.manualMode.versionLabel')}</label>
                    </div>
                </div>

                {/* Display Options Toggles */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 bg-slate-50 dark:bg-slate-800 px-6 py-3 rounded-xl ring-1 ring-slate-200/80 dark:ring-slate-700">
                    {/* POI Toggle */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{t('recordPage.toggles.poiColor')}</span>
                        <button
                            onClick={() => setShowPoiColors(!showPoiColors)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showPoiColors ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm ${showPoiColors ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-300 mx-2"></div>

                    {/* Node ID Toggle */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{t('recordPage.toggles.nodeId')}</span>
                        <button
                            onClick={() => setShowNodeIds(!showNodeIds)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showNodeIds ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm ${showNodeIds ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
