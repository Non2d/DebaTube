import { useEffect, useState, useRef } from 'react';
import { getAPIRoot, type BackgroundStepStatus, mapBackgroundStatus } from '../../../../components/lib/utils';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../../context/LanguageContext';

export interface JobProgressRaw {
  round_id: number;
  step_1: string;
  step_1a: string;
  step_1b: string;
  step_1c: string;
  step_1d: string;
  step_2: string;
  step_3: string;
  step_4: string;
}

export interface JobProgress {
  round_id: number;
  step_1: BackgroundStepStatus;
  step_1a: BackgroundStepStatus;
  step_1b: BackgroundStepStatus;
  step_1c: BackgroundStepStatus;
  step_1d: BackgroundStepStatus;
  step_2: BackgroundStepStatus;
  step_3: BackgroundStepStatus;
  step_4: BackgroundStepStatus;
}

export interface RoundSummary {
  id: number;
  video_id: string | null;
  title: string;
  description: string;
  motion: string;
  date_uploaded: string;
  channel_id: string;
  tag: string;
  poi_count: number;
  rebuttal_count: number;
  speech_count: number;
  total_argument_units: number;
  type: string;
  try_count: number;
  style: string;
}

export interface PaginatedRoundSummaryResponse {
  items: RoundSummary[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export async function getRoundsSummary(type?: string, page: number = 1, limit: number = 50): Promise<PaginatedRoundSummaryResponse> {
  const apiRoot = getAPIRoot();

  // Fix URL for development environment
  let url = `${apiRoot}/rounds-summary?page=${page}&limit=${limit}`;
  if (type) {
    url += `&type=${type}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export function useRounds(type?: string) {
  const { t } = useTranslation();
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jobProgress, setJobProgress] = useState<Map<number, JobProgress>>(new Map());
  const prevJobProgressRef = useRef<Map<number, JobProgress>>(new Map());

  const fetchRounds = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRoundsSummary(type, page, limit);
      setRounds(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rounds');
      console.error('Error fetching rounds:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllJobProgress = async (roundIds: number[]) => {
    if (roundIds.length === 0) return;

    try {
      const apiRoot = getAPIRoot();
      const response = await fetch(`${apiRoot}/job-progress-background-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ round_ids: roundIds }),
      });

      let results: JobProgressRaw[];

      if (response.ok) {
        results = await response.json() as JobProgressRaw[];
      } else if (response.status === 404) {
        // Treat 404 as all steps being not_in_queue
        results = roundIds.map(id => ({
          round_id: id,
          step_1: 'NOT_IN_QUEUE',
          step_1a: 'NOT_IN_QUEUE',
          step_1b: 'NOT_IN_QUEUE',
          step_1c: 'NOT_IN_QUEUE',
          step_1d: 'NOT_IN_QUEUE',
          step_2: 'NOT_IN_QUEUE',
          step_3: 'NOT_IN_QUEUE',
          step_4: 'NOT_IN_QUEUE',
        }));
      } else {
        console.error('Failed to fetch job progress batch:', response.status);
        return;
      }

      const progressMap = new Map<number, JobProgress>();

      results.forEach(rawData => {
        const progress: JobProgress = {
          round_id: rawData.round_id,
          step_1: mapBackgroundStatus(rawData.step_1),
          step_1a: mapBackgroundStatus(rawData.step_1a),
          step_1b: mapBackgroundStatus(rawData.step_1b),
          step_1c: mapBackgroundStatus(rawData.step_1c),
          step_1d: mapBackgroundStatus(rawData.step_1d),
          step_2: mapBackgroundStatus(rawData.step_2),
          step_3: mapBackgroundStatus(rawData.step_3),
          step_4: mapBackgroundStatus(rawData.step_4),
        };
        progressMap.set(rawData.round_id, progress);

        // Check for completion and show toast
        const prevProgress = prevJobProgressRef.current.get(rawData.round_id);
        if (prevProgress) {
          // Step 1-A completion
          if (prevProgress.step_1a !== 'done' && progress.step_1a === 'done') {
            toast.success(`[Round ${rawData.round_id}] ${t('dashboard.steps.messages.step1aCompleted')}`, { duration: 3000 });
          }
          // Step 1-B completion
          if (prevProgress.step_1b !== 'done' && progress.step_1b === 'done') {
            toast.success(`[Round ${rawData.round_id}] ${t('dashboard.steps.messages.step1bCompleted')}`, { duration: 3000 });
          }
          // Step 1-C completion
          if (prevProgress.step_1c !== 'done' && progress.step_1c === 'done') {
            toast.success(`[Round ${rawData.round_id}] ${t('dashboard.steps.messages.step1cCompleted')}`, { duration: 3000 });
          }
          // Step 1-D completion
          if (prevProgress.step_1d !== 'done' && progress.step_1d === 'done') {
            toast.success(`[Round ${rawData.round_id}] ${t('dashboard.steps.messages.step1dCompleted')}`, { duration: 3000 });
          }
        }
      });

      prevJobProgressRef.current = progressMap;
      setJobProgress(progressMap);
    } catch (err) {
      console.error('Error fetching job progress:', err);
    }
  };

  useEffect(() => {
    fetchRounds();
  }, [type, page, limit]);

  // Fetch job progress for all rounds
  useEffect(() => {
    const roundIds = rounds.map(r => r.id);
    fetchAllJobProgress(roundIds);
  }, [rounds]);

  // Polling for background processing
  useEffect(() => {
    // Check if any round has processing steps
    const hasProcessingRound = Array.from(jobProgress.values()).some(progress =>
      progress.step_1a === 'processing' || progress.step_1a === 'in_queue' ||
      progress.step_1b === 'processing' || progress.step_1b === 'in_queue' ||
      progress.step_1c === 'processing' || progress.step_1c === 'in_queue' ||
      progress.step_1d === 'processing' || progress.step_1d === 'in_queue' ||
      progress.step_2 === 'processing' || progress.step_2 === 'in_queue' ||
      progress.step_3 === 'processing' || progress.step_3 === 'in_queue' ||
      progress.step_4 === 'processing' || progress.step_4 === 'in_queue'
    );

    if (!hasProcessingRound) {
      return; // No polling needed
    }

    // Poll every 5 seconds while processing
    const intervalId = setInterval(() => {
      const roundIds = rounds.map(r => r.id);
      fetchAllJobProgress(roundIds);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [jobProgress, rounds]);

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const refetch = async () => {
    const roundIds = rounds.map(r => r.id);
    await fetchAllJobProgress(roundIds);
  };

  return {
    rounds,
    loading,
    error,
    jobProgress,
    refetch,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      goToPage,
      setLimit
    }
  };
}