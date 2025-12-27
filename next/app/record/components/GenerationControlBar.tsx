import React, { useState } from 'react';
import { List, Zap } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { DebateFormatType, DEBATE_FORMATS } from '../../../constants/constants';
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
    callLlmAllAtOnce: boolean;
    setCallLlmAllAtOnce: (val: boolean) => void;
    useLatestTranscription: boolean;
    setUseLatestTranscription: (val: boolean) => void;
    aduModel: string;
    setAduModel: (val: string) => void;
    rebuttalModel: string;
    setRebuttalModel: (val: string) => void;
    transcriptionModel: string;
    setTranscriptionModel: (val: string) => void;
    generationElapsedTime: number;
}

const DEFAULT_MODEL_OPTIONS = [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
];

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
    areAllAudioFilesReady,
    callLlmAllAtOnce,
    setCallLlmAllAtOnce,
    useLatestTranscription,
    setUseLatestTranscription,
    aduModel,
    setAduModel,
    rebuttalModel,
    setRebuttalModel,
    transcriptionModel,
    setTranscriptionModel,
    generationElapsedTime,
}: GenerationControlBarProps) {
    const { t } = useTranslation();
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [modelOptions, setModelOptions] = useState(DEFAULT_MODEL_OPTIONS);

    React.useEffect(() => {
        const fetchModels = async () => {
            try {
                // Determine API base URL (assuming localhost:8080 like in useGraphGeneration, or relative via proxy)
                // For now hardcoding or using environment if available would be best.
                // Safest to try localhost:8080 as per existing hook.
                const res = await fetch('http://localhost:8080/gemini-models');
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'success' && Array.isArray(data.models)) {
                        const newOptions = data.models.map((m: string) => {
                            // m is like "models/gemini-1.5-flash"
                            const val = m.replace(/^models\//, '');
                            return {
                                value: val, // use simplified name for value
                                label: val  // use simplified name for label too for clarity
                            };
                        });
                        setModelOptions(newOptions);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch models from backend, using defaults", e);
            }
        };
        fetchModels();
    }, []);

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

                {/* Advanced Options Toggle */}
                <div className="lg:col-span-12 flex justify-end">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs text-slate-500 hover:text-indigo-500 underline transition-colors"
                    >
                        {showAdvanced ? t('recordPage.advancedOptions.hide') : t('recordPage.advancedOptions.show')}
                    </button>
                </div>

                {/* Advanced Options Panel */}
                {showAdvanced && (
                    <div className="lg:col-span-12 flex flex-col gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        {/* Checkboxes */}
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 p-1 rounded">
                                <input
                                    type="checkbox"
                                    checked={callLlmAllAtOnce}
                                    onChange={(e) => setCallLlmAllAtOnce(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {t('recordPage.advancedOptions.processAllAtOnce')}
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 p-1 rounded">
                                <input
                                    type="checkbox"
                                    checked={useLatestTranscription}
                                    onChange={(e) => setUseLatestTranscription(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {t('recordPage.advancedOptions.useLatestTranscription')}
                                </span>
                            </label>
                        </div>

                        {/* Model Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('recordPage.advancedOptions.transcriptionModel')}</label>
                                <select
                                    value={transcriptionModel}
                                    onChange={(e) => setTranscriptionModel(e.target.value)}
                                    className="h-10 px-3 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="openai-whisper">whisper-1 (OpenAI)</option>
                                    <option value="groq-whisper-large-v3">whisper-large-v3 (Groq)</option>
                                    <option value="groq-whisper-large-v3-turbo">whisper-large-v3-turbo (Groq)</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('recordPage.advancedOptions.aduModel')}</label>
                                <select
                                    value={aduModel}
                                    onChange={(e) => setAduModel(e.target.value)}
                                    className="h-10 px-3 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {modelOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('recordPage.advancedOptions.rebuttalModel')}</label>
                                <select
                                    value={rebuttalModel}
                                    onChange={(e) => setRebuttalModel(e.target.value)}
                                    className="h-10 px-3 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {modelOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )
                }

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
                        <span>{isGeneratingGraph ? t('recordPage.controls.processingWithTime', { seconds: generationElapsedTime }) : t('recordPage.controls.generateGraph')}</span>
                    </button>
                </div>
            </div >
        </div >
    );
}
