import React from 'react';
import { Handle, Position } from "reactflow";
import { BaseEdge, getBezierPath, getStraightPath, getSmoothStepPath, getSimpleBezierPath } from 'reactflow';

// Macroの方ではRootNodeは不要

export const govNode = ({ data }: { data: any }) => {
    return (
        <div className="w-32 h-2 bg-blue-500 border-1 border-blue-400">
            <Handle type="target" id="tgt" position={Position.Right} className="w-1 h-1 bg-red-500" />
            <Handle type="source" id="src" position={Position.Right} className="w-1 h-1 bg-red-500" />
        </div>
    );
};

export const oppNode = ({ data }: { data: any }) => {
    return (
        <div className="w-32 h-2 bg-blue-500 border-1 border-blue-400">
            <Handle type="target" id="tgt" position={Position.Left} className="w-1 h-1 bg-blue-500" />
            <Handle type="source" id="src" position={Position.Left} className="w-1 h-1 bg-blue-500" />
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