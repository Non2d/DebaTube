import { useRef, useEffect, useState } from 'react';
import { Play, Pause, Download } from 'lucide-react';

interface AudioPlayerProps {
  audioBlob: Blob;
  recordingDuration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
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
  onPlayPause,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (audioBlob && audioRef.current) {
      const url = URL.createObjectURL(audioBlob);
      audioRef.current.src = url;
      
      const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      };

      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.load();
      
      return () => {
        URL.revokeObjectURL(url);
        if (audioRef.current) {
          audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        }
      };
    }
  }, [audioBlob]);

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
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(recordingDuration)}</span>
      </div>
      <input
        type="range"
        min="0"
        max={recordingDuration}
        step="0.01"
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        style={{
          background: '#d1d5db',
          outline: 'none',
          WebkitAppearance: 'none',
          appearance: 'none',
        }}
      />

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}