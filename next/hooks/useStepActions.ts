import toast from 'react-hot-toast';
import { getAPIRoot } from '../components/lib/utils';

interface UseStepActionsProps {
    roundId: string | number;
    t: (key: string) => string;
}

export const useStepActions = ({ roundId, t }: UseStepActionsProps) => {

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

    return {
        resetProgress
    };
};
