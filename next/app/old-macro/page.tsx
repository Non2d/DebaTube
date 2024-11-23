"use client";

import React, { useEffect, useState, ChangeEvent } from 'react';
import MacroStructure from '../../components/MacroStructure/MacroStructure';
import { apiRoot } from '../../components/utils/foundation';

import YoutubeGraph from '../../components/VideoRecommendation/YoutubeGraph';

interface Round {
  id: number;
  title: string;
  motion: string;
  // 他のプロパティがある場合はここに追加
}

export default function Home() {
  const displayNum = 12;
  const soturonRoundIds = sequent_array(185, 204);
  // const wsdc24JPRoundIds = [208, 215, 216, 217, 219, 220, 221, 227];
  const wsdc24JPRoundIds = [239, 242]
  // const targetRoundIds = [...soturonRoundIds, ...wsdc24JPRoundIds];
  // const targetRoundIds = soturonRoundIds;
  const targetRoundIds = [204, ...soturonRoundIds, ...wsdc24JPRoundIds, 238];
  // const targetRoundIds = [238];
  

  const [rounds, setRounds] = useState<Round[]>([]); //ドロップダウン用のラウンドリスト(全体)
  const [selectedRounds, setSelectedRounds] = useState<(Round | null)[]>(Array(displayNum).fill(null)); //グラフを表示するラウンドリスト(4つ)

  function sequent_array (start: number, end: number) {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  useEffect(() => {
    fetch(apiRoot + '/rounds', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json())
      .then((data: Round[]) => {
        const filteredRounds = data.filter(round => targetRoundIds.includes(round.id));

        const displayRounds = data;
        // const displayRounds = filteredRounds;

        setRounds(displayRounds);
        setSelectedRounds(displayRounds.slice(-displayNum)); //最新の18件を初期値として設定
      })
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  const handleSelectChange = (index: number, event: ChangeEvent<HTMLSelectElement>) => {
    const selectedId = event.target.value;
    const round = rounds.find(r => r.id === parseInt(selectedId));
    const newSelectedRounds = [...selectedRounds];
    newSelectedRounds[index] = round || null;
    setSelectedRounds(newSelectedRounds);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
        {Array.from({ length: displayNum }, (_, index) => (
          <div key={index} className="card bg-white shadow-md rounded-lg p-4 m-2" style={{ width: '600px' }}>
            <select onChange={(event) => handleSelectChange(index, event)} className="mb-4 p-2 border rounded" style={{ width: '450px' }}>
              <option value="">Select a round</option>
              {rounds.map(round => (
                <option key={round.id} value={round.id}>
                  {round.title}
                </option>
              ))}
            </select>
            {selectedRounds[index] && (
              <div>
                <h2 className="text-xl font-bold">{selectedRounds[index]?.id}: {selectedRounds[index]?.title}</h2>
                <p className="text-gray-700">Motion: {selectedRounds[index]?.motion}</p>
              </div>
            )}
            {selectedRounds[index] != null && selectedRounds[index]?.id != null && (
              <MacroStructure roundId={selectedRounds[index]!.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}