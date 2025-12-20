import { useMemo } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import { logPlaybackEvent } from '../../../utils/userLogger';

interface Speech {
  name: string;
  duration: number;
  team: 'proposition' | 'opposition';
}

interface Recording {
  blob: Blob;
  duration: number;
}

interface RecordingCardProps {
  speech: Speech;
  index: number;
  recording?: Recording | null;
  recordings?: Recording[];
  currentPlayingSpeech: number | null;
  isPlaying: boolean;
  isCurrentSpeech: boolean;
  onPlayPause: (index: number) => void;
  onDownload: (index: number) => void;
  onClick: (index: number) => void;
  hideDownload?: boolean;
  onTimeJump?: (time: number) => void;
  seekTime?: number;
}

export default function RecordingCard({
  speech,
  index,
  recording,
  recordings,
  currentPlayingSpeech,
  isPlaying,
  isCurrentSpeech,
  onPlayPause,
  onDownload,
  onClick,
  hideDownload = false,
  onTimeJump,
  seekTime
}: RecordingCardProps) {
  const hasRecording = (recordings && recordings.length > 0) || recording;
  const totalDuration = useMemo(() =>
    recordings
      ? recordings.reduce((sum, r) => sum + r.duration, 0)
      : (recording?.duration || 0),
    [recordings, recording]
  );
  const blobs = useMemo(() =>
    recordings
      ? recordings.map(r => r.blob)
      : (recording ? [recording.blob] : []),
    [recordings, recording]
  );
  const durations = useMemo(() =>
    recordings
      ? recordings.map(r => r.duration)
      : (recording ? [recording.duration] : []),
    [recordings, recording]
  );

  return (
    <div
      className={`rounded-lg p-4 cursor-pointer transition-all duration-200 ${
        isCurrentSpeech
          ? speech.team === 'proposition'
            ? 'border-2 border-red-500 bg-red-50'
            : 'border-2 border-blue-500 bg-blue-50'
          : hasRecording
            ? 'bg-gray-50 hover:bg-gray-100'
            : 'bg-gray-100 border-2 border-dashed border-gray-300 hover:bg-gray-200'
      }`}
      onClick={() => onClick(index)}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className={`font-medium text-sm ${
            speech.team === 'proposition' ? 'text-red-600' : 'text-blue-600'
          }`}>
            {speech.name}
          </h4>
          {recordings && recordings.length > 1 && (
            <span className="text-xs text-gray-500">({recordings.length} recordings)</span>
          )}
        </div>
        {hasRecording && (
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayPause(index);
                // ログを記録（再生時刻は 0 秒から開始）
                const isCurrentlyPlaying = currentPlayingSpeech === index && isPlaying;
                logPlaybackEvent(isCurrentlyPlaying ? 'pause' : 'play', index, 0);
              }}
              className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              title={currentPlayingSpeech === index && isPlaying ? '停止' : '再生'}
            >
              {currentPlayingSpeech === index && isPlaying ? (
                <Pause size={12} />
              ) : (
                <Play size={12} />
              )}
            </button>
            {!hideDownload && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(index);
                }}
                className="p-2 bg-green-500 text-white rounded hover:bg-green-600"
                title="ダウンロード"
              >
                <Download size={12} />
              </button>
            )}
          </div>
        )}
      </div>
      {hasRecording ? (
        <AudioPlayer
          audioBlobs={blobs}
          recordingDuration={totalDuration}
          recordingDurations={durations}
          isPlaying={currentPlayingSpeech === index ? isPlaying : false}
          onPlayPause={() => onPlayPause(index)}
          onTimeJump={onTimeJump}
          seekTime={seekTime}
          speechIndex={index}
        />
      ) : (
        <div className="text-gray-400 text-sm text-center py-4">
          No recording
        </div>
      )}
    </div>
  );
}
