
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from '../../../../context/LanguageContext';
import toast from 'react-hot-toast';

export interface GraphData {
    speeches: { [key: string]: any[] };
    rebuttals: [number, number][];
}

export function useDebateGraph(roundName: string) {
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [autoLoadedGraphData, setAutoLoadedGraphData] = useState<GraphData | null>(null);
    const [tryCount, setTryCount] = useState<number | null>(null);
    const [internalTryCount, setInternalTryCount] = useState<number | null>(null);
    const { t } = useTranslation();

    // Validate and set tryCount with warning
    const handleSetTryCount = useCallback(async (newTryCount: number | null) => {
        if (newTryCount === null) {
            setInternalTryCount(null);
            setTryCount(null);
            return;
        }

        // Check if the version exists
        if (roundName) {
            try {
                const url = `http://localhost:8080/rebuttal-graph/${roundName}?try_count=${newTryCount}`;
                const response = await fetch(url);

                if (!response.ok) {
                    // Version doesn't exist, show warning
                    toast.error(t('recordPage.messages.matchNotFound', { count: newTryCount }), {
                        position: 'top-center',
                        duration: 4000,
                    });
                    return;
                }
            } catch (error) {
                console.error('Error validating version:', error);
            }
        }

        setInternalTryCount(newTryCount);
        setTryCount(newTryCount);
    }, [roundName, t]);

    // グラフデータを自動読み込み（サーバーから）
    const autoLoadGraphData = useCallback(async (roundNameToLoad: string, specificTryCount?: number) => {
        if (!roundNameToLoad) return;

        const targetTryCount = specificTryCount !== undefined ? specificTryCount : tryCount;

        try {
            console.log(`[autoLoadGraphData] Loading graph for round: ${roundNameToLoad} (try: ${targetTryCount})`);
            let url = `http://localhost:8080/rebuttal-graph/${roundNameToLoad}`;
            if (targetTryCount !== null && targetTryCount !== undefined) {
                url += `?try_count=${targetTryCount}`;
            }
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404 && targetTryCount !== undefined && targetTryCount !== null) {
                    toast.error(t('recordPage.messages.matchNotFound', { count: targetTryCount }), {
                        position: 'top-center',
                        duration: 4000,
                    });
                } else {
                    console.warn(`[autoLoadGraphData] Graph not found for round: ${roundNameToLoad}`);
                }
                setAutoLoadedGraphData(null);
                return;
            }

            const result = await response.json();
            if (result.status === 'success' && result.data) {
                setAutoLoadedGraphData(result.data);
                console.log(`[autoLoadGraphData] Graph loaded successfully for round: ${roundNameToLoad}`);
            }
        } catch (error) {
            console.error('[autoLoadGraphData] Error:', error);
            setAutoLoadedGraphData(null);
        }
    }, [tryCount]);

    useEffect(() => {
        if (roundName) {
            autoLoadGraphData(roundName);
        }
    }, [roundName, autoLoadGraphData]);

    const handleFileSelect = (file: File) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string) as GraphData;
                if (json.speeches && json.rebuttals && Array.isArray(json.rebuttals)) {
                    setGraphData(json);
                    setAutoLoadedGraphData(json);
                } else {
                    toast.error(t('recordPage.messages.invalidJson'), {
                        position: 'top-center',
                        duration: 4000,
                    });
                }
            } catch (error) {
                toast.error(t('recordPage.messages.failedJson', { error: error instanceof Error ? error.message : String(error) }), {
                    position: 'top-center',
                    duration: 4000,
                });
            }
        };
        reader.readAsText(file);
    };

    return {
        graphData,
        setGraphData,
        autoLoadedGraphData,
        setAutoLoadedGraphData,
        tryCount: internalTryCount,
        setTryCount: handleSetTryCount,
        autoLoadGraphData,
        handleFileSelect
    };
}
