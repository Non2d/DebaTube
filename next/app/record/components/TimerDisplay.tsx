interface TimerDisplayProps {
  recordingDuration: number;
  isRecording: boolean;
}

const formatTime = (seconds: number) => {
  if (!seconds || !isFinite(seconds)) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function TimerDisplay({
  recordingDuration,
  isRecording,
}: TimerDisplayProps) {
  return (
    <div className="text-center mb-8">
      <div className="text-3xl font-mono font-bold text-gray-900">
        {formatTime(recordingDuration)}
      </div>
      {isRecording && (
        <div className="mt-2 flex justify-center items-center">
          <div className="animate-pulse bg-red-500 rounded-full w-3 h-3 mr-2"></div>
          <span className="text-red-500 font-medium">録音中</span>
        </div>
      )}
    </div>
  );
}