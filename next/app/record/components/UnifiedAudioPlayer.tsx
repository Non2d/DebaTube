import { useRef, useEffect, useState, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';
import { buildSpeechSegments, globalToLocalTime, getTotalDuration, SpeechSegment } from '../utils/speechTimeline';
import { logPlaybackEvent } from '../../../utils/userLogger';

interface UnifiedAudioPlayerProps {
  speechRecordings: { [key: number]: { blob: Blob; duration: number; timestamp: string }[] };
  speechCount: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  seekToGlobalTime?: number; // External seek request (from graph node click)
}

const formatTime = (seconds: number) => {
  if (!seconds || !isFinite(seconds)) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function UnifiedAudioPlayer({
  speechRecordings,
  speechCount,
  isPlaying,
  onPlayPause,
  seekToGlobalTime
}: UnifiedAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentGlobalTime, setCurrentGlobalTime] = useState(0);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentBlobIndexInSegment, setCurrentBlobIndexInSegment] = useState(0);
  const [blobUrls, setBlobUrls] = useState<string[][]>([]); // Array of blob URL arrays (one per segment)

  // Build speech segments from recordings
  const segments = useMemo(() => {
    return buildSpeechSegments(speechRecordings, speechCount);
  }, [speechRecordings, speechCount]);

  const totalDuration = useMemo(() => {
    return getTotalDuration(segments);
  }, [segments]);

  // Initialize blob URLs for all segments
  useEffect(() => {
    if (segments.length === 0) {
      return;
    }

    const allUrls = segments.map(segment =>
      segment.blobs.map(blob => URL.createObjectURL(blob))
    );
    setBlobUrls(allUrls);

    return () => {
      allUrls.forEach(urls => {
        urls.forEach(url => URL.revokeObjectURL(url));
      });
    };
  }, [segments]);

  // Load current blob
  useEffect(() => {
    if (segments.length === 0 || blobUrls.length === 0 || !audioRef.current) {
      return;
    }

    const currentSegment = segments[currentSegmentIndex];
    if (!currentSegment) {
      return;
    }

    const currentSegmentUrls = blobUrls[currentSegmentIndex];
    if (!currentSegmentUrls || currentBlobIndexInSegment >= currentSegmentUrls.length) {
      return;
    }

    audioRef.current.src = currentSegmentUrls[currentBlobIndexInSegment];

    const handleTimeUpdate = () => {
      if (!audioRef.current) return;

      const localTime = audioRef.current.currentTime || 0;

      // Calculate accumulated time from previous blobs in current segment
      const recordings = speechRecordings[currentSegment.speechIndex];
      const accumulatedLocalTime = recordings
        .slice(0, currentBlobIndexInSegment)
        .reduce((sum, r) => sum + r.duration, 0);

      // Calculate global time
      const globalTime = currentSegment.startTime + accumulatedLocalTime + localTime;
      setCurrentGlobalTime(globalTime);
    };

    const handleEnded = () => {
      const currentSegmentRecordings = speechRecordings[currentSegment.speechIndex];

      // Check if there are more blobs in current segment
      if (currentBlobIndexInSegment < currentSegmentRecordings.length - 1) {
        // Move to next blob in same segment
        setCurrentBlobIndexInSegment(prev => prev + 1);
      } else if (currentSegmentIndex < segments.length - 1) {
        // Move to next segment
        setCurrentSegmentIndex(prev => prev + 1);
        setCurrentBlobIndexInSegment(0);
      } else {
        // All segments finished
        onPlayPause(); // Stop playing
        setCurrentSegmentIndex(0);
        setCurrentBlobIndexInSegment(0);
        setCurrentGlobalTime(0);
      }
    };

    const handleError = (e: Event) => {
      console.error('UnifiedAudioPlayer: Audio error event:', e, audioRef.current?.error);
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
  }, [segments, blobUrls, currentSegmentIndex, currentBlobIndexInSegment, speechRecordings, onPlayPause]);

  // Handle play/pause state
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && audioRef.current.paused) {
        audioRef.current.play().catch(err => {
          console.error('UnifiedAudioPlayer: Play failed', err);
        });
      } else if (!isPlaying && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Handle external seek request (from graph node click)
  useEffect(() => {
    if (seekToGlobalTime === undefined || segments.length === 0 || !audioRef.current) {
      return;
    }

    const localInfo = globalToLocalTime(seekToGlobalTime, segments);
    if (!localInfo) {
      console.warn('UnifiedAudioPlayer: Invalid seek time', seekToGlobalTime);
      return;
    }

    // Find the segment index
    const segmentIndex = segments.findIndex(s => s.speechIndex === localInfo.speechIndex);
    if (segmentIndex === -1) {
      console.warn('UnifiedAudioPlayer: Segment not found for speech', localInfo.speechIndex);
      return;
    }

    // Find the blob index within the segment
    const recordings = speechRecordings[localInfo.speechIndex];
    let accumulatedTime = 0;
    let blobIndex = 0;
    for (let i = 0; i < recordings.length; i++) {
      if (accumulatedTime + recordings[i].duration > localInfo.localTime) {
        blobIndex = i;
        break;
      }
      accumulatedTime += recordings[i].duration;
    }

    // Switch to the correct segment and blob if needed
    if (segmentIndex !== currentSegmentIndex || blobIndex !== currentBlobIndexInSegment) {
      setCurrentSegmentIndex(segmentIndex);
      setCurrentBlobIndexInSegment(blobIndex);
      // Will be set after blob loads
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = localInfo.localTime - accumulatedTime;
          setCurrentGlobalTime(seekToGlobalTime);
        }
      }, 100);
    } else {
      audioRef.current.currentTime = localInfo.localTime - accumulatedTime;
      setCurrentGlobalTime(seekToGlobalTime);
    }

    // Log the seek event
    logPlaybackEvent('seek', localInfo.speechIndex, seekToGlobalTime);
  }, [seekToGlobalTime, segments, speechRecordings, currentSegmentIndex, currentBlobIndexInSegment]);

  // Reset to beginning when segments change
  useEffect(() => {
    setCurrentSegmentIndex(0);
    setCurrentBlobIndexInSegment(0);
    setCurrentGlobalTime(0);
  }, [segments]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGlobalTime = parseFloat(e.target.value);

    const localInfo = globalToLocalTime(newGlobalTime, segments);
    if (!localInfo || !audioRef.current) {
      return;
    }

    // Find the segment index
    const segmentIndex = segments.findIndex(s => s.speechIndex === localInfo.speechIndex);
    if (segmentIndex === -1) {
      return;
    }

    // Find the blob index within the segment
    const recordings = speechRecordings[localInfo.speechIndex];
    let accumulatedTime = 0;
    let blobIndex = 0;
    for (let i = 0; i < recordings.length; i++) {
      if (accumulatedTime + recordings[i].duration > localInfo.localTime) {
        blobIndex = i;
        break;
      }
      accumulatedTime += recordings[i].duration;
    }

    // Switch to the correct segment and blob if needed
    if (segmentIndex !== currentSegmentIndex || blobIndex !== currentBlobIndexInSegment) {
      setCurrentSegmentIndex(segmentIndex);
      setCurrentBlobIndexInSegment(blobIndex);
      // Will be set after blob loads
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = localInfo.localTime - accumulatedTime;
        }
      }, 100);
    } else {
      audioRef.current.currentTime = localInfo.localTime - accumulatedTime;
      setCurrentGlobalTime(newGlobalTime);
    }

    // Log the seek event
    logPlaybackEvent('seek', localInfo.speechIndex, newGlobalTime);
  };

  if (segments.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600">音声ファイルがありません</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border border-gray-300 rounded-lg shadow-md">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={onPlayPause}
          className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
          title={isPlaying ? '一時停止' : '再生'}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
            <span>{formatTime(currentGlobalTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={totalDuration}
            step="0.01"
            value={currentGlobalTime}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentGlobalTime / totalDuration) * 100}%, #d1d5db ${(currentGlobalTime / totalDuration) * 100}%, #d1d5db 100%)`,
              outline: 'none',
              WebkitAppearance: 'none',
              appearance: 'none',
            }}
          />
        </div>
      </div>

      {/* Speech timeline visualization */}
      <div className="mt-4">
        <div className="flex gap-1">
          {segments.map((segment, index) => {
            const percentage = (segment.duration / totalDuration) * 100;
            return (
              <div
                key={segment.speechIndex}
                className="h-2 rounded"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: index % 2 === 0 ? '#ef4444' : '#3b82f6',
                  opacity: currentSegmentIndex === index ? 1 : 0.5,
                }}
                title={`Speech ${segment.speechIndex + 1}: ${formatTime(segment.duration)}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>Prop</span>
          <span>Opp</span>
        </div>
      </div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
