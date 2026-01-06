
import { Check } from 'lucide-react';
import { useTranslation } from '../../../../context/LanguageContext';

interface GenerationStatusProps {
    isGeneratingGraph: boolean;
    generationError: string | null;
    generationSuccess: string | null;
    generationElapsedTime: number;
}

export default function GenerationStatus({
    isGeneratingGraph,
    generationError,
    generationSuccess,
    generationElapsedTime
}: GenerationStatusProps) {
    const { t } = useTranslation();

    if (!isGeneratingGraph && !generationError && !generationSuccess) {
        return null;
    }

    return (
        <div className="mt-4 pt-4 border-t border-slate-200/60 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex justify-center">
                {/* Processing badge removed as per user request */}
                {generationError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
                        <span className="font-bold">Error:</span> {generationError}
                    </div>
                )}
                {generationSuccess && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 shadow-sm">
                        <Check size={16} className="text-emerald-500" />
                        <span className="whitespace-pre-line font-medium">{generationSuccess}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
