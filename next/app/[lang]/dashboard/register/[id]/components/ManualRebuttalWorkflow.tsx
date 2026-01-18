"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, Save, Check } from 'lucide-react';
import { getAPIRoot } from '@/components/lib/utils';
import toast from 'react-hot-toast';

interface ManualRebuttalWorkflowProps {
    roundName: string;
    tryCount: number;
    t: (key: string) => string;
    onComplete: () => void;
}

export function ManualRebuttalWorkflow({
    roundName,
    tryCount,
    t,
    onComplete
}: ManualRebuttalWorkflowProps) {
    const [prompt, setPrompt] = useState("");
    const [jsonInput, setJsonInput] = useState("");
    const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (roundName && tryCount) {
            fetchPrompt();
        }
    }, [roundName, tryCount]);

    const fetchPrompt = async () => {
        setIsLoadingPrompt(true);
        try {
            // Try via resume first
            const res = await fetch(getAPIRoot() + '/manual/resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ round_name: roundName, try_count: tryCount })
            });

            let promptFound = false;
            if (res.ok) {
                const data = await res.json();
                if (data.prompt && (data.status === 'step2_done' || data.status === 'completed')) {
                    setPrompt(data.prompt);
                    promptFound = true;
                }
            }

            // If resume didn't yield a prompt (e.g. maybe it returned 'completed' without prompt), force fetch:
            if (!promptFound) {
                const promptRes = await fetch(`${getAPIRoot()}/manual/rebuttal-prompt/${roundName}?try_count=${tryCount}`);
                if (promptRes.ok) {
                    const pData = await promptRes.json();
                    if (pData.prompt) setPrompt(pData.prompt);
                }
            }

        } catch (e) {
            console.error(e);
            toast.error("Failed to load prompt");
        } finally {
            setIsLoadingPrompt(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success(t('dashboard.steps.actions.copied') || "Copied");
    };

    const handleSubmit = async () => {
        if (!jsonInput.trim()) return;
        try {
            JSON.parse(jsonInput);
        } catch (e) {
            toast.error(t('recordPage.manualMode.invalidJson') || "Invalid JSON format");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(getAPIRoot() + '/manual/submit-rebuttal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ round_name: roundName, try_count: tryCount, rebuttal_json: jsonInput })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Failed to submit rebuttal");
            }

            toast.success("Rebuttal data saved successfully!");
            onComplete();

        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-sm animate-in fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="font-bold text-lg">{t('recordPage.manualMode.step3Title')}</h3>
                    <p className="text-sm text-slate-500">Identify rebuttal relationships between ADUs.</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleCopy} disabled={!prompt || isLoadingPrompt}>
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {t('dashboard.steps.actions.copyPrompt') || "Copy Prompt"}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label>{t('recordPage.manualMode.promptLabel')}</Label>
                    <Textarea
                        value={isLoadingPrompt ? "Loading prompt..." : prompt}
                        readOnly
                        className="h-[400px] font-mono text-xs bg-slate-50 dark:bg-slate-800 leading-tight"
                    />
                </div>
                <div className="space-y-2">
                    <Label>{t('recordPage.manualMode.pasteLabel')}</Label>
                    <Textarea
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        placeholder={`Example:\n[[5, 2], [7, 3], [12, 8]]`}
                        className="h-[400px] font-mono text-xs bg-white dark:bg-slate-900 leading-tight"
                    />
                </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
                <Button onClick={handleSubmit} disabled={isSubmitting || !jsonInput} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[200px]">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {t('recordPage.manualMode.submitRebuttal')}
                </Button>
            </div>
        </div>
    )
}
