import { Play, Pause, Download } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

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
  recording: Recording | null;
  currentPlayingSpeech: number | null;
  isPlaying: boolean;
  isCurrentSpeech: boolean;
  onPlayPause: (index: number) => void;
  onDownload: (index: number) => void;
  onClick: (index: number) => void;
}

export default function RecordingCard({
  speech,
  index,
  recording,
  currentPlayingSpeech,
  isPlaying,
  isCurrentSpeech,
  onPlayPause,
  onDownload,
  onClick
}: RecordingCardProps) {
  return (
    <div 
      className={`rounded-lg p-4 cursor-pointer transition-all duration-200 ${
        isCurrentSpeech 
          ? speech.team === 'proposition'
            ? 'border-2 border-red-500 bg-red-50'
            : 'border-2 border-blue-500 bg-blue-50'
          : recording 
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
        </div>
        {recording && (
          <div className="flex gap-1">
            <button
              onClick={() => onPlayPause(index)}
              className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              title={currentPlayingSpeech === index && isPlaying ? '停止' : '再生'}
            >
              {currentPlayingSpeech === index && isPlaying ? (
                <Pause size={12} />
              ) : (
                <Play size={12} />
              )}
            </button>
            <button
              onClick={() => onDownload(index)}
              className="p-2 bg-green-500 text-white rounded hover:bg-green-600"
              title="ダウンロード"
            >
              <Download size={12} />
            </button>
          </div>
        )}
      </div>
      {recording ? (
        <AudioPlayer
          audioBlob={recording.blob}
          recordingDuration={recording.duration}
          isPlaying={currentPlayingSpeech === index ? isPlaying : false}
          onPlayPause={() => onPlayPause(index)}
        />
      ) : (
        <div className="text-gray-400 text-sm text-center py-4">
          No recording
        </div>
      )}
    </div>
  );
}
