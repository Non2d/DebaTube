import { useEffect, useState } from 'react';
import { getAPIRoot, type BackgroundStepStatus } from '../../../../components/lib/utils';

export interface RoundSummary {
  id: number;
  video_id: string;
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
  step1_status: BackgroundStepStatus;
  step2_status: BackgroundStepStatus;
  step3_status: BackgroundStepStatus;
  step4_status: BackgroundStepStatus;
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
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchRounds();
  }, [type, page, limit]);

  // Polling for background processing
  useEffect(() => {
    // Check if any round has processing steps
    const hasProcessingRound = rounds.some(round =>
      round.step1_status === 'processing' || round.step1_status === 'in_queue' ||
      round.step2_status === 'processing' || round.step2_status === 'in_queue' ||
      round.step3_status === 'processing' || round.step3_status === 'in_queue' ||
      round.step4_status === 'processing' || round.step4_status === 'in_queue'
    );

    if (!hasProcessingRound) {
      return; // No polling needed
    }

    // Poll every 5 seconds while processing
    const intervalId = setInterval(() => {
      fetchRounds();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [rounds, type, page, limit]);

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return {
    rounds,
    loading,
    error,
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