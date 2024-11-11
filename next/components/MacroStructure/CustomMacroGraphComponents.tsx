import React from 'react';
import { Handle, Position } from "reactflow";
import { BaseEdge, getBezierPath, getStraightPath, getSmoothStepPath, getSimpleBezierPath } from 'reactflow';

// Macroの方ではRootNodeは不要

export const govNode = ({ data }: { data: any }) => {
  return (
    <div style={{ width: '8rem', height: '0.5rem', backgroundColor: 'black', borderWidth: '1px', borderColor: 'gray' }}>
      <span style={{ position: 'absolute', top: '50%', right: '7px', transform: 'translateY(-50%)', zIndex: 1 }}>
        <Handle type="target" id="tgt" position={Position.Right} style={{ opacity: 0 }} />
        <Handle type="source" id="src" position={Position.Right} style={{ opacity: 0 }} />
      </span>
    </div>

  );
};

export const oppNode = ({ data }: { data: any }) => {
  return (
    <div style={{ width: '8rem', height: '0.5rem', backgroundColor: 'black', borderWidth: '1px', borderColor: 'gray' }}>
      <span style={{ position: 'absolute', top: '50%', left: '7px', transform: 'translateY(-50%)', zIndex: 1 }}>
        <Handle type="target" id="tgt" position={Position.Left} style={{ opacity: 0 }} />
        <Handle type="source" id="src" position={Position.Left} style={{ opacity: 0 }} />
      </span>
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

interface ColoredEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data?: {
    color: string;
  }
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

export function ColoredEdge({ id, sourceX, sourceY, targetX, targetY, data }: ColoredEdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: data?.color, strokeWidth: 2 }} />
    </>
  );
}