"use client";

import React, { useEffect, useState, ChangeEvent } from 'react';
import MacroStructure from '../components/MacroStructure/MacroStructure';

interface Round {
  id: number;
  title: string;
  motion: string;
  // 他のプロパティがある場合はここに追加
}

export default function Home() {
  const [rounds, setRounds] = useState<Round[]>([]); //ドロップダウン用のラウンドリスト(全体)
  const [selectedRounds, setSelectedRounds] = useState<(Round | null)[]>([null, null, null, null]); //グラフを表示するラウンドリスト(4つ)

  useEffect(() => { //selectの反映には、nodeとedgeの編集処理の実装が必要
    fetch('http://localhost:8080/rounds', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json())
      .then((data: Round[]) => {
        setRounds(data);
        setSelectedRounds(data.slice(-4)); //最新の4つを初期値として設定
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
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        {[0, 1, 2, 3].map(index => (
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