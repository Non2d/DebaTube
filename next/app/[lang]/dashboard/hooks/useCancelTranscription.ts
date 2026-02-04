'use client';

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { getAPIRoot, mapBackgroundStatus, type BackgroundStepStatus } from '../../../../components/lib/utils';

export function useCancelTranscription() {
    const cancelTranscription = useCallback(async (
        videoId: string
    ): Promise<{ success: boolean; message: string }> => {
        if (!videoId) {
            return { success: false, message: 'Video ID is required' };
        }

        try {
            // Cancel via background transcription API
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
        } catch (error: any) {
            console.error('Cancel transcription error:', error);
            return { success: false, message: `Network error: ${error.message}` };
        }
    }, []);

    return { cancelTranscription };
}
