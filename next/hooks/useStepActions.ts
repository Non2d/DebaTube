import toast from 'react-hot-toast';
import { getAPIRoot } from '../components/lib/utils';
import { ProcessingStepStatus } from '../components/shared/ProcessingSteps';

interface UseStepActionsProps {
    roundId: string | number;
    t: (key: string) => string;
}

export const useStepActions = ({ roundId, t }: UseStepActionsProps) => {

    const getProgress = async () => {
        try {
            const res = await fetch(getAPIRoot() + `/job-progress/${roundId}`);
            if (res.ok) return await res.json();
        } catch (e) { console.error(e); }
        return null;
    };

    // Reset Progress Action
    const resetProgress = async (startStep: string = "1-a", onSuccess?: () => Promise<void>) => {
        const resetPromise = async () => {
            const res = await fetch(getAPIRoot() + `/reset-progress/${roundId}?start_step=${startStep}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Reset failed');
            }

            if (onSuccess) await onSuccess();
            return await res.json();
        };

        return toast.promise(
            resetPromise(),
            {
                loading: t('dashboard.steps.messages.resetProgress').replace('{startStep}', startStep),
                success: t('dashboard.steps.messages.resetSuccess'),
                error: (err) => t('dashboard.steps.messages.resetError').replace('{message}', err.message)
            },
            { id: 'reset-progress' }
        );
    };

    // Run Step 1 (Transcription) with skip logic
    const runStep1 = async (
        roundData: any,
        setDownloadProgress: (p: number) => void,
        setStepsStatus: (s: ProcessingStepStatus[]) => void,
        stepsStatus: ProcessingStepStatus[],
        // Fix duplicate argument: stepsStatus was listed twice
        // stepsStatus: ProcessingStepStatus[],
        onRefresh: () => Promise<void>,
        videoUrl?: string, // Optional override for missing video_id recovery
        mode: 'background' | 'blocking' = 'background' // Default to background
    ) => {
        // Extract video ID from URL if provided
        const extractedId = videoUrl ? (videoUrl.match(/(?:v=|youtu\.be\/)([^&]+)/)?.[1] || null) : null;

        if (!roundData?.video_id && !extractedId) {
            toast.error("Error: No video_id found in round data");
            console.error("runStep1 aborted: missing video_id", roundData);
            return;
        }

        const effectiveVideoId = roundData?.video_id || extractedId;
        const targetUrl = videoUrl || `https://www.youtube.com/watch?v=${effectiveVideoId}`;

        const newStatus = [...stepsStatus];
        newStatus[0] = 'processing';
        setStepsStatus(newStatus);
        setDownloadProgress(0);

        try {
            let progress = await getProgress();

            // Step 1-A: Download Audio
            const audioDone = progress?.external_has_audio || progress?.local_has_audio;
            if (!audioDone) {
                setDownloadProgress(10);
                toast.loading('Step 1-A: Downloading audio...', { id: 'step1a' });

                const res = await fetch(getAPIRoot() + `/download-audio/${roundData.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: targetUrl }),
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || 'Audio download failed');
                }
                const data = await res.json();
                toast.success(`Step 1-A: Downloaded (${data.video_id})`, { id: 'step1a' });
                await onRefresh();
                progress = await getProgress();
            } else {
                setDownloadProgress(25);
                toast.success('Step 1-A: Already completed', { id: 'step1a', duration: 2000 });
            }

            // Step 1-B: Transcription (mode-dependent)
            const transDone = progress?.has_all_raw_speech_transcription || progress?.has_raw_round_transcription;
            if (!transDone) {
                setDownloadProgress(30);

                if (mode === 'background') {
                    // Background mode: Check if transcription is already running or completed
                    // If not started, start it. If completed, fetch the result.

                    // First, check if there's already a background task running
                    // We can infer this from the progress status
                    // For now, we'll just try to start the task

                    toast.loading('Step 1-B: Checking transcription status...', { id: 'step1b' });

                    const res = await fetch(getAPIRoot() + `/transcribe-background/${roundData.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                    });

                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.detail || 'Transcription start failed');
                    }

                    const data = await res.json();

                    // Check if Galleria API returned COMPLETED status
                    if (data.galleria_response?.status === 'COMPLETED') {
                        // Transcription is already complete, fetch the result
                        toast.loading('Step 1-B: Fetching completed transcription...', { id: 'step1b' });

                        const fetchRes = await fetch(getAPIRoot() + `/fetch-transcription-result/${roundData.id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                        });

                        if (!fetchRes.ok) {
                            const err = await fetchRes.json();
                            throw new Error(err.detail || 'Failed to fetch transcription result');
                        }

                        toast.success('Step 1-B: Transcription fetched from background task', { id: 'step1b' });
                        await onRefresh();
                        progress = await getProgress();
                        // Continue to Step 1-C
                    } else {
                        // Transcription started or still running
                        toast.success(`Step 1-B: Started (task_id: ${data.task_id || 'N/A'})`, { id: 'step1b' });

                        // Stop here - transcription is running in background
                        // User needs to wait for completion and run again for Step 1-C/1-D
                        setDownloadProgress(50);
                        toast('Transcription is running in background. Please wait and run again to continue.', {
                            duration: 5000,
                            icon: 'ℹ️'
                        });

                        await onRefresh();
                        return; // Stop execution here
                    }
                } else {
                    // Blocking mode: Wait for completion
                    toast.loading('Step 1-B: Transcribing...', { id: 'step1b' });

                    const res = await fetch(getAPIRoot() + `/transcribe-audio/${roundData.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                    });

                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.detail || 'Transcription failed');
                    }
                    toast.success('Step 1-B: Completed', { id: 'step1b' });
                    await onRefresh();
                    progress = await getProgress();
                }
            } else {
                setDownloadProgress(60);
                toast.success('Step 1-B: Already completed', { id: 'step1b', duration: 2000 });
            }

            // Step 1-C: Words
            if (!progress?.words_registered) {
                setDownloadProgress(70);
                toast.loading('Step 1-C: Extracting words...', { id: 'step1c' });

                const res = await fetch(getAPIRoot() + `/extract-words-from-transcript/${roundData.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || 'Word extraction failed');
                }
                toast.success('Step 1-C: Completed', { id: 'step1c' });
                await onRefresh();
                progress = await getProgress();
            } else {
                setDownloadProgress(80);
                toast.success('Step 1-C: Already completed', { id: 'step1c', duration: 2000 });
            }

            // Step 1-D: Group Sentences
            if (!progress?.sentences_registered) {
                setDownloadProgress(85);
                toast.loading('Step 1-D: Grouping sentences...', { id: 'step1d' });

                const res = await fetch(getAPIRoot() + `/group-sentences-from-words/${roundData.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || 'Sentence generation failed');
                }
                const data = await res.json();
                toast.success(`Step 1-D: ${data.total_sentences} sentences`, { id: 'step1d' });
                await onRefresh();
            } else {
                setDownloadProgress(100);
                toast.success('Step 1-D: Already completed', { id: 'step1d', duration: 2000 });
            }

            toast.success('Step 1 All Complete!');

        } catch (error: any) {
            console.error(error);
            // Dismiss all potential loading toasts
            toast.dismiss('step1a');
            toast.dismiss('step1b');
            toast.dismiss('step1c');
            toast.dismiss('step1d');

            const errStatus = [...stepsStatus];
            errStatus[0] = 'error';
            setStepsStatus(errStatus);
            toast.error(error.message);
        }
    };

    return {
        resetProgress,
        runStep1
    };
};
