
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../../context/LanguageContext';
import { SpeechFormat } from '../../../constants/constants';

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

    const generateDebateGraph = async () => {
        if (!roundName) {
            setGenerationError(t('recordPage.messages.enterRoundId'));
            return;
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





    const resumeManualWorkflow = async (count: number) => {
        if (!roundName) {
            setGenerationError(t('recordPage.messages.enterRoundId'));
            return;
        }

        // Reset state for resume attempt
        setManualState(prev => ({ ...prev, isProcessing: true, tryCount: count, roundName: roundName }));

        try {
            const baseUrl = 'http://localhost:8080';

            // 1. Try to fetch Rebuttal Prompt (implies ADU is done)
            const rebRes = await fetch(`${baseUrl}/manual/rebuttal-prompt/${roundName}?try_count=${count}`);
            if (rebRes.ok) {
                const data = await rebRes.json();
                setManualState(prev => ({
                    ...prev,
                    step: 'rebuttal_prompt_ready',
                    roundName: roundName,
                    tryCount: count,
                    rebuttalPrompt: data.prompt,
                    isProcessing: false
                }));
                return;
            }

            // 2. If Rebuttal fetch failed, assumption: ADU not done?
            // User might want to "Resume at ADU step".
            // But ADU step *generating* the prompt is the first step of "Start".
            // If they want to just see the prompt they already generated?
            // The backend doesn't store the ADU prompt unless we logged it, but we can regenerate it easily.
            // If they want to "Resume" a flow where they haven't submitted ADUs yet,
            // Then it is effectively "Start Manual Generation" with try_count=X.

            // So default behavior: Set step to 'initial' (or implied start) but pre-fill try count?
            // actually, if we set step to 'initial', the UI shows the "Start" button.
            // We want to skip the "Start" button?
            // No, if we can't find Rebuttal prompt, we can't skip to Rebuttal.

            // Let's assume valid resume = Rebuttal is valid.
            // If not found, tell user.

            setGenerationError(t('recordPage.manualMode.resumeFailed'));
            setManualState(prev => ({ ...prev, isProcessing: false, tryCount: count }));

        } catch (e) {
            console.error(e);
            setGenerationError("Failed to resume.");
            setManualState(prev => ({ ...prev, isProcessing: false }));
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
