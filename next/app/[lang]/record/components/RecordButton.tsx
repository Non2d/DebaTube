import { Mic, Square, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../../context/LanguageContext';

interface RecordButtonProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export default function RecordButton({
  isRecording,
  onStartRecording,
  onStopRecording,
}: RecordButtonProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-center mb-2">
        {!isRecording ? (
          <button
            onClick={onStartRecording}
            className="bg-red-500 hover:bg-red-600 text-white rounded-full p-6 transition-colors duration-200 shadow-lg hover:shadow-xl dark:shadow-[0_6px_20px_rgba(0,0,0,0.7)]"
          >
            <Mic size={48} />
          </button>
        ) : (
          <button
            onClick={onStopRecording}
            className="bg-gray-500 hover:bg-gray-600 text-white rounded-full p-6 transition-colors duration-200 shadow-lg hover:shadow-xl dark:shadow-[0_6px_20px_rgba(0,0,0,0.7)]"
          >
            <Square size={48} />
          </button>
        )}
      </div>
      <div className="flex items-center px-4 py-2 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-600 dark:text-red-400 text-sm max-w-md text-center">
        <AlertTriangle size={16} className="flex-shrink-0" />
        <span>{t('recordButton.warning')}</span>
      </div>
    </div>
  );
}