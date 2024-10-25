import React from 'react';
import { Handle, Position } from "@xyflow/react";
import { BaseEdge, getBezierPath, getStraightPath, getSmoothStepPath, getSimpleBezierPath } from '@xyflow/react';

// Macroの方ではRootNodeは不要

interface ArgumentUnit {
  sequenceId: number;
  text: string;
  width: number;
  height: number;
}

export const govNodeD = ({ data }: { data: ArgumentUnit }) => {
  return (
    <div
      className="text-sm text-justify pl-4 pr-4 border border-gray-500 rounded flex items-start w-[40vw] bg-white"
      style={{
        width: `${data.width}px`,
        height: `${data.height}px`
      }}
    >
      {data.text}
      <div style={{ position: 'absolute', top: '50%', right: '-30px', transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>
        {/* Debug Id Display */}
        {data.sequenceId} 
      </div>
      <Handle type="target" position={Position.Right} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
};


export const oppNodeD = ({ data }: { data: ArgumentUnit }) => {
  return (
    <div
      className="text-sm text-justify pl-4 pr-4 border border-gray-500 rounded flex items-start w-[40vw] bg-white"
      style={{
        width: `${data.width}px`,
        height: `${data.height}px`
      }}
    >
      {data.text}
      <div style={{ position: 'absolute', top: '50%', left: '-30px', transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>
        {/* Debug Id Display */}
        {data.sequenceId} 
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Left} />
    </div>
  );
};

interface DefaultEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export function DefaultEdge({ id, sourceX, sourceY, targetX, targetY }: DefaultEdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: 'red', strokeWidth: 2 }} />
    </>
  );
}