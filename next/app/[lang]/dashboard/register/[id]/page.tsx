"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Header from '../../../../../components/shared/Header';
import { getAPIRoot, mapBackgroundStatus, type BackgroundStepStatus } from '../../../../../components/lib/utils';
import { useTranslation } from '../../../../../context/LanguageContext';

import ProcessingSteps, { ProcessingStepStatus } from '../../../../../components/shared/ProcessingSteps';
import { testColabConnection } from './actions';
import { useStepActions } from '../../../../../hooks/useStepActions';
import { ManualDiarizationWorkflow } from './components/ManualDiarizationWorkflow';
import { ManualAduWorkflow } from './components/ManualAduWorkflow';
import { ManualRebuttalWorkflow } from './components/ManualRebuttalWorkflow';
import { StyleChangeDialog } from './components/StyleChangeDialog';



export default function VideoDetailPage({ params }: { params: { lang: string, id: string } }) {
    const { t } = useTranslation();
    const router = useRouter();
    const roundId = params.id;

    const { resetProgress, runStep1 } = useStepActions({ roundId, t });
    // ... existing states ...

    // (Initialize hook later in the component body)
    // But replace_file_content cannot insert in two places easily if they are far apart.
    // I will do it in two steps or use multi_replace.
    // Let's use multi_replace.


    const [loading, setLoading] = useState(true);
    const [roundData, setRoundData] = useState<any>(null);
    const [stepsStatus, setStepsStatus] = useState<ProcessingStepStatus[]>(['pending', 'disabled', 'disabled', 'disabled']);
    const [currentStep, setCurrentStep] = useState(1);
    const [jobProgress, setJobProgress] = useState<any>(null);

    // Ref to track stepsStatus to avoid stale closures in async callbacks
    const stepsStatusRef = useRef(stepsStatus);
    useEffect(() => {
        stepsStatusRef.current = stepsStatus;
    }, [stepsStatus]);

    // New State for Colab Integration - Initialize from localStorage
    const [transcriptionModel, setTranscriptionModel] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('transcriptionModel') || "groq-whisper-large-v3-turbo";
        }
        return "groq-whisper-large-v3-turbo";
    });
    const [colabUrl, setColabUrl] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('colabUrl') || "";
        }
        return "";
    });
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [manualVideoUrl, setManualVideoUrl] = useState("");
    const [styleChangeDialog, setStyleChangeDialog] = useState<{ open: boolean, newStyle: string }>({ open: false, newStyle: '' });
    const [editedMotion, setEditedMotion] = useState("");
    const [isEditingMotion, setIsEditingMotion] = useState(false); // For recovery

    // LLM Model State
    const [llmModel, setLlmModel] = useState("gemini-2.5-flash");
    const [geminiModels, setGeminiModels] = useState<string[]>(["gemini-2.5-flash", "gemini-3-flash"]);

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await fetch(getAPIRoot() + '/audio2adu/gemini-models');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.models) {
                        setGeminiModels(data.models);
                        if (data.models.length > 0) {
                            setLlmModel(data.models[0]);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch Gemini models", e);
            }
        };
        fetchModels();
    }, []);

    // Workflow Mode State
    const [workflowMode, setWorkflowMode] = useState<'end-to-end' | 'manual'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('workflowMode') as 'end-to-end' | 'manual') || 'manual';
        }
        return 'manual';
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('workflowMode', workflowMode);
        }
    }, [workflowMode]);

    // Save transcription model to localStorage when it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('transcriptionModel', transcriptionModel);
        }
    }, [transcriptionModel]);

    // Save Colab URL to localStorage when it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('colabUrl', colabUrl);
        }
    }, [colabUrl]);

    const fetchRoundData = async () => {
        try {
            const res = await fetch(getAPIRoot() + `/rounds/${roundId}`);
            if (!res.ok) throw new Error('Failed to fetch round');
            const data = await res.json();
            setRoundData(data);
        } catch (error) {
            console.error('Error fetching round:', error);
            toast.error('Failed to load match data');
        } finally {
            setLoading(false);
        }
    };

    const fetchJobProgress = async () => {
        if (!roundData) return;
        try {
            const res = await fetch(getAPIRoot() + `/job-progress-background/${roundId}`);
            let progress;

            if (res.ok) {
                progress = await res.json();
            } else if (res.status === 404) {
                // Treat 404 as not_in_queue for all steps
                progress = {
                    step_1: 'NOT_IN_QUEUE',
                    step_2: 'NOT_IN_QUEUE',
                    step_3: 'NOT_IN_QUEUE',
                    step_4: 'NOT_IN_QUEUE',
                };
            } else {
                // Other errors - don't update
                return;
            }

            setJobProgress(progress); // Store progress data

            // Map job-progress-background to stepsStatus - Direct 1:1 mapping
            const newStatus: ProcessingStepStatus[] = [...stepsStatusRef.current];

            const statusToProcessingStatus = (status: BackgroundStepStatus, prevCompleted: boolean): ProcessingStepStatus => {
                if (status === 'done') return 'completed';
                if (status === 'processing' || status === 'in_queue') return 'processing';
                // not_in_queue
                return prevCompleted ? 'pending' : 'disabled';
            };

            // Step 1
            newStatus[0] = statusToProcessingStatus(mapBackgroundStatus(progress.step_1), true);

            // Step 2
            newStatus[1] = statusToProcessingStatus(mapBackgroundStatus(progress.step_2), newStatus[0] === 'completed');

            // Step 3
            newStatus[2] = statusToProcessingStatus(mapBackgroundStatus(progress.step_3), newStatus[1] === 'completed');

            // Step 4
            newStatus[3] = statusToProcessingStatus(mapBackgroundStatus(progress.step_4), newStatus[2] === 'completed');

            setStepsStatus(newStatus);

            // Update active step
            if (newStatus[0] === 'pending' || newStatus[0] === 'processing') setCurrentStep(1);
            else if (newStatus[1] === 'pending' || newStatus[1] === 'processing') setCurrentStep(2);
            else if (newStatus[2] === 'pending' || newStatus[2] === 'processing') setCurrentStep(3);
            else if (newStatus[3] === 'pending' || newStatus[3] === 'processing') setCurrentStep(4);
            else if (newStatus[3] === 'completed') setCurrentStep(4);
        } catch (e) {
            console.error(e);
        }
    }

    useEffect(() => {
        if (roundId) {
            fetchRoundData();
        }
    }, [roundId]);

    // Initial fetch of job progress
    useEffect(() => {
        if (!roundData) return;
        fetchJobProgress();
    }, [roundData]);

    // Polling for background processing
    useEffect(() => {
        if (!roundData || !jobProgress) return;

        // Check if any background step is in progress
        const backgroundSteps = [
            jobProgress.step_1a,
            jobProgress.step_1b,
            jobProgress.step_1c,
            jobProgress.step_1d,
            jobProgress.step_2,
            jobProgress.step_3,
            jobProgress.step_4
        ];

        const hasActiveBackgroundTask = backgroundSteps.some((status: string) => {
            const mappedStatus = mapBackgroundStatus(status);
            return mappedStatus === 'processing' || mappedStatus === 'in_queue';
        });

        if (!hasActiveBackgroundTask) {
            return; // No polling needed
        }

        // Poll every 3 seconds while processing
        const intervalId = setInterval(() => {
            fetchJobProgress();
        }, 3000);

        return () => clearInterval(intervalId);
    }, [roundData, jobProgress]);

    // Auto-continue Step 1-C and 1-D when Step 1-B completes
    const prevJobProgressRef = useRef<any>(null);
    useEffect(() => {
        if (!jobProgress || !prevJobProgressRef.current || !roundData) {
            prevJobProgressRef.current = jobProgress;
            return;
        }

        const prev = prevJobProgressRef.current;
        const curr = jobProgress;

        // Check if Step 1-B just completed
        const prevStep1bStatus = mapBackgroundStatus(prev.step_1b);
        const currStep1bStatus = mapBackgroundStatus(curr.step_1b);

        if (prevStep1bStatus !== 'done' && currStep1bStatus === 'done') {
            // Step 1-B just completed, first retrieve the result, then execute 1-C and 1-D
            (async () => {
                try {
                    // Get transcription result and save to DB
                    toast.loading(t('dashboard.steps.messages.retrievingResult') || 'Step 1-B: Retrieving result...', { id: 'step1b-result' });

                    const resultRes = await fetch(getAPIRoot() + `/transcription-result?round_id=${roundData.id}`);
                    if (!resultRes.ok) {
                        const err = await resultRes.json();
                        throw new Error(err.detail || t('dashboard.steps.messages.failedGetTranscriptionResult') || 'Failed to get transcription result');
                    }

                    toast.success(t('dashboard.steps.messages.resultSavedToDb') || 'Step 1-B: Result saved to DB', { id: 'step1b-result' });
                    await fetchJobProgress();

                    // Re-fetch progress
                    const progressRes = await fetch(getAPIRoot() + `/job-progress-background/${roundId}`);
                    let progress = curr;
                    if (progressRes.ok) {
                        progress = await progressRes.json();
                    }

                    // Step 1-C: Extract Words
                    if (!progress?.words_registered) {
                        toast.loading(t('dashboard.steps.messages.extractingWords') || 'Step 1-C: Extracting words...', { id: 'step1c' });

                        const res = await fetch(getAPIRoot() + `/extract-words-from-transcript/${roundData.id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                        });

                        if (!res.ok) {
                            const err = await res.json();
                            throw new Error(err.detail || t('dashboard.steps.messages.wordExtractionFailed') || 'Word extraction failed');
                        }
                        toast.success(t('dashboard.steps.messages.wordExtractionCompleted') || 'Step 1-C: Completed', { id: 'step1c' });
                        await fetchJobProgress();

                        // Re-fetch progress for next step
                        const progressRes = await fetch(getAPIRoot() + `/job-progress-background/${roundId}`);
                        if (progressRes.ok) {
                            progress = await progressRes.json();
                        }
                    } else {
                        // Silent skip
                    }

                    // Step 1-D: Group Sentences
                    if (!progress?.sentences_registered) {
                        toast.loading(t('dashboard.steps.messages.groupingSentences') || 'Step 1-D: Grouping sentences...', { id: 'step1d' });

                        const res = await fetch(getAPIRoot() + `/group-sentences-from-words/${roundData.id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                        });

                        if (!res.ok) {
                            const err = await res.json();
                            throw new Error(err.detail || t('dashboard.steps.messages.sentenceGroupingFailed') || 'Sentence generation failed');
                        }
                        const data = await res.json();
                        toast.success((t('dashboard.steps.messages.sentenceGroupingCompleted') || `Step 1-D: ${data.total_sentences} sentences`).replace('${count}', data.total_sentences), { id: 'step1d' });
                        await fetchJobProgress();
                    } else {
                        // Silent skip
                    }

                    toast.success(t('dashboard.steps.messages.step1Complete') || 'Step 1 All Complete!');
                } catch (error: any) {
                    console.error(error);
                    toast.dismiss('step1c');
                    toast.dismiss('step1d');
                    toast.error(error.message);
                }
            })();
        }

        prevJobProgressRef.current = jobProgress;
    }, [jobProgress, roundData]);

    const runAutoDiarization = async () => {
        try {
            const toastId = toast.loading(t('dashboard.steps.status.processing') || "Processing Auto Diarization...");
            const res = await fetch(getAPIRoot() + `/auto/diarization/${roundId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: llmModel })
            });
            toast.dismiss(toastId);

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Auto Diarization failed");
            }

            toast.success(t('dashboard.steps.messages.diarizationComplete') || "Diarization Complete!");
            await fetchJobProgress();
        } catch (e: any) {
            toast.error(e.message);
            throw e;
        }
    };

    const runAutoAdu = async () => {
        try {
            const toastId = toast.loading(t('dashboard.steps.status.processing') || "Processing Auto ADU...");
            const res = await fetch(getAPIRoot() + `/auto/adus/${roundId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: llmModel })
            });
            toast.dismiss(toastId);

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || t('dashboard.steps.messages.autoAduGenerationFailed') || "Auto ADU Generation failed");
            }

            toast.success(t('dashboard.steps.messages.aduGenerationComplete') || "ADU Generation Complete!");
            await fetchJobProgress();
        } catch (e: any) {
            toast.error(e.message);
            throw e;
        }
    };

    const runAutoRebuttal = async () => {
        try {
            const toastId = toast.loading(t('dashboard.steps.status.processing') || "Processing Auto Rebuttal...");
            const res = await fetch(getAPIRoot() + `/auto/rebuttals/${roundId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: llmModel })
            });
            toast.dismiss(toastId);

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || t('dashboard.steps.messages.autoRebuttalGenerationFailed') || "Auto Rebuttal Generation failed");
            }

            toast.success(t('dashboard.steps.messages.rebuttalGenerationComplete') || "Rebuttal Generation Complete!");
            await fetchJobProgress();
        } catch (e: any) {
            toast.error(e.message);
            throw e;
        }
    };

    const runEndToEndWorkflow = async () => {
        try {
            // Check which steps are already completed and skip them
            if (stepsStatusRef.current[0] !== 'completed') {
                await runStep1(roundData, setStepsStatus, stepsStatus, async () => await fetchJobProgress());
            }
            if (stepsStatusRef.current[1] !== 'completed') {
                await runAutoDiarization();
            }
            if (stepsStatusRef.current[2] !== 'completed') {
                await runAutoAdu();
            }
            if (stepsStatusRef.current[3] !== 'completed') {
                await runAutoRebuttal();
            }
            toast.success(t('dashboard.steps.messages.allStepsCompleted') || "All Steps Completed Successfully!");
        } catch (e: any) {
            console.error("End-to-End Workflow Stopped:", e);
        }
    };

    const handleStepAction = async (stepIndex: number, action: string = 'run', data?: any) => {
        if (action === 'reset') {
            const startStep = data?.startStep || "1-a";
            await resetProgress(startStep, fetchJobProgress);
            return;
        }

        if (stepIndex === 1) {
            runStep1(roundData, setStepsStatus, stepsStatus, fetchJobProgress);
            return;
        }

        if (workflowMode === 'end-to-end') {
            if (stepIndex === 2) await runAutoDiarization();
            else if (stepIndex === 3) await runAutoAdu();
            else if (stepIndex === 4) await runAutoRebuttal();
            return;
        }
    };

    const handleTestConnection = async () => {
        setIsTestingConnection(true);
        try {
            if (transcriptionModel === 'custom-colab-whisper') {
                if (!colabUrl) {
                    toast.error("URLを入力してください");
                    setIsTestingConnection(false);
                    return;
                }
                // Use Server Action to bypass CORS for Colab
                const result = await testColabConnection(colabUrl);
                if (result.success) {
                    toast.success("接続成功！ (Connection Successful)");
                } else {
                    toast.error(`接続失敗: ${result.message}`);
                }
            } else if (transcriptionModel === 'transcription-service') {
                // Use local proxy
                const res = await fetch(getAPIRoot() + '/transcription-service/health');
                if (res.ok) {
                    toast.success("Transcription Service 接続成功！");
                } else {
                    const err = await res.json().catch(() => ({ detail: res.statusText }));
                    toast.error(`接続失敗: ${err.detail || res.status}`);
                }
            }
        } catch (error: any) {
            toast.error(`エラー: ${error.message}`);
        } finally {
            setIsTestingConnection(false);
        }
    };

    const handleStyleChange = async (newStyle: string) => {
        try {
            const res = await fetch(getAPIRoot() + `/rounds/${roundId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ style: newStyle })
            });
            if (res.ok) {
                setRoundData({ ...roundData, style: newStyle });
                toast.success('Style updated successfully');
            } else {
                toast.error('Failed to update style');
            }
        } catch (error) {
            toast.error('Error updating style');
        }
    };

    const handleMotionSave = async () => {
        try {
            const res = await fetch(getAPIRoot() + `/rounds/${roundId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ motion: editedMotion })
            });
            if (res.ok) {
                setRoundData({ ...roundData, motion: editedMotion });
                setIsEditingMotion(false);
                toast.success('Motion updated successfully');
            } else {
                toast.error('Failed to update motion');
            }
        } catch (error) {
            toast.error('Error updating motion');
        }
    };

    const handleRecoverVideoId = async () => {
        if (!manualVideoUrl) {
            toast.error(t('dashboard.modal.messages.urlRequired'));
            return;
        }
        await runStep1(
            roundData,
            setStepsStatus,
            stepsStatus,
            async () => {
                await fetchJobProgress();
                await fetchRoundData();
            },
            manualVideoUrl
        );
    };

    const renderStepExtras = (stepId: number) => {
        // Step 2: Show ManualDiarizationWorkflow in manual mode
        if (stepId === 2 && workflowMode === 'manual') {
            return (
                <ManualDiarizationWorkflow
                    roundId={roundId}
                    roundName={roundData?.name || ''}
                    t={t}
                    onComplete={() => {
                        toast.success("Diarization completed!");
                        fetchJobProgress();
                    }}
                    debateFormat={roundData?.debate_format || 'british_parliamentary'}
                />
            );
        }

        // End-to-End Mode Action Buttons (Step 2, 3, 4)
        if (workflowMode === 'end-to-end' && (stepId === 2 || stepId === 3 || stepId === 4)) {
            const status = stepsStatus[stepId - 1]; // 0-based index maps to Step ID

            if (status === 'pending' || status === 'error') {
                return (
                    <div className="p-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-semibold text-sm mb-1">{t('dashboard.steps.autoMode') || "LLM Auto Mode"}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {stepId === 2 && (t('dashboard.steps.descriptions.autoDiarization') || "Automatically detect speakers using Gemini.")}
                                        {stepId === 3 && (t('dashboard.steps.descriptions.autoAdu') || "Automatically segment speech into arguments.")}
                                        {stepId === 4 && (t('dashboard.steps.descriptions.autoRebuttal') || "Automatically identify rebuttal structure.")}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleStepAction(stepId, 'run')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
                                >
                                    {t('dashboard.steps.actions.resumeStep') || "Resume from here"}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }
            return null;
        }

        // Step 3: Manual ADU Segmentation
        if (stepId === 3 && workflowMode === 'manual') {
            return (
                <ManualAduWorkflow
                    roundName={roundData?.name || ''}
                    tryCount={roundData?.try_count || 1}
                    t={t}
                    onComplete={() => {
                        fetchJobProgress();
                    }}
                />
            );
        }

        // Step 4: Manual Rebuttal Identification
        if (stepId === 4 && workflowMode === 'manual') {
            return (
                <ManualRebuttalWorkflow
                    roundName={roundData?.name || ''}
                    tryCount={roundData?.try_count || 1}
                    t={t}
                    onComplete={() => {
                        fetchJobProgress();
                    }}
                />
            );
        }

        if (stepId !== 1 || workflowMode === 'end-to-end') return null; // Model selection moved to Header for End-to-End

        return (
            <div className="mt-4 mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col gap-4">
                    {/* Transcription Model Selection */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Transcription Model
                        </label>
                        <select
                            value={transcriptionModel}
                            onChange={(e) => setTranscriptionModel(e.target.value)}
                            className="h-9 px-3 bg-white dark:bg-slate-900 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                        >
                            <option value="custom-colab-whisper">faster-whisper-whisper-large-v2 (Colab)</option>
                            <option value="transcription-service">faster-whisper-whisper-large-v2 (Transcription Service)</option>
                            <option value="groq-whisper-large-v3">whisper-large-v3 (Groq)</option>
                            <option value="groq-whisper-large-v3-turbo">whisper-large-v3-turbo (Groq)</option>
                            <option value="openai-whisper">whisper-1 (OpenAI)</option>
                        </select>
                    </div>



                    {/* Colab URL Input & Test Button (Custom Colab) */}
                    {transcriptionModel === 'custom-colab-whisper' && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Cloudflare API URL
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={colabUrl}
                                    onChange={(e) => setColabUrl(e.target.value)}
                                    placeholder="https://xxxx.trycloudflare.com"
                                    className="flex-1 h-9 px-3 bg-white dark:bg-slate-900 border-0 ring-1 ring-slate-200/80 dark:ring-slate-700 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-200"
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTestConnection();
                                    }}
                                    disabled={isTestingConnection || !colabUrl}
                                    className={`h-9 px-4 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${isTestingConnection
                                        ? 'bg-slate-100 text-slate-400 cursor-wait'
                                        : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md hover:shadow-lg dark:bg-indigo-600 dark:hover:bg-indigo-700'
                                        }`}
                                >
                                    {isTestingConnection ? 'Testing...' : 'Test Connection'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* External GPU Server Test Button (No URL Input) */}
                    {transcriptionModel === 'transcription-service' && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Connection Check
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTestConnection();
                                    }}
                                    disabled={isTestingConnection}
                                    className={`h-9 px-4 rounded-lg text-xs font-bold transition-all whitespace-nowrap w-full ${isTestingConnection
                                        ? 'bg-slate-100 text-slate-400 cursor-wait'
                                        : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md hover:shadow-lg dark:bg-indigo-600 dark:hover:bg-indigo-700'
                                        }`}
                                >
                                    {isTestingConnection ? 'Testing Service...' : 'Test Connection to Service'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!roundData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Round not found</p>
            </div>
        );
    }

    return (
        <>
            <Header />
            <div className="min-h-screen bg-background pt-24 pb-12 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-8">
                        <Link
                            href={`/${params.lang}/dashboard`}
                            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t('dashboard.modal.labels.back') || 'Back to Dashboard'}
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {t('dashboard.modal.labels.registerRound')}
                        </h1>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            {roundData.name}
                        </h2>

                        <div className="flex flex-wrap gap-6 text-sm">
                            <div>
                                <span className="block text-gray-500 dark:text-gray-400 mb-1">Style</span>
                                <div className="flex gap-2 items-center">
                                    <select
                                        value={roundData.style || 'british_parliamentary'}
                                        onChange={(e) => {
                                            const newStyle = e.target.value;
                                            const isStep2OrLaterCompleted = stepsStatus[1] === 'completed' ||
                                                stepsStatus[2] === 'completed' ||
                                                stepsStatus[3] === 'completed';

                                            if (isStep2OrLaterCompleted) {
                                                setStyleChangeDialog({ open: true, newStyle });
                                            } else {
                                                handleStyleChange(newStyle);
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="british_parliamentary">{t('recordPage.formatOptions.bp')}</option>
                                        <option value="north_american">{t('recordPage.formatOptions.na')}</option>
                                        <option value="asian">{t('recordPage.formatOptions.asian')}</option>
                                        <option value="wsdc">{t('recordPage.formatOptions.wsdc')}</option>
                                        <option value="hpdu">{t('recordPage.formatOptions.hpdu')}</option>
                                        <option value="bp_opening_half">{t('recordPage.formatOptions.openingHalfBp')}</option>
                                    </select>
                                </div>
                            </div>
                            {roundData.video_id && (
                                <div>
                                    <span className="block text-gray-500 dark:text-gray-400 mb-1">YouTube URL</span>
                                    <a
                                        href={`https://www.youtube.com/watch?v=${roundData.video_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                                    >
                                        {`https://www.youtube.com/watch?v=${roundData.video_id}`} <ExternalLink size={14} />
                                    </a>
                                </div>
                            )}
                            <div className="w-full">
                                <span className="block text-gray-500 dark:text-gray-400 mb-1">Motion</span>
                                {isEditingMotion ? (
                                    <div className="flex gap-2">
                                        <textarea
                                            value={editedMotion}
                                            onChange={(e) => setEditedMotion(e.target.value)}
                                            className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                            rows={2}
                                            placeholder="Enter motion..."
                                        />
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={handleMotionSave}
                                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsEditingMotion(false);
                                                    setEditedMotion(roundData.motion || '');
                                                }}
                                                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-sm font-medium transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2">
                                        <span className="flex-1 font-medium">{roundData.motion || '(No motion set)'}</span>
                                        <button
                                            onClick={() => {
                                                setEditedMotion(roundData.motion || '');
                                                setIsEditingMotion(true);
                                            }}
                                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-sm font-medium transition-colors"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Recovery UI for missing video_id */}
                            {!roundData.video_id && (
                                <div className="w-full mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                    <h4 className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 font-bold mb-2">
                                        <ExternalLink size={16} />
                                        Warning: Video ID Missing
                                    </h4>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                                        This round is missing the YouTube Video ID. Please enter the URL to fix it.
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={manualVideoUrl}
                                            onChange={(e) => setManualVideoUrl(e.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="flex-1 px-3 py-2 rounded border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-black/20 text-sm"
                                        />
                                        <button
                                            onClick={handleRecoverVideoId}
                                            disabled={!manualVideoUrl}
                                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm font-bold transition-colors disabled:opacity-50"
                                        >
                                            Save & Run
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 mb-8 min-h-[400px]">
                        <ProcessingSteps
                            currentStep={currentStep}
                            stepsStatus={stepsStatus}
                            onStepAction={handleStepAction}
                            isRegistrationComplete={true}
                            renderStepContent={renderStepExtras}
                            jobProgress={jobProgress}
                            headerContent={
                                <div className="mb-6">
                                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-md mx-auto">
                                        <button
                                            onClick={() => setWorkflowMode('end-to-end')}
                                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${workflowMode === 'end-to-end'
                                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                                }`}
                                        >
                                            LLM End-to-End
                                        </button>
                                        <button
                                            onClick={() => setWorkflowMode('manual')}
                                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${workflowMode === 'manual'
                                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                                }`}
                                        >
                                            Manual Mode
                                        </button>
                                    </div>

                                    {workflowMode === 'end-to-end' && (
                                        <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                                <span>⚙️</span> Configuration
                                            </h3>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                {/* Transcription Model */}
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        Transcription Model
                                                    </label>
                                                    <select
                                                        value={transcriptionModel}
                                                        onChange={(e) => setTranscriptionModel(e.target.value)}
                                                        className="h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                    >
                                                        <option value="custom-colab-whisper">faster-whisper-large-v2 (Colab)</option>
                                                        <option value="transcription-service">faster-whisper-large-v2 (Service)</option>
                                                        <option value="groq-whisper-large-v3">whisper-large-v3 (Groq)</option>
                                                        <option value="groq-whisper-large-v3-turbo">whisper-large-v3-turbo (Groq)</option>
                                                        <option value="openai-whisper">whisper-1 (OpenAI)</option>
                                                    </select>

                                                    {/* Colab/Service Extras */}
                                                    {transcriptionModel === 'custom-colab-whisper' && (
                                                        <div className="mt-2">
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={colabUrl}
                                                                    onChange={(e) => setColabUrl(e.target.value)}
                                                                    placeholder="Colab URL..."
                                                                    className="flex-1 h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                                                />
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleTestConnection(); }}
                                                                    disabled={isTestingConnection || !colabUrl}
                                                                    className="h-9 px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors"
                                                                >
                                                                    Test
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {transcriptionModel === 'transcription-service' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleTestConnection(); }}
                                                            disabled={isTestingConnection}
                                                            className="mt-2 h-9 w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors"
                                                        >
                                                            Check Service Status
                                                        </button>
                                                    )}
                                                </div>

                                                {/* LLM Model */}
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        NLP Model (Gemini)
                                                    </label>
                                                    <select
                                                        value={llmModel}
                                                        onChange={(e) => setLlmModel(e.target.value)}
                                                        className="h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                    >
                                                        {geminiModels.map((m) => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <button
                                                onClick={runEndToEndWorkflow}
                                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-3"
                                            >
                                                <span className="text-xl">✨</span>
                                                <span className="text-lg">
                                                    {(() => {
                                                        // Check if at least Step 1-A is completed (audio downloaded)
                                                        const hasAnyProgress = jobProgress && (
                                                            jobProgress.external_has_audio ||
                                                            jobProgress.local_has_audio ||
                                                            stepsStatus[0] === 'completed' ||
                                                            stepsStatus[1] === 'completed' ||
                                                            stepsStatus[2] === 'completed' ||
                                                            stepsStatus[3] === 'completed'
                                                        );

                                                        return hasAnyProgress
                                                            ? t('dashboard.steps.actions.runAllRemainingSteps')
                                                            : t('dashboard.steps.actions.runAllSteps');
                                                    })()}
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            }
                        >
                            {/* Content is now handled by renderStepExtras or default UI */}
                        </ProcessingSteps>
                    </div>
                </div>
            </div>
            <StyleChangeDialog
                open={styleChangeDialog.open}
                onOpenChange={(open) => setStyleChangeDialog({ ...styleChangeDialog, open })}
                onConfirm={() => handleStyleChange(styleChangeDialog.newStyle)}
            />
        </>
    );
}
