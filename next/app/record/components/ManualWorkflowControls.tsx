import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Check, Copy } from 'lucide-react';
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
}

export function ManualWorkflowControls({
    manualState,
    onStartTranscription,
    onSubmitAdu,
    onSubmitRebuttal,
    onCancel,
    isGeneratingGraph
}: ManualWorkflowControlsProps) {
    const { t } = useTranslation();
    const [jsonInput, setJsonInput] = useState('');
    const [copied, setCopied] = useState(false);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = () => {
        if (!jsonInput.trim()) return;

        try {
            JSON.parse(jsonInput); // Simple validation
        } catch (e) {
            alert(t('recordPage.manualMode.invalidJson'));
            return;
        }

        if (manualState.step === 'adu_prompt_ready') {
            onSubmitAdu(jsonInput);
        } else if (manualState.step === 'rebuttal_prompt_ready') {
            onSubmitRebuttal(jsonInput);
        }
        setJsonInput('');
    };

    if (manualState.step === 'initial') {
        return null;
    }

    if (manualState.step === 'adu_prompt_ready' || manualState.step === 'rebuttal_prompt_ready') {
        const title = manualState.step === 'adu_prompt_ready'
            ? t('recordPage.manualMode.step2Title')
            : t('recordPage.manualMode.step3Title');
        const prompt = manualState.step === 'adu_prompt_ready' ? manualState.aduPrompt : manualState.rebuttalPrompt;

        return (
            <div className="flex flex-col gap-4 p-4 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm mt-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">
                        {title} <span className="text-sm font-normal text-slate-500">
                            ({t('recordPage.manualMode.tryCount', { count: manualState.tryCount })})
                        </span>
                    </h3>
                    {manualState.isProcessing && <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />}
                </div>

                <div className="space-y-2">
                    <Label>{t('recordPage.manualMode.promptLabel')}</Label>
                    <div className="relative">
                        <Textarea
                            readOnly
                            value={prompt}
                            className="bg-slate-50 dark:bg-slate-800 min-h-[100px] font-mono text-xs"
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            className="absolute top-2 right-2 h-8 w-8"
                            onClick={() => handleCopy(prompt)}
                        >
                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>{t('recordPage.manualMode.pasteLabel')}</Label>
                    <Textarea
                        placeholder={t('recordPage.manualMode.placeholder')}
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        className="font-mono text-xs min-h-[100px]"
                    />
                </div>

                <div className="flex justify-end">
                    <Button
                        onClick={handleSubmit}
                        disabled={manualState.isProcessing || !jsonInput}
                        className="bg-slate-900 hover:bg-slate-800 text-white"
                    >
                        {manualState.isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('recordPage.manualMode.submit')}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 text-center text-green-600 font-semibold bg-green-50 dark:bg-green-900/10 rounded-lg mt-4 border border-green-200 dark:border-green-900">
            {t('recordPage.manualMode.completed')}
        </div>
    );
}
