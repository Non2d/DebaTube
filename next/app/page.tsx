// import DebateFlow from '../components/ReactFlow/DebateFlow';
'use client';

import DebateFlowMacro from '../components/DebateGraph/DebateFlowMacro';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <DebateFlowMacro roundId={75} />
        <DebateFlowMacro roundId={75} />
        <DebateFlowMacro roundId={75} />
        <DebateFlowMacro roundId={75} />
        {/* <DebateFlowMacro roundId={56} />
        <DebateFlowMacro roundId={57} />
        <DebateFlowMacro roundId={58} /> */}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {/* <DebateFlowMacro roundId={59} />
        <DebateFlowMacro roundId={60} />
        <DebateFlowMacro roundId={61} />
        <DebateFlowMacro roundId={62} /> */}
      </div>
    </div>
  );
}
