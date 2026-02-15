import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SpeechFormat } from '../../../../constants/constants';
import { useTranslation } from '../../../../context/LanguageContext';

interface SpeechNavigatorProps {
  currentSpeech: SpeechFormat;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}

export default function SpeechNavigator({ currentSpeech, onPrev, onNext, canPrev, canNext }: SpeechNavigatorProps) {
  const { t } = useTranslation();
  const displayName = t(`recordPage.speechNames.${currentSpeech.name}`);

  return (
    <div className="flex items-center justify-center gap-8 mb-4 mt-4">
      <div className="text-center px-8">
        <h2 className={`text-2xl font-bold ${currentSpeech.team === 'proposition' ? 'text-red-600' : 'text-blue-600'
          }`}>
          {displayName}
        </h2>
      </div>
    </div>
  );
}
