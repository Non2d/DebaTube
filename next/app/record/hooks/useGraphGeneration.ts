
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
    onSuccess
}: UseGraphGenerationProps) {
    const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);
    const [generationElapsedTime, setGenerationElapsedTime] = useState<number>(0);
    const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);

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

            console.log(`[generateDebateGraph] Uploading ${totalFiles} audio files...`);

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
            setIsGeneratingGraph(false);
        }
    };

    return {
        isGeneratingGraph,
        generationError,
        generationSuccess,
        generationElapsedTime,
        generateDebateGraph
    };
}
