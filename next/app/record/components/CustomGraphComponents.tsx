import React from 'react';
import { Handle, Position } from "reactflow";
import { BaseEdge, getStraightPath } from 'reactflow';

export const govNode = ({ data }: { data: any }) => {
  return (
    <div style={{
      width: '8rem',
      height: '0.4rem',
      backgroundColor: "red",
    }}>
      <span style={{ position: 'absolute', top: '50%', right: '5px', transform: 'translateY(-50%)', zIndex: 1 }}>
        <Handle type="target" id="tgt" position={Position.Right} style={{ opacity: 0 }} />
        <Handle type="source" id="src" position={Position.Right} style={{ opacity: 0 }} />
      </span>
    </div>
  );
};

export const oppNode = ({ data }: { data: any }) => {
  return (
    <div style={{
      width: '8rem',
      height: '0.4rem',
      backgroundColor: "#0065bd",
    }}>
      <span style={{ position: 'absolute', top: '50%', left: '5px', transform: 'translateY(-50%)', zIndex: 1 }}>
        <Handle type="target" id="tgt" position={Position.Left} style={{ opacity: 0 }} />
        <Handle type="source" id="src" position={Position.Left} style={{ opacity: 0 }} />
      </span>
    </div>
  );
};

export const backgroundNode = ({ data }: { data: any }) => {
  return (
    <div style={{
      width: '8rem',
      height: `${data.height - 1}px`,
      backgroundColor: data.isGovernment ? "pink" : "lightblue",
    }}>
    </div>
  );
}

interface DefaultEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export function GovEdge({ id, sourceX, sourceY, targetX, targetY }: DefaultEdgeProps) {
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

export function OppEdge({ id, sourceX, sourceY, targetX, targetY }: DefaultEdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: '#0065bd', strokeWidth: 2 }} />
    </>
  );
}
