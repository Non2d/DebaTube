import React, { useState } from 'react';
import { List, Zap, Play, RotateCw, ChevronDown, ChevronUp } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { DebateFormatType } from '../../../constants/constants';
import { useTranslation } from '../../../context/LanguageContext';
import { ManualWorkflowControls } from './ManualWorkflowControls';
import { Label } from '@/components/ui/label';

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
    manualMode: boolean;
    setManualMode: (val: boolean) => void;
    // Manual Workflow Props
    manualState?: any;
    onManualSubmitAdu?: (json: string) => void;
    onManualSubmitRebuttal?: (json: string) => void;
    resumeTryCount: number | null;
    setResumeTryCount: (val: number | null) => void;
}

const DEFAULT_MODEL_OPTIONS = [
    { value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
    { value: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
    { value: "gemini-3-flash-preview", label: "gemini-3-flash-preview" },
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
    manualMode,

    setManualMode,
    manualState,
    onManualSubmitAdu,
    onManualSubmitRebuttal,
    resumeTryCount,
    setResumeTryCount,
}: GenerationControlBarProps) {
    const { t } = useTranslation();
    const [showAdvanced, setShowAdvanced] = useState(false);
    // Use default models, no fetching
    const [modelOptions] = useState(DEFAULT_MODEL_OPTIONS);

    // Force "Call LLM All At Once" to be true when Manual Mode is active
    React.useEffect(() => {
        if (manualMode) {
            setCallLlmAllAtOnce(true);
        }
    }, [manualMode, setCallLlmAllAtOnce]);

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 mt-12">

            {/* Generation Tabs - Tabs at Top */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
                <button
                    onClick={() => setManualMode(false)}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!manualMode
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                >
                    {t('recordPage.controls.generationTabs.auto')}
                </button>
                <button
                    onClick={() => setManualMode(true)}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${manualMode
                        ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-300 shadow-sm dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                >
                    {t('recordPage.controls.generationTabs.manual')}
                </button>
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                {/* Row 1: Round ID and Try Count */}
                {/* Round ID Input Group */}
                <div className={`lg:col-span-${manualMode ? '9' : '12'}`}>
                    <div className="relative group h-full">
                        <SearchableSelect
                            options={roundCandidates}
                            value={roundName}
                            onChange={setRoundName}
                            placeholder={t('recordPage.controls.enterRoundId')}
                            label={t('recordPage.controls.roundId')}
                        />
                    </div>
                </div>

                {/* Try Count Input (Manual Mode Only) */}
                {manualMode && (
                    <div className="lg:col-span-3">
                        <div className="relative group h-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors z-10">
                                <RotateCw size={18} strokeWidth={2} />
                            </div>
                            <input
                                type="number"
                                min="1"
                                value={resumeTryCount ?? ''}
                                onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                    setResumeTryCount(val);
                                }}
                                className="h-12 w-full pl-10 pr-3 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-xl text-sm font-semibold font-mono text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all hover:bg-slate-50/50 dark:hover:bg-slate-700/50"
                                placeholder={t('recordPage.manualMode.tryCountPlaceholder') || "none"}
                            />
                            <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-800 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-400 pointer-events-none">{t('recordPage.manualMode.resumeLabel')}</label>
                        </div>
                    </div>
                )}

                {/* Row 2: Format and Motion */}
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
                        <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-800 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-400 pointer-events-none">{t('recordPage.controls.format')}</label>
                    </div>
                </div>

                {/* Motion Input Group */}
                <div className="lg:col-span-9">
                    <div className="relative group h-full">
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
                        <label className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-800 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-400 pointer-events-none">{t('recordPage.controls.motion')}</label>
                    </div>
                </div>


                {/* Main Action Area */}
                <div className="lg:col-span-12 mt-2">
                    {/* Advanced Options Toggle - MOVED ABOVE BUTTON */}
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-xs font-semibold text-slate-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center transition-colors"
                        >
                            {showAdvanced ? t('recordPage.advancedOptions.hide') : t('recordPage.advancedOptions.show')}
                            {showAdvanced ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                        </button>
                    </div>

                    {/* Advanced Options Panel - MOVED ABOVE BUTTON */}
                    {showAdvanced && (
                        <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-1">
                            <div className="flex flex-col gap-4">
                                {/* Row 1: Toggles */}
                                <div className="flex flex-col gap-3 items-start">
                                    {/* Transcription Toggle */}
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="useLatestTranscription"
                                            checked={useLatestTranscription}
                                            onChange={(e) => setUseLatestTranscription(e.target.checked)}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                        />
                                        <Label htmlFor="useLatestTranscription" className="text-sm cursor-pointer select-none font-medium text-slate-700 dark:text-slate-300">
                                            {t('recordPage.advancedOptions.useLatestTranscription')}
                                        </Label>
                                    </div>

                                    {/* Auto Mode: Process All Toggle */}
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="processAllAtOnce"
                                            checked={callLlmAllAtOnce}
                                            onChange={(e) => setCallLlmAllAtOnce(e.target.checked)}
                                            disabled={manualMode}
                                            className={`rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer ${manualMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        />
                                        <Label htmlFor="processAllAtOnce" className={`text-sm cursor-pointer select-none font-medium ${manualMode ? 'text-slate-400 opacity-70' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {t('recordPage.advancedOptions.processAllAtOnce')}
                                        </Label>
                                    </div>
                                </div>

                                {/* Row 2: Models (Grid) */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Transcription Model */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            {t('recordPage.advancedOptions.transcriptionModel')}
                                        </label>
                                        <select
                                            value={transcriptionModel}
                                            onChange={(e) => setTranscriptionModel(e.target.value)}
                                            className="h-9 px-3 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                        >
                                            <option value="openai-whisper">whisper-1 (OpenAI)</option>
                                            <option value="groq-whisper-large-v3">whisper-large-v3 (Groq)</option>
                                            <option value="groq-whisper-large-v3-turbo">whisper-large-v3-turbo (Groq)</option>
                                        </select>
                                    </div>

                                    {/* ADU Model */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className={`text-xs font-semibold ${manualMode ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {t('recordPage.advancedOptions.aduModel')}
                                        </label>
                                        <select
                                            value={aduModel}
                                            onChange={(e) => setAduModel(e.target.value)}
                                            disabled={manualMode}
                                            className={`h-9 px-3 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-opacity ${manualMode
                                                ? 'opacity-50 cursor-not-allowed text-slate-400'
                                                : 'text-slate-700 dark:text-slate-200'
                                                }`}
                                        >
                                            {modelOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Rebuttal Model */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className={`text-xs font-semibold ${manualMode ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {t('recordPage.advancedOptions.rebuttalModel')}
                                        </label>
                                        <select
                                            value={rebuttalModel}
                                            onChange={(e) => setRebuttalModel(e.target.value)}
                                            disabled={manualMode}
                                            className={`h-9 px-3 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-opacity ${manualMode
                                                ? 'opacity-50 cursor-not-allowed text-slate-400'
                                                : 'text-slate-700 dark:text-slate-200'
                                                }`}
                                        >
                                            {modelOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}



                    <div className="flex justify-center mb-4">
                        {manualMode ? (
                            <div className="w-full">
                                <ManualWorkflowControls
                                    manualState={manualState}
                                    onStartTranscription={generateDebateGraph}
                                    onSubmitAdu={onManualSubmitAdu!}
                                    onSubmitRebuttal={onManualSubmitRebuttal!}
                                    onCancel={() => setManualMode(false)}
                                    isGeneratingGraph={isGeneratingGraph}
                                    areAllAudioFilesReady={areAllAudioFilesReady}
                                    roundName={roundName}
                                    generationElapsedTime={generationElapsedTime}
                                />
                            </div>
                        ) : (
                            <button
                                onClick={generateDebateGraph}
                                disabled={!areAllAudioFilesReady || isGeneratingGraph || !roundName}
                                className={`h-14 w-full md:w-auto md:min-w-[240px] px-8 flex items-center justify-center gap-2.5 rounded-xl text-lg font-bold tracking-wide transition-all shadow-md active:scale-[0.98] dark:shadow-[0_6px_20px_rgba(0,0,0,0.7)] ${isGeneratingGraph
                                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200 cursor-wait'
                                    : !roundName
                                        ? 'bg-slate-100 text-slate-400 ring-1 ring-slate-200 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg focus:ring-4 focus:ring-indigo-500/20 dark:shadow-[0_6px_20px_rgba(0,0,0,0.7)]'
                                    }`}
                            >
                                {isGeneratingGraph ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2"></div>
                                        <span>{t('recordPage.controls.processingWithTime', { seconds: generationElapsedTime })}</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap size={20} className="fill-current" />
                                        <span>{t('recordPage.controls.generateAuto')}</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
