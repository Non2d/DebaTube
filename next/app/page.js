// import DebateFlow from '../components/ReactFlow/DebateFlow';
'use client';

import Header from '../components/utils/Header';
import DebateFlowMacro from '../components/ReactFlow/DebateFlowMacro';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダーセクション */}
      <Header />

      {/* メインコンテンツ */}
      <DebateFlowMacro roundId={75} />
      
    </div>
  );
}
