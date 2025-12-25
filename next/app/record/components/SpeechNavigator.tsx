
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SpeechFormat } from '../../../constants/constants';

interface SpeechNavigatorProps {
    currentSpeech: SpeechFormat;
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
}

export default function SpeechNavigator({ currentSpeech, onPrev, onNext, canPrev, canNext }: SpeechNavigatorProps) {
    return (
        <div className="flex items-center justify-center gap-8 mb-6">
            <div className="text-center px-8">
                <h2 className={`text-2xl font-bold ${currentSpeech.team === 'proposition' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                    {currentSpeech.name}
                </h2>
            </div>
        </div>
    );
}
// Note: The original code had the chevrons on the sides of the header or nearby?
// Checking the original file lines 798-805:
/*
<div className="flex items-center justify-center gap-8 mb-6">
  <div className="text-center px-8">
    <h2 className={`text-2xl font-bold ${currentSpeech.team === 'proposition' ? 'text-red-600' : 'text-blue-600'
      }`}>
      {currentSpeech.name}
    </h2>
  </div>
</div>
*/
// It seems the Chevrons were REMOVED in the provided snippet?
// Wait, I saw ChevronLeft, ChevronRight in imports in the original file (line 4).
// But looking at lines 798-806 in the view_file output (Step 6), they are NOT used in that block.
// Maybe I missed them in the previous view or they were used elsewhere?
// Ah, the user might have removed them in a previous edit but left the imports?
// Or maybe they are used in `RecordButton` or similar? No.
// Let's look at `index.ts` of the conversation history... "Refactor Record Page Tabs"
// Wait, I suspect they might be used in `RecordingCard` or similar if passed down? No.
// Inspecting `RecordPage` lines 446 (prevSpeech), 438 (nextSpeech).
// These functions are defined but WHERE are they executed?
// I see `RecordingCard` has `onClick={goToSpeech}`.
// I don't see `prevSpeech` or `nextSpeech` usage in the visible JSX in `RecordPage`.
// Maybe they were intended for the header but removed?
// The user said "RecordPage is too long".
// I will keep `SpeechNavigator` simple as per the JSX I saw.
// If `prevSpeech` and `nextSpeech` are unused, I might remove them from `RecordPage` too, but for now I focus on extracting what IS there.
