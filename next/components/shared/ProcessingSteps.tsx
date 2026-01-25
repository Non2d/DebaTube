import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Check, Loader2, Download, FileText, Users, MessageSquare, AlertCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';

export type ProcessingStepStatus = 'pending' | 'processing' | 'completed' | 'error' | 'disabled';

interface SubStep {
    id: string;
    title: string;
    description: string;
}

interface Step {
    id: number;
    title: string;
    description: string;
    icon: React.ReactNode;
    subSteps?: SubStep[];
}

interface ProcessingStepsProps {
    currentStep: number;
    stepsStatus: ProcessingStepStatus[];
    onStepAction: (stepId: number, action: string, data?: any) => void;
    isRegistrationComplete: boolean;
    // videoInfo: any; // Removed unused prop to clean up
    downloadProgress?: number;
    renderStepContent?: (stepId: number) => React.ReactNode;
    jobProgress?: any;
}

export default function ProcessingSteps({
    currentStep,
    stepsStatus,
    onStepAction,
    isRegistrationComplete,
    downloadProgress = 0,
    renderStepContent,
    jobProgress,
    headerContent,
    children
}: ProcessingStepsProps & { headerContent?: React.ReactNode, children?: React.ReactNode }) {
    const { t } = useTranslation();
    const [expandedStep, setExpandedStep] = useState<number | null>(null);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [targetResetStep, setTargetResetStep] = useState<{ id: number, subId?: string, label: string } | null>(null);

    // Timer states: { stepId: { startTime: number, duration?: number } }
    const [stepTimers, setStepTimers] = useState<Record<number, { startTime?: number, duration?: number }>>({});

    // Track status changes to manage timers
    useEffect(() => {
        stepsStatus.forEach((status, index) => {
            const stepId = index + 1;
            setStepTimers(prev => {
                const currentTimer = prev[stepId];
                // Start timer if processing and not started
                if (status === 'processing' && !currentTimer?.startTime) {
                    return { ...prev, [stepId]: { startTime: Date.now() } };
                }
                // Stop timer if completed/error and running
                if ((status === 'completed' || status === 'error') && currentTimer?.startTime && !currentTimer.duration) {
                    return { ...prev, [stepId]: { ...currentTimer, duration: Date.now() - currentTimer.startTime } };
                }
                // Reset timer if pending (cleanup)
                if (status === 'pending' && currentTimer) {
                    const { [stepId]: _, ...rest } = prev;
                    return rest;
                }
                return prev;
            });
        });
    }, [stepsStatus]);

    const handleResetClick = (stepId: number, subId: string | undefined, label: string) => {
        setTargetResetStep({ id: stepId, subId, label });
        setResetDialogOpen(true);
    };

    const confirmReset = () => {
        if (!targetResetStep) return;

        // Determine start_step string for API
        let startStep = "";
        if (targetResetStep.subId) {
            // e.g. "1a" -> "1-a"
            startStep = targetResetStep.subId.replace(/^(\d)([a-z])$/, "$1-$2");
        } else {
            startStep = targetResetStep.id.toString();
        }

        onStepAction(targetResetStep.id, 'reset', { startStep });
        setResetDialogOpen(false);
        setTargetResetStep(null);
    };

    // Auto-expand current active step
    useEffect(() => {
        if (isRegistrationComplete && currentStep > 0 && currentStep <= 5) {
            setExpandedStep(currentStep);
        }
    }, [currentStep, isRegistrationComplete]);

    const steps: Step[] = [
        {
            id: 1,
            title: t('dashboard.steps.transcriptGeneration'),
            description: t('dashboard.steps.transcriptGenerationDesc'),
            icon: <FileText size={18} />,
            subSteps: [
                { id: '1a', title: t('dashboard.steps.subSteps.downloadAudio'), description: t('dashboard.steps.transcriptGenerationDesc') },
                { id: '1b', title: t('dashboard.steps.subSteps.transcribeWords'), description: t('dashboard.steps.transcriptGenerationDesc') },
                { id: '1c', title: t('dashboard.steps.subSteps.registerWords'), description: t('dashboard.steps.transcriptGenerationDesc') },
                { id: '1d', title: t('dashboard.steps.subSteps.groupSentences'), description: t('dashboard.steps.transcriptGenerationDesc') }
            ]
        },
        { id: 2, title: t('dashboard.steps.speakerDiarization'), description: t('dashboard.steps.speakerDiarizationDesc'), icon: <Users size={18} /> },
        { id: 3, title: t('dashboard.steps.aduSegmentation'), description: t('dashboard.steps.aduSegmentationDesc'), icon: <MessageSquare size={18} /> },
        { id: 4, title: t('dashboard.steps.rebuttalDetection'), description: t('dashboard.steps.rebuttalDetectionDesc'), icon: <AlertCircle size={18} /> }
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
        if (status === 'error') return <AlertCircle size={16} />;
        return null;
    };

    return (
        <div className="w-full space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 px-1">
                {t('dashboard.steps.title')}
            </h3>

            {headerContent && (
                <div className="mb-4">
                    {headerContent}
                </div>
            )}

            {children ? children : (
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
                                        {getStatusIcon(status) || <span className="text-base font-bold leading-none">{step.id}</span>}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm truncate">{step.title}</h4>
                                        <p className="text-xs opacity-80 truncate">{step.description}</p>
                                    </div>

                                    {/* Timer in Header (Right aligned) */}
                                    {(status === 'processing' || (status === 'completed' && stepTimers[step.id]?.duration)) && (
                                        <div className="ml-2" onClick={(e) => e.stopPropagation()}>
                                            <StepTimer
                                                startTime={stepTimers[step.id]?.startTime}
                                                duration={stepTimers[step.id]?.duration}
                                                status={status}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Expanded Content (Action Area) */}
                                {isActive && isClickable && (
                                    <div className="p-4 pt-0 border-t border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20">
                                        <div className="mt-4">
                                            {/* Sub-steps Visualization */}
                                            {step.subSteps && (
                                                <div className="mb-6 flex flex-col gap-2">
                                                    {step.subSteps.map((subStep, subIndex) => {
                                                        // Determine status based on jobProgress data
                                                        let subStatus: 'pending' | 'processing' | 'completed' = 'pending';

                                                        if (status === 'completed') {
                                                            subStatus = 'completed';
                                                        } else if (jobProgress && step.id === 1) {
                                                            // Use jobProgress data for Step 1 sub-steps
                                                            // 1A: external_has_audio OR local_has_audio
                                                            // 1B: has_all_raw_speech_transcription OR has_raw_round_transcription
                                                            // 1C: words_registered
                                                            // 1D: sentences_registered
                                                            if (subIndex === 0) {
                                                                const audioComplete = jobProgress.external_has_audio || jobProgress.local_has_audio;
                                                                subStatus = audioComplete ? 'completed' :
                                                                    (status === 'processing' ? 'processing' : 'pending');
                                                            } else if (subIndex === 1) {
                                                                const transcriptionComplete = jobProgress.has_all_raw_speech_transcription || jobProgress.has_raw_round_transcription;
                                                                const audioComplete = jobProgress.external_has_audio || jobProgress.local_has_audio;
                                                                subStatus = transcriptionComplete ? 'completed' :
                                                                    (status === 'processing' && audioComplete) ? 'processing' : 'pending';
                                                            } else if (subIndex === 2) {
                                                                const transcriptionComplete = jobProgress.has_all_raw_speech_transcription || jobProgress.has_raw_round_transcription;
                                                                subStatus = jobProgress.words_registered ? 'completed' :
                                                                    (status === 'processing' && transcriptionComplete) ? 'processing' : 'pending';
                                                            } else if (subIndex === 3) {
                                                                subStatus = jobProgress.sentences_registered ? 'completed' :
                                                                    (status === 'processing' && jobProgress.words_registered) ? 'processing' : 'pending';
                                                            }
                                                        } else if (status === 'processing') {
                                                            // Fallback: show all as processing if no jobProgress data
                                                            subStatus = 'processing';
                                                        }

                                                        return (
                                                            <div key={subStep.id} className="flex items-center gap-3 p-2 rounded-lg bg-black/5 dark:bg-white/5">
                                                                <div className={`
                                                                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold leading-none pl-[1px]
                                                                ${subStatus === 'completed' ? 'bg-green-500 text-white' :
                                                                        subStatus === 'processing' ? 'bg-blue-500 text-white animate-pulse' :
                                                                            'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400'}
                                                            `}>
                                                                    {subStatus === 'processing' ? (
                                                                        <Loader2 size={12} className="animate-spin" />
                                                                    ) : (
                                                                        <span>{String.fromCharCode(65 + subIndex)}</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 flex flex-wrap items-center gap-x-2">
                                                                    <p className={`text-sm font-medium ${subStatus === 'pending' ? 'text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                                                                        {subStep.title}
                                                                    </p>
                                                                    {/* Warning for 1-A: Cache deleted */}
                                                                    {step.id === 1 && subIndex === 0 && jobProgress && (
                                                                        (() => {
                                                                            const audioComplete = jobProgress.external_has_audio || jobProgress.local_has_audio;
                                                                            const transcriptionComplete = jobProgress.has_all_raw_speech_transcription || jobProgress.has_raw_round_transcription;
                                                                            const cacheDeleted = !audioComplete && transcriptionComplete;

                                                                            if (cacheDeleted) {
                                                                                return (
                                                                                    <span className="text-xs text-amber-600 dark:text-amber-400">
                                                                                        キャッシュが削除されています
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()
                                                                    )}
                                                                </div>
                                                                {/* Reset Button for SubSteps */}
                                                                {subStatus === 'completed' && jobProgress && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            // Format: "Step 1-A: Download Audio"
                                                                            const stepLabel = `Step ${step.id}-${String.fromCharCode(65 + subIndex)}: ${subStep.title}`;
                                                                            handleResetClick(step.id, subStep.id, stepLabel);
                                                                        }}
                                                                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                                                                        title="Reset from this step"
                                                                    >
                                                                        <RotateCcw size={12} />
                                                                        <span>{t('dashboard.steps.actions.reset')}</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Custom Content for this step */}
                                            {renderStepContent && renderStepContent(step.id)}

                                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                                                <div>
                                                    {status === 'completed' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleResetClick(step.id, undefined, step.title);
                                                            }}
                                                            className="px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-sm font-medium transition-colors flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-800"
                                                        >
                                                            <RotateCcw size={14} />
                                                            {t('dashboard.steps.actions.reset')}
                                                        </button>
                                                    )}
                                                </div>
                                                <div>
                                                    {step.id === 1 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onStepAction(step.id, 'run');
                                                            }}
                                                            disabled={status === 'processing' || status === 'completed'}
                                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                        >
                                                            {status === 'processing' ? <Loader2 className="animate-spin" size={14} /> : <ZapIcon size={14} />}
                                                            {status === 'processing' ? t('dashboard.steps.actions.running') : t('dashboard.steps.actions.runStep')}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                </div>
            )}

            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <div className="mx-auto bg-red-100 dark:bg-red-900/30 w-12 h-12 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                            <AlertTriangle size={24} />
                        </div>
                        <DialogTitle className="text-center">{t('dashboard.steps.actions.resetDialogTitle')}</DialogTitle>
                        <DialogDescription className="text-center pt-2">
                            {t('dashboard.steps.actions.resetDialogContent').replace('{step}', targetResetStep?.label || '')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
                            {t('dashboard.steps.actions.resetDialogCancel')}
                        </Button>
                        <Button variant="destructive" onClick={confirmReset} className="bg-red-600 hover:bg-red-700 text-white">
                            {t('dashboard.steps.actions.resetDialogConfirm')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
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

function StepTimer({ startTime, duration, status }: { startTime?: number, duration?: number, status: ProcessingStepStatus }) {
    const { t } = useTranslation();
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (status === 'completed' && duration) {
            setElapsed(Math.round(duration / 1000));
            return;
        }

        if (startTime && status === 'processing') {
            const update = () => {
                setElapsed(Math.round((Date.now() - startTime) / 1000));
            };
            update(); // Initial update
            const interval = setInterval(update, 1000);
            return () => clearInterval(interval);
        }
    }, [startTime, duration, status]);

    const minutes = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const fmt = (n: number) => n.toString().padStart(2, '0');

    if (status === 'completed') {
        return (
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-white/50 dark:bg-black/20 px-2.5 py-1.5 rounded-full border border-green-200/50 dark:border-green-800/50">
                <Check size={12} />
                <span>
                    {fmt(minutes)}:{fmt(secs)}
                </span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-white/50 dark:bg-black/20 px-2.5 py-1.5 rounded-full border border-blue-200/50 dark:border-blue-800/50">
            <span>
                {t('dashboard.steps.status.processing')} ({fmt(minutes)}:{fmt(secs)})
            </span>
        </div>
    );
}
