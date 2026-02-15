import toast from 'react-hot-toast';
import { getAPIRoot } from '../components/lib/utils';
import { ProcessingStepStatus } from '../components/shared/ProcessingSteps';

interface UseStepActionsProps {
    roundId: string | number;
    t: (key: string) => string;
    is_background?: boolean;
    showRoundIdInToast?: boolean;
    setCurrentJobCancellationTarget?: (target: 'external-bg-task' | 'sync-task' | null) => void;
}

export const useStepActions = ({ roundId, t, is_background = true, showRoundIdInToast = false }: UseStepActionsProps) => {

    const getProgress = async (targetRoundId?: string | number) => {
        const effectiveRoundId = targetRoundId ?? roundId;
        try {
            const res = await fetch(getAPIRoot() + `/job-progress-background/${effectiveRoundId}`);
            if (res.ok) return await res.json();
        } catch (e) { console.error(e); }
        return null;
    };

    // Reset Progress Action
    const resetProgress = async (startStep: string = "1-a", onSuccess?: () => Promise<void>, targetRoundId?: string | number) => {
        const effectiveRoundId = targetRoundId ?? roundId;
        const toastPrefix = showRoundIdInToast ? `[Round ${effectiveRoundId}] ` : '';

        const resetPromise = async () => {
            const res = await fetch(getAPIRoot() + `/reset-progress/${effectiveRoundId}?start_step=${startStep}`, {
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
                loading: toastPrefix + t('dashboard.steps.messages.resetProgress').replace('{startStep}', startStep),
                success: toastPrefix + t('dashboard.steps.messages.resetSuccess'),
                error: (err) => toastPrefix + t('dashboard.steps.messages.resetError').replace('{message}', err.message)
            },
            { id: 'reset-progress' }
        );
    };

    // Run Step 1 (Transcription) with skip logic
    const runStep1 = async (
        roundData: any,
        setStepsStatus: (s: ProcessingStepStatus[]) => void,
        stepsStatus: ProcessingStepStatus[],
        onRefresh: () => Promise<void>,
        videoUrl?: string, // Optional override for missing video_id recovery
        setCurrentProcessingStep?: (step: string | null) => void, // For Step 1-C/1-D progress tracking
        setCancellationTarget?: (target: 'external-bg-task' | 'sync-task' | null) => void, // For cancel logic
        keepCancellationTarget?: boolean // If true, don't reset cancellation target after completion (for auto-continue to Step 2-4)
    ) => {
        const toastPrefix = showRoundIdInToast ? `[Round ${roundData.id}] ` : '';

        // Extract video ID from URL if provided
        const extractedId = videoUrl ? (videoUrl.match(/(?:v=|youtu\.be\/)([^&]+)/)?.[1] || null) : null;

        if (!roundData?.video_id && !extractedId) {
            toast.error(t('dashboard.steps.messages.noVideoId') || "Error: No video_id found in round data");
            console.error("runStep1 aborted: missing video_id", roundData);
            return;
        }

        const effectiveVideoId = roundData?.video_id || extractedId;
        const targetUrl = videoUrl || `https://www.youtube.com/watch?v=${effectiveVideoId}`;

        const newStatus = [...stepsStatus];
        newStatus[0] = 'processing';
        setStepsStatus(newStatus);

        // Step 1 processing is now tracked by currentJobCancellationTarget

        try {
            let progress = await getProgress(roundData.id);

            // Step 1-A: Download Audio (Background)
            const audioDone = progress?.step_1a === 'DONE';
            const transDone = progress?.step_1b === 'DONE';

            // If Step 1-B is already done, skip Step 1-A regardless of cache status
            // (Step 1-A cache may be deleted but Step 1-B result is available)
            if (!audioDone && !transDone) {
                // Set cancellation target to external background task before running 1-A
                if (setCancellationTarget) setCancellationTarget('external-bg-task');

                const res = await fetch(getAPIRoot() + `/download-audio/${roundData.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: targetUrl }),
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || t('dashboard.steps.messages.audioDownloadFailed') || 'Audio download failed');
                }

                const data = await res.json();
                // Background download registered
                toast.success(toastPrefix + (t('dashboard.steps.messages.backgroundAudioDownloadRegistered') || 'Step 1-A: Background audio download registered. Waiting for completion...'), { id: 'step1a' });

                // Set step 1 to processing to maintain polling
                const newStatus = [...stepsStatus];
                newStatus[0] = 'processing';
                setStepsStatus(newStatus);

                await onRefresh();
                return; // Exit - page-level polling will handle completion
            }

            // Step 1-B: Transcription

            // Check if transcription result needs to be retrieved
            // (step_1b is DONE but words not yet registered, meaning result not retrieved yet)
            const needsResultRetrieval = transDone && progress?.step_1c !== 'DONE';

            if (needsResultRetrieval) {
                // Transcription is done externally, but result not yet retrieved and saved to DB
                toast.loading(toastPrefix + (t('dashboard.steps.messages.retrievingResult') || 'Step 1-B: Retrieving result...'), { id: 'step1b-result' });

                const resultRes = await fetch(getAPIRoot() + `/transcription-result?round_id=${roundData.id}`);
                if (!resultRes.ok) {
                    const err = await resultRes.json();
                    throw new Error(err.detail || t('dashboard.steps.messages.failedGetTranscriptionResult') || 'Failed to get transcription result');
                }

                toast.success(toastPrefix + (t('dashboard.steps.messages.resultSavedToDb') || 'Step 1-B: Result saved to DB'), { id: 'step1b-result' });
                // 1-B completed, switch to sync-task for 1-C/1-D
                if (setCancellationTarget) setCancellationTarget('sync-task');
                await onRefresh();
                progress = await getProgress(roundData.id);
            } else if (!transDone) {
                // Transcription not done yet

                if (is_background) {
                    // Background transcription
                    toast.loading(toastPrefix + (t('dashboard.steps.messages.checkingTranscriptionStatus') || 'Step 1-B: Checking transcription status...'), { id: 'step1b' });

                    // Check current status first
                    const statusRes = await fetch(getAPIRoot() + `/transcription-status?round_id=${roundData.id}`);
                    let status = 'NOT_IN_QUEUE';

                    if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        status = statusData.status;
                    }

                    // If not done, start background transcription
                    if (status !== 'DONE' && status !== 'COMPLETED') {
                        // Set cancellation target to external background task before running 1-B
                        if (setCancellationTarget) setCancellationTarget('external-bg-task');
                        const startRes = await fetch(getAPIRoot() + `/start-background-transcription`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                round_id: roundData.id,
                                url: targetUrl,
                                num_chunks: 4,
                                max_workers: 2,
                                is_forced: true //TODO:将来的にはここをfalseにして，文字起こしが既に存在したらそれを使ってこのSTEPをスキップできるようにしたい
                            }),
                        });

                        if (!startRes.ok) {
                            const err = await startRes.json();
                            if (startRes.status === 409) {
                                console.warn("Existing transcription job found.");
                            } else {
                                throw new Error(err.detail || t('dashboard.steps.messages.backgroundTranscriptionStartFailed') || 'Background transcription start failed');
                            }
                        }

                        toast.success(toastPrefix + (t('dashboard.steps.messages.backgroundTranscriptionInProgress') || 'Step 1-B: Background transcription in progress. Please wait for completion.'), { id: 'step1b', duration: 3000 });
                        await onRefresh();
                        return; // Exit - page-level polling will handle completion
                    }

                    // Status is DONE but step_1b not yet updated by polling - should not happen
                    // This case is now handled by needsResultRetrieval above
                } else {
                    // Synchronous transcription (existing behavior)
                    // NOTE: setCancellationTargetまわり間違ってそうなので注意
                    // Set cancellation target to external background task before running 1-B
                    if (setCancellationTarget) setCancellationTarget('external-bg-task');
                    toast.loading(toastPrefix + (t('dashboard.steps.messages.transcribing') || 'Step 1-B: Transcribing...'), { id: 'step1b' });

                    const res = await fetch(getAPIRoot() + `/transcribe-audio/${roundData.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                    });

                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.detail || t('dashboard.steps.messages.transcriptionFailed') || 'Transcription failed');
                    }
                    toast.success(toastPrefix + (t('dashboard.steps.messages.transcriptionCompleted') || 'Step 1-B: Completed'), { id: 'step1b' });
                    // 1-B completed, switch to sync-task for 1-C/1-D
                    if (setCancellationTarget) setCancellationTarget('sync-task');
                    await onRefresh();
                    progress = await getProgress(roundData.id);
                }
            }

            // Step 1-C: Words
            if (progress?.step_1c !== 'DONE') {
                // Set cancellation target to sync-task before running 1-C
                if (setCancellationTarget) setCancellationTarget('sync-task');
                if (setCurrentProcessingStep) setCurrentProcessingStep('1-c');
                toast.loading(toastPrefix + (t('dashboard.steps.messages.extractingWords') || 'Step 1-C: Extracting words...'), { id: 'step1c' });

                const res = await fetch(getAPIRoot() + `/extract-words-from-transcript/${roundData.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (!res.ok) {
                    const err = await res.json();
                    if (setCurrentProcessingStep) setCurrentProcessingStep(null);
                    throw new Error(err.detail || t('dashboard.steps.messages.wordExtractionFailed') || 'Word extraction failed');
                }
                toast.success(toastPrefix + (t('dashboard.steps.messages.wordExtractionCompleted') || 'Step 1-C: Completed'), { id: 'step1c' });
                await onRefresh();
                progress = await getProgress(roundData.id);

                if (progress?.step_1d === 'DONE') {
                    // 1-D already done, keep processing step if needed
                } else {
                    if (setCurrentProcessingStep) setCurrentProcessingStep('1-d');

                    toast.loading(toastPrefix + (t('dashboard.steps.messages.groupingSentences') || 'Step 1-D: Grouping sentences...'), { id: 'step1d' });

                    const res1d = await fetch(getAPIRoot() + `/group-sentences-from-words/${roundData.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                    });

                    if (!res1d.ok) {
                        const err = await res1d.json();
                        throw new Error(err.detail || t('dashboard.steps.messages.sentenceGroupingFailed') || 'Sentence generation failed');
                    }
                    const data = await res1d.json();
                    toast.success(toastPrefix + ((t('dashboard.steps.messages.sentenceGroupingCompleted') || `Step 1-D: ${data.total_sentences} sentences`).replace('${count}', data.total_sentences)), { id: 'step1d' });
                    if (!keepCancellationTarget && setCurrentProcessingStep) setCurrentProcessingStep(null);
                    await onRefresh();
                }
            } else if (progress?.step_1c !== 'DONE') {
                if (setCurrentProcessingStep) setCurrentProcessingStep('1-d');
                toast.loading(toastPrefix + (t('dashboard.steps.messages.groupingSentences') || 'Step 1-D: Grouping sentences...'), { id: 'step1d' });

                const res = await fetch(getAPIRoot() + `/group-sentences-from-words/${roundData.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || t('dashboard.steps.messages.sentenceGroupingFailed') || 'Sentence generation failed');
                }
                const data = await res.json();
                toast.success(toastPrefix + ((t('dashboard.steps.messages.sentenceGroupingCompleted') || `Step 1-D: ${data.total_sentences} sentences`).replace('${count}', data.total_sentences)), { id: 'step1d' });
                if (!keepCancellationTarget && setCurrentProcessingStep) setCurrentProcessingStep(null);
                await onRefresh();
            } else if (progress?.step_1d === 'DONE') {
            } else if (progress?.step_1d !== 'DONE') {
                if (setCurrentProcessingStep) setCurrentProcessingStep('1-d');
                toast.loading(toastPrefix + (t('dashboard.steps.messages.groupingSentences') || 'Step 1-D: Grouping sentences...'), { id: 'step1d' });

                const res = await fetch(getAPIRoot() + `/group-sentences-from-words/${roundData.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || t('dashboard.steps.messages.sentenceGroupingFailed') || 'Sentence generation failed');
                }
                const data = await res.json();
                toast.success(toastPrefix + ((t('dashboard.steps.messages.sentenceGroupingCompleted') || `Step 1-D: ${data.total_sentences} sentences`).replace('${count}', data.total_sentences)), { id: 'step1d' });
                if (!keepCancellationTarget && setCurrentProcessingStep) setCurrentProcessingStep(null);
                await onRefresh();
            } else if (progress?.step_1d === 'DONE') {
                toast.success(toastPrefix + (t('dashboard.steps.messages.step1Complete') || 'Step 1 All Complete!'));
            }

            if (!keepCancellationTarget && setCancellationTarget) {
                setCancellationTarget(null);
            }

        } catch (error: any) {
            console.error(error);
            toast.dismiss('step1a');
            toast.dismiss('step1b');
            toast.dismiss('step1c');
            toast.dismiss('step1d');

            if (setCancellationTarget) setCancellationTarget(null);

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
