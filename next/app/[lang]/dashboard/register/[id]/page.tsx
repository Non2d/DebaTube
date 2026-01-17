"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Header from '../../../../../components/shared/Header';
import { getAPIRoot } from '../../../../../components/lib/utils';
import { useTranslation } from '../../../../../context/LanguageContext';

import ProcessingSteps, { ProcessingStepStatus } from '../../../../../components/shared/ProcessingSteps';
import { testColabConnection } from './actions';
import { useStepActions } from '../../../../../hooks/useStepActions';



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
    const [downloadProgress, setDownloadProgress] = useState(0);
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
            const res = await fetch(getAPIRoot() + `/job-progress/${roundId}`);
            if (res.ok) {
                const progress = await res.json();
                setJobProgress(progress); // Store progress data

                // Map job-progress to stepsStatus (Merged Step 1 & 2)
                const newStatus: ProcessingStepStatus[] = [...stepsStatusRef.current];

                // Step 1: Transcript Generation (Audio + Transcript + Sentences)
                const audioComplete = progress.external_has_audio || progress.local_has_audio;
                const transcriptionComplete = progress.has_all_raw_speech_transcription || progress.has_raw_round_transcription;
                const isStep1Complete = audioComplete && transcriptionComplete && progress.words_registered && progress.sentences_registered;
                if (isStep1Complete) {
                    newStatus[0] = 'completed';
                } else if (newStatus[0] !== 'processing' && newStatus[0] !== 'error') {
                    // Only set to pending if not currently processing or in error state
                    newStatus[0] = 'pending';
                }

                // Step 2: Diarization (Speaker Separation)
                if (progress.speeches_complete) {
                    newStatus[1] = 'completed';
                } else if (newStatus[0] === 'completed' && newStatus[1] !== 'processing' && newStatus[1] !== 'error') {
                    newStatus[1] = 'pending';
                } else if (newStatus[0] !== 'completed' && newStatus[1] !== 'processing') {
                    newStatus[1] = 'disabled';
                }

                // Step 3: ADU (was Step 4)
                if (progress.adus_complete) {
                    newStatus[2] = 'completed';
                } else if (newStatus[1] === 'completed' && newStatus[2] !== 'processing' && newStatus[2] !== 'error') {
                    newStatus[2] = 'pending';
                } else if (newStatus[1] !== 'completed' && newStatus[2] !== 'processing') {
                    newStatus[2] = 'disabled';
                }

                // Step 4: Rebuttal (was Step 5)
                if (progress.rebuttals_complete) {
                    newStatus[3] = 'completed';
                } else if (newStatus[2] === 'completed' && newStatus[3] !== 'processing' && newStatus[3] !== 'error') {
                    newStatus[3] = 'pending';
                } else if (newStatus[2] !== 'completed' && newStatus[3] !== 'processing') {
                    newStatus[3] = 'disabled';
                }

                setStepsStatus(newStatus);

                // Update active step
                if (newStatus[0] === 'pending' || newStatus[0] === 'processing') setCurrentStep(1);
                else if (newStatus[1] === 'pending' || newStatus[1] === 'processing') setCurrentStep(2);
                else if (newStatus[2] === 'pending' || newStatus[2] === 'processing') setCurrentStep(3);
                else if (newStatus[3] === 'pending' || newStatus[3] === 'processing') setCurrentStep(4);
                else if (newStatus[3] === 'completed') setCurrentStep(4);
            }
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




    const handleStepAction = async (stepIndex: number, action: string = 'run', data?: any) => {
        if (action === 'reset') {
            const startStep = data?.startStep || "1-a";
            await resetProgress(startStep, fetchJobProgress);
            return;
        }

        if (stepIndex === 1) runStep1(roundData, setDownloadProgress, setStepsStatus, stepsStatus, fetchJobProgress);
        // Step 2, 3... can execute normally or via existing logic if implemented
        // Since original code only had Step 1 & 2 actions implemented here...
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

    const renderStepExtras = (stepId: number) => {
        if (stepId !== 1) return null; // Model selection moved to Step 1

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
                <div className="max-w-4xl mx-auto">
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
                                <span className="font-medium">{roundData.style || '-'}</span>
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
                            {roundData.motion && (
                                <div className="w-full">
                                    <span className="block text-gray-500 dark:text-gray-400 mb-1">Motion</span>
                                    <span className="font-medium">{roundData.motion}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 mb-8 min-h-[400px]">
                        <ProcessingSteps
                            currentStep={currentStep}
                            stepsStatus={stepsStatus}
                            onStepAction={handleStepAction}
                            downloadProgress={downloadProgress}
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
                                </div>
                            }
                        >
                            {workflowMode === 'end-to-end' && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                                    <div className="text-lg font-medium mb-2">Coming Soon</div>
                                    <div className="text-sm">LLM End-to-End workflow is under development.</div>
                                </div>
                            )}
                        </ProcessingSteps>
                    </div>
                </div>
            </div>
        </>
    );
}
