import React, { useState, useEffect } from 'react';
import { speechIdToPositionNameAsian, speechIdToPositionNameNA, isGovernment } from '../../../components/lib/constants';
import { useAppContext } from '../../../context/context';

interface NodeAsrProps {
  data: {
    start: number;
    end: number;
    text: string;
    positionId: number;
    isPoi: boolean;
  };
}

const NodeAsr = ({ data }: NodeAsrProps) => {
  const { nodeTransparency, isNA, zoomLevel } = useAppContext();

  const { text, start, end, positionId, isPoi } = data;
  const height = zoomLevel * (end - start);
  const [speechIdToPositionName, setSpeechIdToPositionName] = useState(speechIdToPositionNameNA);

  useEffect(() => {
    setSpeechIdToPositionName(isNA ? speechIdToPositionNameNA : speechIdToPositionNameAsian);
  }, [isNA]);

  const isGov = isGovernment(speechIdToPositionName[positionId]);
  const positionLabelColor = isGov ? 'text-red-400' : 'text-blue-400';

  return (
    <div
      className="border border-gray-500 rounded flex items-center"
      style={{
        width: `80vw`,
        height: `${height}px`,
        backgroundColor: `rgba(255, 255, 255, ${nodeTransparency})`,
      }}
    >
      <div
        className="w-full"
        style={{
          color: "black", // 文字色を設定
          paddingLeft: '4px', // 左側にパディングを追加
          fontWeight: 'bold', // フォントウェイトを太くする
        }}
      >
        <span
          className={`absolute top-1 right-0 px-1 ${positionLabelColor}`}
          style={{
            fontSize: '20px', // テキストサイズを小さくする
            transform: 'translateY(-25%)', // 上に移動させる
            zIndex: 0, // Z方向の重ね順で一番後ろに配置
          }}
        >
          {isPoi && <span style={{ fontSize: '0.8em', color: 'gray' }}>&lt;POI&gt;</span>}
          {speechIdToPositionName[positionId]} 
        </span>
        <span
          style={{
            fontSize: '14px',
            position: 'relative', // positionを追加
            zIndex: 100,
            color: /thank|Thank you|proud/.test(text) ? 'red' : 'inherit', // テキストに'thank','Thank you','proud'が含まれている場合、文字色を赤にする
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

export default NodeAsr;