import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Check, Loader2, Download, FileText, Users, MessageSquare, AlertCircle } from 'lucide-react';

export type ProcessingStepStatus = 'pending' | 'processing' | 'completed' | 'error' | 'disabled';

interface Step {
    id: number;
    title: string;
    description: string;
    icon: React.ReactNode;
}

interface ProcessingStepsProps {
    currentStep: number;
    stepsStatus: ProcessingStepStatus[];
    onStepAction: (stepId: number, action: string, data?: any) => void;
    isRegistrationComplete: boolean;
    // videoInfo: any; // Removed unused prop to clean up
    downloadProgress?: number;
}

export default function ProcessingSteps({
    currentStep,
    stepsStatus,
    onStepAction,
    isRegistrationComplete,
    downloadProgress = 0
}: ProcessingStepsProps) {
    const { t } = useTranslation();
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

    // Auto-expand current active step
    useEffect(() => {
        if (isRegistrationComplete && currentStep > 0 && currentStep <= 5) {
            setExpandedStep(currentStep);
        }
    }, [currentStep, isRegistrationComplete]);

    const steps: Step[] = [
        { id: 1, title: 'Audio Download', description: 'Download audio from YouTube', icon: <Download size={18} /> },
        { id: 2, title: 'Transcription', description: 'Transcribe and segment sentences', icon: <FileText size={18} /> },
        { id: 3, title: 'Speaker Diarization', description: 'Assign speakers to segments', icon: <Users size={18} /> },
        { id: 4, title: 'ADU Segmentation', description: 'Identify arguments and POIs', icon: <MessageSquare size={18} /> },
        { id: 5, title: 'Rebuttal Detection', description: 'Identify rebuttal relationships', icon: <AlertCircle size={18} /> },
    ];

    const getStatusColor = (status: ProcessingStepStatus) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
            case 'processing': return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800';
            case 'error': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800';
            case 'pending': return 'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border-slate-200 dark:border-slate-700';
            case 'disabled': return 'opacity-50 grayscale bg-slate-50 border-slate-100 dark:bg-slate-900 dark:border-slate-800';
            default: return '';
        }
    };

    const getStatusIcon = (status: ProcessingStepStatus) => {
        if (status === 'processing') return <Loader2 className="animate-spin" size={16} />;
        if (status === 'completed') return <Check size={16} />;
        if (status === 'error') return <AlertCircle size={16} />;
        return null;
    };

    return (
        <div className="w-full space-y-4 mt-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 px-1">
                Processing Workflow
            </h3>

            <div className="space-y-3">
                {steps.map((step, index) => {
                    const status = isRegistrationComplete ? stepsStatus[index] : 'disabled';
                    const isActive = expandedStep === step.id;
                    const isClickable = isRegistrationComplete && status !== 'disabled';

                    return (
                        <div
                            key={step.id}
                            className={`
                                relative rounded-xl border transition-all duration-300 overflow-hidden
                                ${getStatusColor(status)}
                                ${isActive ? 'ring-2 ring-indigo-500/50 dark:ring-indigo-400/50 shadow-md' : ''}
                            `}
                        >
                            {/* Header / Summary */}
                            <div
                                className={`flex items-center p-4 ${isClickable ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : ''}`}
                                onClick={() => isClickable && setExpandedStep(isActive ? null : step.id)}
                            >
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center mr-4 shrink-0
                                    ${status === 'completed' ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}
                                `}>
                                    {getStatusIcon(status) || <span className="text-xs font-bold">{step.id}</span>}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm truncate">{step.title}</h4>
                                    <p className="text-xs opacity-80 truncate">{step.description}</p>
                                </div>

                                {status === 'processing' && (
                                    <span className="text-xs font-medium px-2 py-1 bg-white/50 dark:bg-black/20 rounded-md ml-2">
                                        Processing...
                                    </span>
                                )}
                            </div>

                            {/* Expanded Content (Action Area) */}
                            {isActive && isClickable && (
                                <div className="p-4 pt-0 border-t border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20">
                                    <div className="mt-4">
                                        {/* Timer for processing status */}
                                        {status === 'processing' && (
                                            <div className="mb-4">
                                                <StepTimer />
                                            </div>
                                        )}

                                        {/* Placeholder for specific step controls */}
                                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                                            {step.description}
                                        </p>

                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onStepAction(step.id, 'run');
                                                }}
                                                disabled={status === 'processing' || status === 'completed'}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {status === 'processing' ? <Loader2 className="animate-spin" size={14} /> : <ZapIcon size={14} />}
                                                Run Step
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ZapIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
    )
}

function StepTimer() {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return (
        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-md border border-blue-100 dark:border-blue-800">
            <Loader2 className="animate-spin" size={14} />
            <span className="font-medium">
                Processing... ({minutes}m {secs}s)
            </span>
        </div>
    );
}
