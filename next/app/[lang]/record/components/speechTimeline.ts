/**
 * Utility functions for managing unified speech timeline
 * Used by UnifiedAudioPlayer to handle multiple speeches as a single timeline
 */

export interface SpeechSegment {
  speechIndex: number;
  startTime: number;  // Global timeline start time
  endTime: number;    // Global timeline end time
  duration: number;   // Speech duration
  blobs: Blob[];      // Audio blobs for this speech
}

/**
 * Calculate global timeline position from local speech time
 * @param speechIndex - Index of the speech
 * @param localTime - Time within the specific speech
 * @param segments - Array of speech segments
 * @returns Global timeline position in seconds
 */
export function localToGlobalTime(
  speechIndex: number,
  localTime: number,
  segments: SpeechSegment[]
): number {
  const segment = segments.find(s => s.speechIndex === speechIndex);
  if (!segment) return 0;

  return segment.startTime + localTime;
}

/**
 * Calculate local speech time from global timeline position
 * @param globalTime - Time on the global timeline
 * @param segments - Array of speech segments
 * @returns Object with speechIndex and local time, or null if not found
 */
export function globalToLocalTime(
  globalTime: number,
  segments: SpeechSegment[]
): { speechIndex: number; localTime: number } | null {
  for (const segment of segments) {
    if (globalTime >= segment.startTime && globalTime < segment.endTime) {
      return {
        speechIndex: segment.speechIndex,
        localTime: globalTime - segment.startTime
      };
    }
  }

  // If globalTime is beyond all segments, return the last segment's end
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    if (globalTime >= lastSegment.endTime) {
      return {
        speechIndex: lastSegment.speechIndex,
        localTime: lastSegment.duration
      };
    }
  }

  return null;
}

/**
 * Build speech segments from recordings
 * @param speechRecordings - Map of speech index to recordings
 * @param speechCount - Total number of speeches
 * @returns Array of speech segments with timeline positions
 */
export function buildSpeechSegments(
  speechRecordings: { [key: number]: { blob: Blob; duration: number; timestamp: string }[] },
  speechCount: number
): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  let currentGlobalTime = 0;

  for (let i = 0; i < speechCount; i++) {
    const recordings = speechRecordings[i];
    if (!recordings || recordings.length === 0) {
      continue;
    }

    // Calculate total duration for this speech
    const duration = recordings.reduce((sum, r) => sum + r.duration, 0);
    const blobs = recordings.map(r => r.blob);

    segments.push({
      speechIndex: i,
      startTime: currentGlobalTime,
      endTime: currentGlobalTime + duration,
      duration,
      blobs
    });

    currentGlobalTime += duration;
  }

  return segments;
}

/**
 * Get total duration of all speeches combined
 * @param segments - Array of speech segments
 * @returns Total duration in seconds
 */
export function getTotalDuration(segments: SpeechSegment[]): number {
  if (segments.length === 0) return 0;
  const lastSegment = segments[segments.length - 1];
  return lastSegment.endTime;
}
