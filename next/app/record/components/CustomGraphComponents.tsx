import React from 'react';
import { Handle, Position } from "reactflow";
import { BaseEdge, getStraightPath } from 'reactflow';

export const govNode = ({ data }: { data: any }) => {
  // POI色分けが無効でPOIノードの場合は青色（元のチーム色）、それ以外は赤色
  const backgroundColor = (!data.showPoiColors && data.isPoi) ? "#0065bd" : "red";

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        width: '8rem',
        height: '0.4rem',
        backgroundColor: backgroundColor,
      }}>
        <span style={{ position: 'absolute', top: '50%', right: '5px', transform: 'translateY(-50%)', zIndex: 1 }}>
          <Handle type="target" id="tgt" position={Position.Right} style={{ opacity: 0 }} />
          <Handle type="source" id="src" position={Position.Right} style={{ opacity: 0 }} />
        </span>
      </div>
      {data.showNodeIds && data.label && (
        <span style={{
          position: 'absolute',
          left: '-25px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '10px',
          color: '#333',
          fontWeight: 500,
        }}>
          {data.label}
        </span>
      )}
    </div>
  );
};

export const oppNode = ({ data }: { data: any }) => {
  // POI色分けが無効でPOIノードの場合は赤色（元のチーム色）、それ以外は青色
  const backgroundColor = (!data.showPoiColors && data.isPoi) ? "red" : "#0065bd";

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        width: '8rem',
        height: '0.4rem',
        backgroundColor: backgroundColor,
      }}>
        <span style={{ position: 'absolute', top: '50%', left: '5px', transform: 'translateY(-50%)', zIndex: 1 }}>
          <Handle type="target" id="tgt" position={Position.Left} style={{ opacity: 0 }} />
          <Handle type="source" id="src" position={Position.Left} style={{ opacity: 0 }} />
        </span>
      </div>
      {data.showNodeIds && data.label && (
        <span style={{
          position: 'absolute',
          right: '-25px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '10px',
          color: '#333',
          fontWeight: 500,
        }}>
          {data.label}
        </span>
      )}
    </div>
  );
};

export const backgroundNode = ({ data }: { data: any }) => {
  return (
    <div style={{
      width: '8rem',
      height: `${data.height - 1}px`,
      backgroundColor: data.isGovernment ? "pink" : "lightblue",
      pointerEvents: 'none',
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
