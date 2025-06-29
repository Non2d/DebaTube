import { useEffect, useState } from 'react';
import { getAPIRoot } from '../../../components/lib/utils';

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
}

export async function getRoundsSummary(): Promise<RoundSummary[]> {
  const apiRoot = getAPIRoot();
  
  // Fix URL for development environment
  const url = `${apiRoot}/rounds-summary`;
    
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

export function useRounds() {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRounds = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getRoundsSummary();
        setRounds(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch rounds');
        console.error('Error fetching rounds:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRounds();
  }, []);

  return { rounds, loading, error };
}