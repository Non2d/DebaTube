import { useRef, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';

interface AudioPlayerProps {
  audioBlob: Blob;
  recordingDuration: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onDownload: () => void;
  onTimeUpdate: (currentTime: number) => void;
  onDurationChange: (duration: number) => void;
}

const formatTime = (seconds: number) => {
  if (!seconds || !isFinite(seconds)) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function AudioPlayer({
  audioBlob,
  recordingDuration,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onDownload,
  onTimeUpdate,
  onDurationChange,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioBlob && audioRef.current && !audioRef.current.src) {
      const url = URL.createObjectURL(audioBlob);
      audioRef.current.src = url;

      audioRef.current.onloadedmetadata = () => {
        const audioDuration = audioRef.current?.duration;
        if (audioDuration && isFinite(audioDuration)) {
          onDurationChange(audioDuration);
        } else {
          onDurationChange(recordingDuration);
        }
      };

      audioRef.current.ontimeupdate = () => {
        onTimeUpdate(audioRef.current?.currentTime || 0);
      };

      audioRef.current.onended = () => {
        // onPlayPause will handle the state change
      };

      audioRef.current.oncanplaythrough = () => {
        const audioDuration = audioRef.current?.duration;
        if (audioDuration && isFinite(audioDuration)) {
          onDurationChange(audioDuration);
        } else {
          onDurationChange(recordingDuration);
        }
      };

      audioRef.current.load();
    }
  }, [audioBlob, recordingDuration, onDurationChange, onTimeUpdate]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && audioRef.current.paused) {
        audioRef.current.play();
      } else if (!isPlaying && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const maxTime = duration || recordingDuration;
    const seekTime = Math.min(newTime, maxTime);
    
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
    onSeek(seekTime);
  };

  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
        録音完了 (録音時間: {formatTime(recordingDuration)})
      </h3>
      
      {/* 音声プレーヤー */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || recordingDuration)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={duration || recordingDuration}
          step="0.01"
          value={currentTime || 0}
          onChange={handleSeek}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          style={{
            background: '#d1d5db',
            outline: 'none',
            WebkitAppearance: 'none',
            appearance: 'none',
          }}
        />
      </div>
      
      <div className="flex justify-center space-x-4">
        <button
          onClick={onPlayPause}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors duration-200"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          <span>{isPlaying ? '一時停止' : '再生'}</span>
        </button>
        <button
          onClick={onDownload}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors duration-200"
        >
          <Download size={20} />
          <span>ダウンロード</span>
        </button>
      </div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}