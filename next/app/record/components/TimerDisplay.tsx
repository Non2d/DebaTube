interface TimerDisplayProps {
  recordingDuration: number;
  isRecording: boolean;
  maxDuration?: number;
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
  maxDuration,
}: TimerDisplayProps) {
  const isOverTime = maxDuration && recordingDuration > maxDuration;
  const remainingTime = maxDuration ? maxDuration - recordingDuration : 0;

  return (
    <div className="text-center mb-8">
      <div className={`text-8xl font-mono font-bold ${
        isOverTime ? 'text-red-600' : 'text-gray-900'
      }`}>
        {formatTime(recordingDuration)}
      </div>
      {isRecording && (
        <div className="mt-4 flex justify-center items-center">
          <div className={`animate-pulse rounded-full w-4 h-4 mr-3 ${
            isOverTime ? 'bg-red-600' : 'bg-red-500'
          }`}></div>
          <span className={`text-xl font-medium ${
            isOverTime ? 'text-red-600' : 'text-red-500'
          }`}>
            {isOverTime ? '時間超過中' : '録音中'}
          </span>
        </div>
      )}
    </div>
  );
}