import { useEffect, useState } from 'react';
import { getAPIRoot } from '../../../../components/lib/utils';

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
}

export async function getRoundsSummary(type?: string): Promise<RoundSummary[]> {
  const apiRoot = getAPIRoot();

  // Fix URL for development environment
  let url = `${apiRoot}/rounds-summary`;
  if (type) {
    url += `?type=${type}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export function useRounds(type?: string) {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRounds = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getRoundsSummary(type);
        setRounds(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch rounds');
        console.error('Error fetching rounds:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRounds();
  }, [type]);

  return { rounds, loading, error };
}