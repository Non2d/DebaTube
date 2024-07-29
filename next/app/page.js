// import DebateFlow from '../components/ReactFlow/DebateFlow';
'use client';

import Header from '../components/utils/Header';
import DebateFlowMacro from '../components/ReactFlow/DebateFlowMacro';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <DebateFlowMacro roundId={55} />
        <DebateFlowMacro roundId={56} />
        <DebateFlowMacro roundId={57} />
        <DebateFlowMacro roundId={58} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <DebateFlowMacro roundId={59} />
        <DebateFlowMacro roundId={60} />
        <DebateFlowMacro roundId={61} />
        <DebateFlowMacro roundId={62} />
      </div>
    </div>
  );
}
