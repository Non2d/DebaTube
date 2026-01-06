"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Header from '../../../../../components/shared/Header';
import { getAPIRoot } from '../../../../../components/lib/utils';
import { useTranslation } from '../../../../../context/LanguageContext';
import ProcessingSteps, { ProcessingStepStatus } from '../../../../../components/shared/ProcessingSteps';

export default function VideoDetailPage({ params }: { params: { lang: string, id: string } }) {
    const { t } = useTranslation();
    const router = useRouter();
    const roundId = params.id;

    const [loading, setLoading] = useState(true);
    const [roundData, setRoundData] = useState<any>(null);
    const [stepsStatus, setStepsStatus] = useState<ProcessingStepStatus[]>(['pending', 'disabled', 'disabled', 'disabled', 'disabled']);
    const [currentStep, setCurrentStep] = useState(1);
    const [downloadProgress, setDownloadProgress] = useState(0);

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

                // Map job-progress to stepsStatus
                const newStatus: ProcessingStepStatus[] = [...stepsStatus];

                // Step 1: Audio
                if (progress.audio_complete) newStatus[0] = 'completed';
                else if (newStatus[0] !== 'processing') newStatus[0] = 'pending';

                // Step 2: Transcription
                if (progress.transcription_complete) newStatus[1] = 'completed';
                else if (newStatus[0] === 'completed' && newStatus[1] !== 'processing') newStatus[1] = 'pending';
                else if (newStatus[0] !== 'completed') newStatus[1] = 'disabled';

                // Step 3: Diarization (Using sentences_complete as proxy)
                if (progress.sentences_complete) newStatus[2] = 'completed';
                else if (newStatus[1] === 'completed' && newStatus[2] !== 'processing') newStatus[2] = 'pending';
                else if (newStatus[1] !== 'completed') newStatus[2] = 'disabled';

                // Step 4: ADU
                if (progress.adus_complete) newStatus[3] = 'completed';
                else if (newStatus[2] === 'completed' && newStatus[3] !== 'processing') newStatus[3] = 'pending';
                else if (newStatus[2] !== 'completed') newStatus[3] = 'disabled';

                // Step 5: Rebuttal
                if (progress.rebuttals_complete) newStatus[4] = 'completed';
                else if (newStatus[3] === 'completed' && newStatus[4] !== 'processing') newStatus[4] = 'pending';
                else if (newStatus[3] !== 'completed') newStatus[4] = 'disabled';

                setStepsStatus(newStatus);

                // Update active step
                if (newStatus[0] === 'pending' || newStatus[0] === 'processing') setCurrentStep(1);
                else if (newStatus[1] === 'pending' || newStatus[1] === 'processing') setCurrentStep(2);
                else if (newStatus[2] === 'pending' || newStatus[2] === 'processing') setCurrentStep(3);
                else if (newStatus[3] === 'pending' || newStatus[3] === 'processing') setCurrentStep(4);
                else if (newStatus[4] === 'pending' || newStatus[4] === 'processing') setCurrentStep(5);
                else if (newStatus[4] === 'completed') setCurrentStep(5);
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

    const runAudioDownload = async () => {
        if (!roundData?.video_id) return;
        const newStatus = [...stepsStatus];
        newStatus[0] = 'processing';
        setStepsStatus(newStatus);
        setDownloadProgress(10);

        try {
            const progressInterval = setInterval(() => {
                setDownloadProgress(prev => Math.min(prev + 5, 90));
            }, 500);

            const res = await fetch(getAPIRoot() + '/download-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_id: roundData.video_id }),
            });

            clearInterval(progressInterval);
            if (!res.ok) throw new Error('Download failed');

            setDownloadProgress(100);
            fetchJobProgress(); // Refresh immediately
            toast.success('Audio downloaded/verified');
        } catch (error: any) {
            const errStatus = [...stepsStatus];
            errStatus[0] = 'error';
            setStepsStatus(errStatus);
            toast.error(error.message);
        }
    };

    const runTranscription = async () => {
        if (!roundData?.video_id) return;
        const newStatus = [...stepsStatus];
        newStatus[1] = 'processing';
        setStepsStatus(newStatus);

        try {
            const audioRes = await fetch(getAPIRoot() + `/audio/${roundData.video_id}`);
            if (!audioRes.ok) throw new Error('Failed to retrieve audio file. Please run Step 1 first.');

            const audioBlob = await audioRes.blob();
            const formData = new FormData();
            formData.append('files', audioBlob, `${roundData.video_id}.m4a`);
            formData.append('match_name', roundData.name || 'default');
            formData.append('transcription_model', 'openai-whisper');

            const transRes = await fetch(getAPIRoot() + '/audio-to-transcript-batch', {
                method: 'POST',
                body: formData,
            });

            if (!transRes.ok) {
                const err = await transRes.json();
                throw new Error(err.detail || 'Transcription failed');
            }

            fetchJobProgress();
            toast.success('Transcription completed');
        } catch (error: any) {
            const errStatus = [...stepsStatus];
            errStatus[1] = 'error';
            setStepsStatus(errStatus);
            toast.error(error.message);
        }
    };

    const handleStepAction = (stepIndex: number) => {
        if (stepIndex === 1) runAudioDownload();
        else if (stepIndex === 2) runTranscription();
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
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 pt-24 pb-12 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <Link
                            href={`/${params.lang}/dashboard`}
                            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t('dashboard.modal.labels.back') || 'Back to Dashboard'}
                        </Link>

                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                                {roundData.name}
                            </h1>

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
                                            Watch Video <ExternalLink size={14} />
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
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
                        <ProcessingSteps
                            currentStep={currentStep}
                            stepsStatus={stepsStatus}
                            onStepAction={handleStepAction}
                            downloadProgress={downloadProgress}
                            isRegistrationComplete={true}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
