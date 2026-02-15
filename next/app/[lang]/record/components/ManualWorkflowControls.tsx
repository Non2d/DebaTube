import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Check, Copy, ChevronDown, ChevronRight, Lock, Play } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

interface ManualWorkflowControlsProps {
    manualState: {
        step: 'initial' | 'adu_prompt_ready' | 'rebuttal_prompt_ready' | 'completed';
        roundName: string;
        tryCount: number;
        aduPrompt: string;
        rebuttalPrompt: string;
        isProcessing: boolean;
    };
    onStartTranscription: () => void;
    onSubmitAdu: (json: string) => void;
    onSubmitRebuttal: (json: string) => void;
    onCancel: () => void;
    isGeneratingGraph: boolean;
    areAllAudioFilesReady: boolean;
    roundName: string;
    generationElapsedTime: number;
}

export function ManualWorkflowControls({
    manualState,
    onStartTranscription,
    onSubmitAdu,
    onSubmitRebuttal,
    onCancel,
    isGeneratingGraph,
    areAllAudioFilesReady,
    roundName,
    generationElapsedTime
}: ManualWorkflowControlsProps) {
    const { t } = useTranslation();
    const [jsonInput, setJsonInput] = useState('');
    const [copied, setCopied] = useState(false);

    // Determines active step index for UI logic
    const getStepIndex = () => {
        switch (manualState.step) {
            case 'initial': return 0;
            case 'adu_prompt_ready': return 1;
            case 'rebuttal_prompt_ready': return 2;
            case 'completed': return 3;
            default: return 0;
        }
    };

    const stepIndex = getStepIndex();

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = (type: 'adu' | 'rebuttal') => {
        if (!jsonInput.trim()) return;
        try {
            JSON.parse(jsonInput);
        } catch (e) {
            alert(t('recordPage.manualMode.invalidJson'));
            return;
        }
        if (type === 'adu') onSubmitAdu(jsonInput);
        else onSubmitRebuttal(jsonInput);
        setJsonInput('');
    };

    // Step 1: Start
    const isStep1Done = stepIndex > 0;
    const isStep1Active = stepIndex === 0;

    // Step 2: ADU
    const isStep2Done = stepIndex > 1;
    const isStep2Active = stepIndex === 1;
    const isStep2Disabled = stepIndex < 1;

    // Step 3: Rebuttal
    const isStep3Done = stepIndex > 2;
    const isStep3Active = stepIndex === 2;
    const isStep3Disabled = stepIndex < 2;

    return (
        <div className="flex flex-col gap-4 w-full">

            {/* STEP 1: Initialization */}
            <div className={`border rounded-xl transition-all ${isStep1Active ? 'bg-white dark:bg-slate-900 border-red-200 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 border-slate-200'}`}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${isStep1Done ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                            }`}>
                            {isStep1Done ? <Check size={16} /> : "1"}
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200">
                            {t('recordPage.manualMode.step1Title')}
                        </h3>
                    </div>
                    {isStep1Done && <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">Completed</span>}
                </div>

                {isStep1Active && (
                    <div className="p-4 pt-0">
                        <button
                            onClick={onStartTranscription}
                            disabled={!areAllAudioFilesReady || isGeneratingGraph || !roundName}
                            className={`w-full h-12 flex items-center justify-center gap-2 rounded-lg font-bold transition-all shadow-md active:scale-[0.98] dark:shadow-[0_6px_20px_rgba(0,0,0,0.7)] ${isGeneratingGraph
                                ? 'bg-amber-100 text-amber-700 cursor-wait'
                                : !roundName
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-red-600 text-white hover:bg-red-700 shadow-red-200'
                                }`}
                        >
                            {isGeneratingGraph ? (
                                <Loader2 className="animate-spin" />
                            ) : (
                                <Play size={18} fill="currentColor" />
                            )}
                            <span>{isGeneratingGraph ? t('recordPage.controls.processingWithTime', { seconds: generationElapsedTime }) : t('recordPage.controls.generateManual')}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* STEP 2: ADU Generation */}
            <div className={`border rounded-xl transition-all ${isStep2Disabled ? 'opacity-60 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800' :
                isStep2Active ? 'bg-white dark:bg-slate-900 border-red-200 shadow-md ring-1 ring-red-100' :
                    'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${isStep2Done ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' :
                            isStep2Disabled ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                            }`}>
                            {isStep2Done ? <Check size={16} /> : isStep2Disabled ? <Lock size={14} /> : "2"}
                        </div>
                        <h3 className={`font-bold ${isStep2Disabled ? 'text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {t('recordPage.manualMode.step2Title')}
                        </h3>
                    </div>
                    {isStep2Done && <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">Completed</span>}
                </div>

                {isStep2Active && (
                    <div className="p-4 pt-0 space-y-4 animate-in slide-in-from-top-2 fade-in">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">{t('recordPage.manualMode.promptLabel')}</Label>
                                <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => handleCopy(manualState.aduPrompt)}>
                                    {copied ? <Check size={12} /> : <Copy size={12} />} Copy
                                </Button>
                            </div>
                            <Textarea readOnly value={manualState.aduPrompt} className="h-24 font-mono text-xs bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">{t('recordPage.manualMode.pasteLabel')}</Label>
                            <Textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder='[{"id": 1, "text": "..."}]'
                                className="h-24 font-mono text-xs bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                            />
                        </div>
                        <Button onClick={() => handleSubmit('adu')} disabled={manualState.isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white shadow-md dark:shadow-[0_6px_20px_rgba(0,0,0,0.7)]">
                            {manualState.isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('recordPage.manualMode.submitAdu')}
                        </Button>
                    </div>
                )}
            </div>

            {/* STEP 3: Rebuttal Generation */}
            <div className={`border rounded-xl transition-all ${isStep3Disabled ? 'opacity-60 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800' :
                isStep3Active ? 'bg-white dark:bg-slate-900 border-red-200 shadow-md ring-1 ring-red-100' :
                    'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${isStep3Done ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' :
                            isStep3Disabled ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                            }`}>
                            {isStep3Done ? <Check size={16} /> : isStep3Disabled ? <Lock size={14} /> : "3"}
                        </div>
                        <h3 className={`font-bold ${isStep3Disabled ? 'text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {t('recordPage.manualMode.step3Title')}
                        </h3>
                    </div>
                    {isStep3Done && <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">Completed</span>}
                </div>

                {isStep3Active && (
                    <div className="p-4 pt-0 space-y-4 animate-in slide-in-from-top-2 fade-in">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">{t('recordPage.manualMode.promptLabel')}</Label>
                                <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => handleCopy(manualState.rebuttalPrompt)}>
                                    {copied ? <Check size={12} /> : <Copy size={12} />} Copy
                                </Button>
                            </div>
                            <Textarea readOnly value={manualState.rebuttalPrompt} className="h-24 font-mono text-xs bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">{t('recordPage.manualMode.pasteLabel')}</Label>
                            <Textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder='Example: [[5, 2], [7, 3], [12, 8]]'
                                className="h-24 font-mono text-xs bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                            />
                        </div>
                        <Button onClick={() => handleSubmit('rebuttal')} disabled={manualState.isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white shadow-md dark:shadow-[0_6px_20px_rgba(0,0,0,0.7)]">
                            {manualState.isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('recordPage.manualMode.submitRebuttal')}
                        </Button>
                    </div>
                )}
            </div>

            {/* Completion Success Message */}
            {
                isStep3Done && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 flex items-center gap-3 animate-in fade-in zoom-in">
                        <Check size={24} />
                        <span className="font-bold">{t('recordPage.manualMode.completed')}</span>
                    </div>
                )
            }

        </div >
    );
}
