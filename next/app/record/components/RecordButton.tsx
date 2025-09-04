import { Mic, Square } from 'lucide-react';

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
  return (
    <div className="flex justify-center mb-8">
      {!isRecording ? (
        <button
          onClick={onStartRecording}
          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-6 transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          <Mic size={48} />
        </button>
      ) : (
        <button
          onClick={onStopRecording}
          className="bg-gray-500 hover:bg-gray-600 text-white rounded-full p-6 transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          <Square size={48} />
        </button>
      )}
    </div>
  );
}