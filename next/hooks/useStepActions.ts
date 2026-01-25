import toast from 'react-hot-toast';
import { getAPIRoot } from '../components/lib/utils';
import { ProcessingStepStatus } from '../components/shared/ProcessingSteps';

interface UseStepActionsProps {
    roundId: string | number;
    t: (key: string) => string;
    is_background?: boolean;
}

export const useStepActions = ({ roundId, t, is_background = true }: UseStepActionsProps) => {

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
        videoUrl?: string // Optional override for missing video_id recovery
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
                // Silent skip - no toast needed
            }

            // Step 1-B: Transcription
            const transDone = progress?.has_all_raw_speech_transcription || progress?.has_raw_round_transcription;
            if (!transDone) {
                setDownloadProgress(30);

                if (is_background) {
                    // Background transcription
                    toast.loading('Step 1-B: Checking transcription status...', { id: 'step1b' });

                    // Check current status first
                    const statusRes = await fetch(getAPIRoot() + `/transcription-status?round_id=${roundData.id}`);
                    let status = 'NOT_IN_QUEUE';

                    if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        status = statusData.status;
                    }

                    // If not done, start background transcription
                    if (status !== 'DONE' && status !== 'COMPLETED') {
                        const startRes = await fetch(getAPIRoot() + `/start-background-transcription`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                round_id: roundData.id,
                                url: targetUrl,
                                num_chunks: 4,
                                max_workers: 2,
                                is_forced: false
                            }),
                        });

                        if (!startRes.ok) {
                            const err = await startRes.json();
                            if (startRes.status === 409) {
                                console.warn("Existing transcription job found.");
                            } else {
                                throw new Error(err.detail || 'Background transcription start failed');
                            }
                        }

                        toast.success('Step 1-B: Background transcription in progress. Please wait for completion.', { id: 'step1b', duration: 3000 });
                        setDownloadProgress(35);
                        await onRefresh();
                        return; // Exit - page-level polling will handle completion
                    }

                    // Status is DONE - retrieve result
                    toast.loading('Step 1-B: Retrieving result...', { id: 'step1b' });
                    const resultRes = await fetch(getAPIRoot() + `/transcription-result?round_id=${roundData.id}`);
                    if (!resultRes.ok) {
                        const err = await resultRes.json();
                        throw new Error(err.detail || 'Failed to get transcription result');
                    }

                    toast.success('Step 1-B: Completed', { id: 'step1b' });
                    setDownloadProgress(60);
                    await onRefresh();
                    progress = await getProgress();
                } else {
                    // Synchronous transcription (existing behavior)
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
                // Silent skip - no toast needed
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
                // Silent skip - no toast needed
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
                // Silent skip - no toast needed
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
