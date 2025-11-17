import { useRef, useEffect, useState } from 'react';
import { Play, Pause, Download } from 'lucide-react';

interface AudioPlayerProps {
  audioBlob?: Blob;
  audioBlobs?: Blob[];
  recordingDuration: number;
  recordingDurations?: number[];
  isPlaying: boolean;
  onPlayPause: () => void;
  onTimeJump?: (time: number) => void;
  seekTime?: number;
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
  audioBlobs,
  recordingDuration,
  recordingDurations,
  isPlaying,
  onPlayPause,
  seekTime,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentBlobIndex, setCurrentBlobIndex] = useState(0);
  const [blobUrls, setBlobUrls] = useState<string[]>([]);
  const [blobDurations, setBlobDurations] = useState<number[]>([]);

  // Initialize blob URLs and durations
  useEffect(() => {
    const blobs = audioBlobs || (audioBlob ? [audioBlob] : []);
    if (blobs.length === 0) {
      return;
    }

    const urls = blobs.map(blob => URL.createObjectURL(blob));
    setBlobUrls(urls);

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [audioBlob, audioBlobs]);

  // Load current blob
  useEffect(() => {
    if (blobUrls.length > 0 && audioRef.current) {
      audioRef.current.src = blobUrls[currentBlobIndex];

      const handleTimeUpdate = () => {
        const localTime = audioRef.current?.currentTime || 0;
        const accumulatedTime = blobDurations.slice(0, currentBlobIndex).reduce((sum, d) => sum + d, 0);
        setCurrentTime(accumulatedTime + localTime);
      };

      const handleEnded = () => {
        if (currentBlobIndex < blobUrls.length - 1) {
          // Move to next blob
          setCurrentBlobIndex(prev => prev + 1);
        } else {
          // All blobs finished
          onPlayPause(); // Stop playing
          setCurrentBlobIndex(0);
          setCurrentTime(0);
        }
      };

      const handleError = (e: Event) => {
        console.error('AudioPlayer: Audio error event:', e, audioRef.current?.error);
      };

      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('ended', handleEnded);
      audioRef.current.addEventListener('error', handleError);
      audioRef.current.load();

      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
          audioRef.current.removeEventListener('ended', handleEnded);
          audioRef.current.removeEventListener('error', handleError);
        }
      };
    }
  }, [blobUrls, currentBlobIndex]);

  // Store blob durations when metadata is loaded
  useEffect(() => {
    if (blobUrls.length > 0 && audioRef.current) {
      const audio = audioRef.current;
      const handleLoadedMetadata = () => {
        setBlobDurations(prev => {
          const newDurations = [...prev];
          // Prefer recordingDurations if provided for this blob
          // Otherwise use actual duration if available and finite
          // Otherwise use recordingDuration as fallback
          const duration = recordingDurations?.[currentBlobIndex] ??
            (audio.duration && isFinite(audio.duration) ? audio.duration : recordingDuration);
          newDurations[currentBlobIndex] = duration;
          return newDurations;
        });
      };
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [blobUrls, currentBlobIndex, recordingDuration, recordingDurations]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && audioRef.current.paused) {
        audioRef.current.play().catch(err => {
          console.error('AudioPlayer: Play failed', err);
        });
      } else if (!isPlaying && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Handle external seek request (from graph node click)
  useEffect(() => {
    if (seekTime !== undefined && audioRef.current && blobDurations.length > 0) {
      // Find which blob this time corresponds to
      let accumulatedTime = 0;
      let targetBlobIndex = 0;
      for (let i = 0; i < blobDurations.length; i++) {
        if (accumulatedTime + blobDurations[i] > seekTime) {
          targetBlobIndex = i;
          break;
        }
        accumulatedTime += blobDurations[i];
      }

      // Switch to the correct blob if needed
      if (targetBlobIndex !== currentBlobIndex) {
        setCurrentBlobIndex(targetBlobIndex);
        // Will be set after blob loads
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = seekTime - accumulatedTime;
            setCurrentTime(seekTime);
          }
        }, 100);
      } else {
        audioRef.current.currentTime = seekTime - accumulatedTime;
        setCurrentTime(seekTime);
      }
    }
  }, [seekTime, blobDurations, currentBlobIndex]);

  // Reset to beginning when blobs change
  useEffect(() => {
    setCurrentBlobIndex(0);
    setCurrentTime(0);
  }, [blobUrls]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      // Find which blob this time corresponds to
      let accumulatedTime = 0;
      let targetBlobIndex = 0;
      for (let i = 0; i < blobDurations.length; i++) {
        if (accumulatedTime + blobDurations[i] > newTime) {
          targetBlobIndex = i;
          break;
        }
        accumulatedTime += blobDurations[i];
      }

      // Switch to the correct blob if needed
      if (targetBlobIndex !== currentBlobIndex) {
        setCurrentBlobIndex(targetBlobIndex);
        // Will be set after blob loads
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.currentTime = newTime - accumulatedTime;
          }
        }, 100);
      } else {
        audioRef.current.currentTime = newTime - accumulatedTime;
        setCurrentTime(newTime);
      }
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