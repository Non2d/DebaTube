
import { useState, useEffect } from 'react';
import { SpeechFormat } from '../../../constants/constants';
import { logGraphNodeClick } from '../../../utils/userLogger';
import { localToGlobalTime, buildSpeechSegments } from '../components/speechTimeline';
import { GraphData } from './useDebateGraph';
import { RecordingData } from './useRecordings';

interface UseGraphNodeNavigationProps {
    autoLoadedGraphData: GraphData | null;
    debateSpeeches: SpeechFormat[];
    speechRecordings: { [key: number]: RecordingData[] };
    setCurrentPlayingSpeech: (index: number | null) => void;
    setIsPlaying: (isPlaying: boolean) => void;
}

export function useGraphNodeNavigation({
    autoLoadedGraphData,
    debateSpeeches,
    speechRecordings,
    setCurrentPlayingSpeech,
    setIsPlaying
}: UseGraphNodeNavigationProps) {
    const [seekTargetTime, setSeekTargetTime] = useState<number | null>(null);
    const [unifiedSeekTime, setUnifiedSeekTime] = useState<number | undefined>(undefined);

    // Reset seekTargetTime after use
    useEffect(() => {
        if (seekTargetTime !== null) {
            const timer = setTimeout(() => {
                setSeekTargetTime(null);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [seekTargetTime]);

    // Reset unifiedSeekTime after use
    useEffect(() => {
        if (unifiedSeekTime !== undefined) {
            const timer = setTimeout(() => {
                setUnifiedSeekTime(undefined);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [unifiedSeekTime]);

    const handleGraphNodeClick = (nodeId: number) => {
        if (!autoLoadedGraphData) return;

        logGraphNodeClick(nodeId);

        try {
            let speechKey: string | null = null;
            let foundStartTime: number | null = null;

            for (const key of Object.keys(autoLoadedGraphData.speeches)) {
                const segments = autoLoadedGraphData.speeches[key] || [];
                const foundSegment = segments.find((segment: any) => segment.id === nodeId);

                if (foundSegment) {
                    speechKey = key;
                    foundStartTime = foundSegment.start || 0;
                    break;
                }
            }

            if (!speechKey || foundStartTime === null) {
                console.warn(`[handleGraphNodeClick] Node ID not found in graph data: ${nodeId}`);
                return;
            }

            let speechIndex = debateSpeeches.findIndex(
                (speech: SpeechFormat) => speech.name.toLowerCase().replace(/ /g, '_') === speechKey!.toLowerCase()
            );

            if (speechIndex === -1) {
                console.warn(`[handleGraphNodeClick] Speech index not found for: ${speechKey}`);
                return;
            }

            // 実際の開始時刻を使用
            // 対応するスピーチを再生状態にする
            setCurrentPlayingSpeech(speechIndex);
            setIsPlaying(true);
            // シークバーがこの時間にジャンプするようにする
            setSeekTargetTime(foundStartTime);

            console.log(`[handleGraphNodeClick] Triggering time jump for ${speechKey} (index: ${speechIndex}) at ${foundStartTime}s`);
        } catch (error) {
            console.error('[handleGraphNodeClick] Error:', error);
        }
    };

    const handleGraphNodeClickUnified = (nodeId: number) => {
        if (!autoLoadedGraphData) return;

        logGraphNodeClick(nodeId);

        try {
            let speechKey: string | null = null;
            let foundStartTime: number | null = null;

            for (const key of Object.keys(autoLoadedGraphData.speeches)) {
                const segments = autoLoadedGraphData.speeches[key] || [];
                const foundSegment = segments.find((segment: any) => segment.id === nodeId);

                if (foundSegment) {
                    speechKey = key;
                    foundStartTime = foundSegment.start || 0;
                    break;
                }
            }

            if (!speechKey || foundStartTime === null) {
                console.warn(`[handleGraphNodeClickUnified] Node ID not found: ${nodeId}`);
                return;
            }

            let speechIndex = debateSpeeches.findIndex(
                (speech: SpeechFormat) => speech.name.toLowerCase().replace(/ /g, '_') === speechKey!.toLowerCase()
            );

            if (speechIndex === -1) {
                console.warn(`[handleGraphNodeClickUnified] Speech index not found for: ${speechKey}`);
                return;
            }

            // 累積時間を計算: 該当スピーチより前のすべてのスピーチのdurationを合計
            const segments = buildSpeechSegments(speechRecordings, debateSpeeches.length);
            const globalTime = localToGlobalTime(speechIndex, foundStartTime, segments);

            // Unified Audio Playerにシーク
            setUnifiedSeekTime(globalTime);

            console.log(`[handleGraphNodeClickUnified] Speech ${speechIndex} at local ${foundStartTime}s -> global ${globalTime}s`);
        } catch (error) {
            console.error('[handleGraphNodeClickUnified] Error:', error);
        }
    };

    return {
        seekTargetTime,
        unifiedSeekTime,
        handleGraphNodeClick,
        handleGraphNodeClickUnified
    };
}
