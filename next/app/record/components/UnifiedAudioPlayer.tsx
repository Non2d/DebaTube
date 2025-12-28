import { useRef, useEffect, useState, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';
import { buildSpeechSegments, globalToLocalTime, getTotalDuration, SpeechSegment } from './speechTimeline';
import { logPlaybackEvent } from '../../../utils/userLogger';
import { useTranslation } from '../../../context/LanguageContext';

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
  const { t } = useTranslation();

  // Ref to track the target local time for a pending seek operation
  const pendingSeekRef = useRef<number | null>(null);
  // Ref to suppress time updates during seek/load operations
  const isSeekingRef = useRef<boolean>(false);

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

  // Determine current source URL
  const currentSrc = useMemo(() => {
    if (segments.length === 0 || blobUrls.length === 0) return '';
    const currentSegmentUrls = blobUrls[currentSegmentIndex];
    if (!currentSegmentUrls || currentBlobIndexInSegment >= currentSegmentUrls.length) return '';
    return currentSegmentUrls[currentBlobIndexInSegment];
  }, [segments, blobUrls, currentSegmentIndex, currentBlobIndexInSegment]);


  // Handle Play/Pause
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying && audioRef.current.paused) {
      audioRef.current.play().catch(err => console.error('Play failed:', err));
    } else if (!isPlaying && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Handle external seek request
  useEffect(() => {
    if (seekToGlobalTime === undefined || segments.length === 0) return;

    const localInfo = globalToLocalTime(seekToGlobalTime, segments);
    if (!localInfo) return;

    // Find segment
    const segmentIndex = segments.findIndex(s => s.speechIndex === localInfo.speechIndex);
    if (segmentIndex === -1) return;

    // Find blob within segment
    const recordings = speechRecordings[localInfo.speechIndex];
    let accumulatedTime = 0;
    let blobIndex = 0;
    for (let i = 0; i < recordings.length; i++) {
      // If the seek target is within this recording (or it's the last one)
      if (accumulatedTime + recordings[i].duration > localInfo.localTime) {
        blobIndex = i;
        break;
      }
      accumulatedTime += recordings[i].duration;
    }
    // Handle edge case where it might be slightly past the last blob due to floating point
    if (blobIndex >= recordings.length && recordings.length > 0) {
      blobIndex = recordings.length - 1;
      accumulatedTime -= recordings[blobIndex].duration; // Undo add
    }

    const targetLocalTime = Math.max(0, localInfo.localTime - accumulatedTime);

    // If we need to switch segment or blob
    if (segmentIndex !== currentSegmentIndex || blobIndex !== currentBlobIndexInSegment) {
      isSeekingRef.current = true;
      pendingSeekRef.current = targetLocalTime;

      setCurrentSegmentIndex(segmentIndex);
      setCurrentBlobIndexInSegment(blobIndex);
      setCurrentGlobalTime(seekToGlobalTime); // Optimistic update

      logPlaybackEvent('seek', localInfo.speechIndex, seekToGlobalTime);
    } else {
      // Same segment/blob, just seek via ref
      if (audioRef.current) {
        audioRef.current.currentTime = targetLocalTime;
      }
      setCurrentGlobalTime(seekToGlobalTime);
      logPlaybackEvent('seek', localInfo.speechIndex, seekToGlobalTime);
    }

  }, [seekToGlobalTime, segments, speechRecordings]);


  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    if (pendingSeekRef.current !== null || isSeekingRef.current) return;

    const audio = e.currentTarget;
    const localTime = audio.currentTime;

    // Safety check - make sure we have current segment
    const currentSegment = segments[currentSegmentIndex];
    if (!currentSegment) return;

    // Calculate accumulated time
    const recordings = speechRecordings[currentSegment.speechIndex];
    const accumulatedLocalTime = recordings
      .slice(0, currentBlobIndexInSegment)
      .reduce((sum, r) => sum + r.duration, 0);

    const globalTime = currentSegment.startTime + accumulatedLocalTime + localTime;
    setCurrentGlobalTime(globalTime);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;

    if (pendingSeekRef.current !== null) {
      // Execute the pending seek
      audio.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;

      // Small delay to let the seek 'settle' before resuming time updates
      // This prevents the 'jump to 0' issue
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 100);
    } else {
      isSeekingRef.current = false;
    }

    if (isPlaying) {
      audio.play().catch(err => console.error('Play on loaded failed:', err));
    }
  };

  const handleEnded = () => {
    const currentSegmentRecordings = speechRecordings[segments[currentSegmentIndex].speechIndex];

    if (currentBlobIndexInSegment < currentSegmentRecordings.length - 1) {
      // Next blob in segment
      setCurrentBlobIndexInSegment(prev => prev + 1);
    } else if (currentSegmentIndex < segments.length - 1) {
      // Next segment
      setCurrentSegmentIndex(prev => prev + 1);
      setCurrentBlobIndexInSegment(0);
    } else {
      // End of all playback
      onPlayPause(); // Pause
      setCurrentSegmentIndex(0);
      setCurrentBlobIndexInSegment(0);
      setCurrentGlobalTime(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    // We reusing the same logic as external search by updating calling parent if possible
    // But here we can just do internal seek logic to match:
    // For now, simpler to just treat strictly logic:

    const localInfo = globalToLocalTime(time, segments);
    if (!localInfo) return;

    const segmentIndex = segments.findIndex(s => s.speechIndex === localInfo.speechIndex);
    if (segmentIndex === -1) return;

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

    const targetLocalTime = localInfo.localTime - accumulatedTime;

    if (segmentIndex !== currentSegmentIndex || blobIndex !== currentBlobIndexInSegment) {
      isSeekingRef.current = true;
      pendingSeekRef.current = targetLocalTime;
      setCurrentSegmentIndex(segmentIndex);
      setCurrentBlobIndexInSegment(blobIndex);
    } else {
      if (audioRef.current) audioRef.current.currentTime = targetLocalTime;
    }
    setCurrentGlobalTime(time);
  };

  const handleSeekStart = () => {
    isSeekingRef.current = true;
    logPlaybackEvent('seek_start', segments[currentSegmentIndex]?.speechIndex || 0, currentGlobalTime);
  };

  const handleSeekEnd = (e: React.SyntheticEvent<HTMLInputElement>) => {
    isSeekingRef.current = false;
    const time = parseFloat((e.target as HTMLInputElement).value);
    // ログを記録（シークバー操作完了時）
    logPlaybackEvent('seek', segments[currentSegmentIndex]?.speechIndex || 0, time);
  };

  if (segments.length === 0) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-center">
        <p className="text-gray-600 dark:text-gray-400">{t('unifiedPlayer.noAudio')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg shadow-md">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={onPlayPause}
          className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
          title={isPlaying ? t('unifiedPlayer.pause') : t('unifiedPlayer.play')}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2 text-sm text-white font-medium">
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
            className="range-thumb-custom"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentGlobalTime / totalDuration) * 100}%, #d1d5db ${(currentGlobalTime / totalDuration) * 100}%, #d1d5db 100%)`,
              outline: 'none',
              WebkitAppearance: 'none',
              appearance: 'none',
            }}
            onPointerDown={handleSeekStart}
            onPointerUp={handleSeekEnd}
          />
          {/* Speech timeline visualization */}
          <div className="mt-2">
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
            <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{t('unifiedPlayer.prop')}</span>
              <span>{t('unifiedPlayer.opp')}</span>
            </div>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={currentSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={(e) => console.error("Audio error", e)}
        className="hidden"
      />
    </div>
  );
}
