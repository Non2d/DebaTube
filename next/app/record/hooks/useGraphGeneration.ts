
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../../context/LanguageContext';
import { SpeechFormat } from '../../../constants/constants';
import toast from 'react-hot-toast';

interface UseGraphGenerationProps {
    roundName: string;
    debateFormat: string;
    motion: string;
    speechRecordings: { [key: number]: { blob: Blob; duration: number; timestamp: string }[] };
    debateSpeeches: SpeechFormat[];
    areAllAudioFilesReady: boolean;
    callLlmAllAtOnce: boolean;
    useLatestTranscription: boolean;
    aduModel: string;
    rebuttalModel: string;
    transcriptionModel: string;
    manualMode: boolean; // Added
    resumeTryCount?: number | null;
    setResumeTryCount?: (count: number | null) => void;
    onSuccess: (result: any) => void;
}

export function useGraphGeneration({
    roundName,
    debateFormat,
    motion,
    speechRecordings,
    debateSpeeches,
    areAllAudioFilesReady,
    callLlmAllAtOnce,
    useLatestTranscription,
    aduModel,
    rebuttalModel,
    transcriptionModel,
    manualMode,
    resumeTryCount,
    setResumeTryCount,
    onSuccess
}: UseGraphGenerationProps) {
    const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);
    const [generationElapsedTime, setGenerationElapsedTime] = useState<number>(0);
    const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);

    // Manual Mode State
    const [manualState, setManualState] = useState<{
        step: 'initial' | 'adu_prompt_ready' | 'rebuttal_prompt_ready' | 'completed';
        roundName: string;
        tryCount: number;
        aduPrompt: string;
        rebuttalPrompt: string;
        isProcessing: boolean;
    }>({
        step: 'initial',
        roundName: '',
        tryCount: 0,
        aduPrompt: '',
        rebuttalPrompt: '',
        isProcessing: false
    });

    const { t } = useTranslation();

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;

        if (isGeneratingGraph && generationStartTime !== null) {
            interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - generationStartTime) / 1000);
                setGenerationElapsedTime(elapsed);
            }, 100);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isGeneratingGraph, generationStartTime]);

    const resumeManualWorkflow = async (isAutoCheck = false): Promise<boolean> => {
        const targetTryCount = (resumeTryCount !== undefined && resumeTryCount !== null) ? resumeTryCount : manualState.tryCount;

        if (!roundName || targetTryCount === null || targetTryCount === undefined) return false;

        if (!isAutoCheck) {
            setIsGeneratingGraph(true);
            setGenerationError(null);
            setGenerationSuccess(null);
            setGenerationStartTime(Date.now());
            setGenerationElapsedTime(0);
        } else {
            setManualState(prev => ({ ...prev, isProcessing: true }));
        }

        try {
            console.log(`[resumeManualWorkflow] Resuming ${roundName} try ${targetTryCount} (Auto: ${isAutoCheck})`);

            const response = await fetch('http://localhost:8080/manual/resume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    round_name: roundName,
                    try_count: targetTryCount
                }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // 1. Validate Try Count (Always check, even in auto mode to support auto-revert)
                    const notFoundData = await response.json();
                    if (notFoundData.next_try_count !== undefined) {
                        const nextValid = notFoundData.next_try_count;
                        if (targetTryCount > nextValid) {
                            // Auto-Correction: Revert to max+1
                            toast.error(t('recordPage.messages.matchNotFoundReverting', { next: nextValid }), {
                                position: 'bottom-center',
                                duration: 5000,
                                style: {
                                    background: '#333',
                                    color: '#fff',
                                    fontSize: '16px',
                                    padding: '16px',
                                }
                            });

                            if (setResumeTryCount) {
                                // Use setTimeout to ensure state update propagates to UI (input field) correctly
                                setTimeout(() => {
                                    setResumeTryCount(nextValid);
                                }, 10);
                            }

                            setIsGeneratingGraph(false);
                            return true; // Handled (Reverted)
                        }
                    }

                    if (isAutoCheck) {
                        setManualState(prev => ({
                            ...prev,
                            step: 'initial',
                            isProcessing: false,
                            roundName: roundName,
                            tryCount: targetTryCount
                        }));
                        return true; // Handled (Reset UI)
                    }

                    // If !isAutoCheck (User Clicked Start), 404 means "Doesn't exist, Create New".
                    // We return false to indicate that the caller should proceed with initial generation.
                    return false; // Not handled, proceed to creation
                }
                const errorData = await response.json();
                throw new Error(errorData.detail || `Failed to resume workflow: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[resumeManualWorkflow] Success:', result);

            if (result.status === 'step1_done') {
                setManualState({
                    step: 'adu_prompt_ready',
                    roundName: result.round_name,
                    tryCount: result.try_count,
                    aduPrompt: result.prompt,
                    rebuttalPrompt: '',
                    isProcessing: false
                });
            } else if (result.status === 'step2_done') {
                setManualState({
                    step: 'rebuttal_prompt_ready',
                    roundName: result.round_name,
                    tryCount: result.try_count,
                    aduPrompt: '', // Not needed for step 3
                    rebuttalPrompt: result.prompt,
                    isProcessing: false
                });
            } else if (result.status === 'completed') {
                setManualState({
                    step: 'completed',
                    roundName: result.round_name,
                    tryCount: result.try_count,
                    aduPrompt: '',
                    rebuttalPrompt: '',
                    isProcessing: false
                });
                // Silenced success message as per user request (Manual Card is enough)
                // setGenerationSuccess(result.message || "Manual workflow already completed.");
                if (onSuccess) {
                    onSuccess(result);
                }
            }
            if (!isAutoCheck) setIsGeneratingGraph(false);
            return true; // Handled (Resumed)

        } catch (error) {
            console.error('[resumeManualWorkflow] Error:', error);
            if (!isAutoCheck) {
                setGenerationError(error instanceof Error ? error.message : 'Failed to resume workflow');
                setIsGeneratingGraph(false);
            } else {
                // If auto check fails, just stop processing indicator
                setManualState(prev => ({ ...prev, isProcessing: false }));
            }
            return true; // Handled (Error displayed)
        }
    };

    // Auto-resume logic
    useEffect(() => {
        if (!manualMode || !roundName || resumeTryCount === null || resumeTryCount === undefined) {
            return;
        }

        const timer = setTimeout(() => {
            resumeManualWorkflow(true);
        }, 800); // 800ms debounce

        return () => clearTimeout(timer);
    }, [manualMode, roundName, resumeTryCount]);

    const generateDebateGraph = async () => {
        if (!roundName) {
            setGenerationError(t('recordPage.messages.enterRoundId'));
            return;
        }

        // Resume Manual Workflow Logic
        if (manualMode && resumeTryCount !== null && resumeTryCount !== undefined) {
            const handled = await resumeManualWorkflow(false);
            if (handled) return;
        }

        if (!areAllAudioFilesReady) {
            setGenerationError(t('recordPage.messages.allAudioRequired'));
            return;
        }

        const confirmed = window.confirm(
            t('recordPage.messages.confirmGenerate')
        );

        if (!confirmed) {
            return;
        }

        setIsGeneratingGraph(true);
        setGenerationError(null);
        setGenerationSuccess(null);
        setGenerationStartTime(Date.now());
        setGenerationElapsedTime(0);

        try {
            const formData = new FormData();
            formData.append('round_name', roundName);
            formData.append('debate_format', debateFormat);
            if (motion) {
                formData.append('motion', motion);
            }
            formData.append('call_llm_all_at_once', callLlmAllAtOnce.toString());
            formData.append('use_latest_transcription', useLatestTranscription.toString());
            formData.append('adu_model', aduModel);
            formData.append('rebuttal_model', rebuttalModel);
            formData.append('transcription_model', transcriptionModel);
            formData.append('manual_mode', manualMode.toString());

            const speechMetadata: { filename: string; position: string }[] = [];
            let totalFiles = 0;
            for (let i = 0; i < debateSpeeches.length; i++) {
                const recordings = speechRecordings[i];
                if (recordings && recordings.length > 0) {
                    for (let j = 0; j < recordings.length; j++) {
                        const blob = recordings[j].blob;
                        const date = new Date(recordings[j].timestamp);
                        const dateStr = date.toISOString().split('T')[0];
                        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
                        const timestamp = `${dateStr}_${timeStr}`;
                        const suffix = recordings.length > 1 ? `_${j}` : '';
                        const position = debateSpeeches[i].name;
                        // Use a simple sanitized filename for the file map
                        const filename = `${position.replace(/ /g, '_')}-${timestamp}${suffix}.webm`;

                        formData.append('files', blob, filename);
                        speechMetadata.push({ filename, position });
                        totalFiles++;
                    }
                }
            }
            // Send explicit metadata to avoid relying on filename parsing
            formData.append('speech_metadata', JSON.stringify(speechMetadata));

            console.log(`[generateDebateGraph] Uploading ${totalFiles} audio files... ManualMode=${manualMode}`);

            const response = await fetch('http://localhost:8080/audio-to-debate-graph-batch', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Failed to generate debate graph: ${response.statusText} `);
            }

            const result = await response.json();
            console.log('[generateDebateGraph] Success:', result);

            if (result.status === 'manual_adu_prompt') {
                setManualState({
                    step: 'adu_prompt_ready',
                    roundName: result.round_name,
                    tryCount: result.try_count,
                    aduPrompt: result.prompt,
                    rebuttalPrompt: '',
                    isProcessing: false
                });
                setIsGeneratingGraph(false);
                return;
            }

            // Normal Success Flow
            if (result.round_name) {
                console.log(`[generateDebateGraph] Round name: ${result.round_name} `);
            }

            setGenerationSuccess(
                t('recordPage.status.success', { seconds: result.processing_time_seconds }) + '\n' +
                t('recordPage.status.transcribed', { files: result.summary.files_transcribed }) + '\n' +
                t('recordPage.status.adus', { total: result.summary.total_adus }) + '\n' +
                t('recordPage.status.rebuttalPairs', { total: result.summary.total_rebuttal_pairs }) + '\n' +
                `Round: ${result.round_name || roundName} `
            );

            if (onSuccess) {
                onSuccess(result);
            }
        } catch (error) {
            console.error('[generateDebateGraph] Error:', error);
            setGenerationError(
                error instanceof Error ? error.message : 'Failed to generate graph'
            );
        } finally {
            if (!manualMode) {
                setIsGeneratingGraph(false);
            }
            // If manual mode, we might want to keep Spinner OFF but dialog ON.
            // Logic handled above.
        }
    };







    return {
        isGeneratingGraph,
        generationError,
        generationSuccess,
        generationElapsedTime,
        generateDebateGraph,
        manualState,
        setManualState,
        resumeManualWorkflow,
        submitManualAdu: async (jsonResult: string) => {
            try {
                setManualState(prev => ({ ...prev, isProcessing: true }));
                const { roundName, tryCount } = manualState;

                await fetch('http://localhost:8080/manual/submit-adu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ round_name: roundName, try_count: tryCount, adu_json: jsonResult })
                }).then(res => { if (!res.ok) throw new Error("Failed to submit ADU results") });

                const promptRes = await fetch(`http://localhost:8080/manual/rebuttal-prompt/${roundName}?try_count=${tryCount}`);
                if (!promptRes.ok) throw new Error("Failed to fetch rebuttal prompt");
                const promptData = await promptRes.json();

                setManualState(prev => ({
                    ...prev,
                    step: 'rebuttal_prompt_ready',
                    rebuttalPrompt: promptData.prompt,
                    isProcessing: false
                }));

            } catch (error: any) {
                console.error("Manual ADU Error", error);
                setGenerationError(error.message);
                setManualState(prev => ({ ...prev, isProcessing: false }));
            }
        },
        submitManualRebuttal: async (jsonResult: string) => {
            try {
                setManualState(prev => ({ ...prev, isProcessing: true }));
                const { roundName, tryCount } = manualState;

                const res = await fetch('http://localhost:8080/manual/submit-rebuttal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ round_name: roundName, try_count: tryCount, rebuttal_json: jsonResult })
                });
                if (!res.ok) throw new Error("Failed to submit rebuttal results");
                const finalResult = await res.json();

                setManualState(prev => ({ ...prev, step: 'completed', isProcessing: false }));
                setGenerationSuccess("Manual Generation Completed Successfully!");

                if (onSuccess) {
                    onSuccess({ ...finalResult, try_count: tryCount });
                }

            } catch (error: any) {
                console.error("Manual Rebuttal Error", error);
                setGenerationError(error.message);
                setManualState(prev => ({ ...prev, isProcessing: false }));
            }
        }
    };
}
