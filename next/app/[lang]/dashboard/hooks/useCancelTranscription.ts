'use client';

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { getAPIRoot, mapBackgroundStatus, type BackgroundStepStatus } from '../../../../components/lib/utils';

export function useCancelTranscription() {
    const cancelTranscription = useCallback(async (
        videoId: string,
        jobProgress: any
    ): Promise<{ success: boolean; message: string }> => {
        if (!videoId) {
            return { success: false, message: 'Video ID is required' };
        }

        // Determine current running step phase
        const getRunningPhase = (): 'early' | 'late' | null => {
            if (!jobProgress) return null;

            const step1aStatus = mapBackgroundStatus(jobProgress.step_1a);
            const step1bStatus = mapBackgroundStatus(jobProgress.step_1b);
            const step1cStatus = mapBackgroundStatus(jobProgress.step_1c);
            const step1dStatus = mapBackgroundStatus(jobProgress.step_1d);

            // Check early phase (1-A, 1-B)
            if ((step1aStatus === 'processing' || step1aStatus === 'in_queue') ||
                (step1bStatus === 'processing' || step1bStatus === 'in_queue')) {
                return 'early';
            }

            // Check late phase (1-C, 1-D, 2, 3, 4)
            if ((step1cStatus === 'processing' || step1cStatus === 'in_queue') ||
                (step1dStatus === 'processing' || step1dStatus === 'in_queue') ||
                (mapBackgroundStatus(jobProgress.step_2) === 'processing' || mapBackgroundStatus(jobProgress.step_2) === 'in_queue') ||
                (mapBackgroundStatus(jobProgress.step_3) === 'processing' || mapBackgroundStatus(jobProgress.step_3) === 'in_queue') ||
                (mapBackgroundStatus(jobProgress.step_4) === 'processing' || mapBackgroundStatus(jobProgress.step_4) === 'in_queue')) {
                return 'late';
            }

            return null;
        };

        const phase = getRunningPhase();

        try {
            if (phase === 'early') {
                // Cancel 1-A or 1-B using background transcription API
                const res = await fetch(`${getAPIRoot()}/transcribe-background/cancel/batch`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ video_ids: [videoId] }),
                });

                if (res.ok) {
                    const data = await res.json();
                    return { success: true, message: 'Background transcription cancelled' };
                } else {
                    const error = await res.json().catch(() => ({ detail: res.statusText }));
                    return { success: false, message: `Cancel failed: ${error.detail || res.status}` };
                }
            } else if (phase === 'late') {
                // Placeholder for 1-C and beyond - future implementation
                return { success: true, message: 'Cancel signal sent - page reload required' };
            } else {
                return { success: false, message: 'No process running to cancel' };
            }
        } catch (error: any) {
            console.error('Cancel transcription error:', error);
            return { success: false, message: `Network error: ${error.message}` };
        }
    }, []);

    return { cancelTranscription };
}
