import React from 'react';
import { Handle, Position } from "reactflow";
import { BaseEdge, getStraightPath } from 'reactflow';

export const govNode = ({ data }: { data: any }) => {
  // POI色分けは常にON：赤色
  const bgClass = "bg-red-600 dark:bg-red-400";
  // POI時は右、通常時は左
  const nodeIdPosition = data.isPoi ? 'right' : 'left';
  const nodeIdStyle = data.isPoi ? { right: '-25px' } : { left: '-25px' };

  return (
    <div style={{ position: 'relative', height: '8px', display: 'flex', alignItems: 'center' }}>
      <div
        className={bgClass}
        style={{
          width: '8rem',
          height: '0.4rem',
        }}>
        <span style={{ position: 'absolute', top: '50%', right: '5px', transform: 'translateY(-50%)', zIndex: 1 }}>
          <Handle type="target" id="tgt" position={Position.Right} style={{ opacity: 0 }} />
          <Handle type="source" id="src" position={Position.Right} style={{ opacity: 0 }} />
        </span>
      </div>
      {data.showNodeIds && data.label && (
        <span
          className="text-[#333] dark:text-gray-200"
          style={{
            position: 'absolute',
            ...nodeIdStyle,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px',
            fontWeight: 500,
          }}>
          {data.label}
        </span>
      )}
    </div>
  );
};

export const oppNode = ({ data }: { data: any }) => {
  // POI色分けは常にON：青色
  const bgClass = "bg-[#0065bd] dark:bg-blue-400";
  // POI時は左、通常時は右
  const nodeIdStyle = data.isPoi ? { left: '-25px' } : { right: '-25px' };

  return (
    <div style={{ position: 'relative', height: '8px', display: 'flex', alignItems: 'center' }}>
      <div
        className={bgClass}
        style={{
          width: '8rem',
          height: '0.4rem',
        }}>
        <span style={{ position: 'absolute', top: '50%', left: '5px', transform: 'translateY(-50%)', zIndex: 1 }}>
          <Handle type="target" id="tgt" position={Position.Left} style={{ opacity: 0 }} />
          <Handle type="source" id="src" position={Position.Left} style={{ opacity: 0 }} />
        </span>
      </div>
      {data.showNodeIds && data.label && (
        <span
          className="text-[#333] dark:text-gray-200"
          style={{
            position: 'absolute',
            ...nodeIdStyle,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px',
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
    <div
      className={data.isGovernment ? "bg-pink-200 dark:bg-red-700" : "bg-blue-200 dark:bg-blue-700"}
      style={{
        width: '8rem',
        height: `${data.height - 1}px`,
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
      <BaseEdge id={id} path={edgePath} style={{ stroke: 'var(--gov-edge-color)', strokeWidth: 2 }} />
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
      <BaseEdge id={id} path={edgePath} style={{ stroke: 'var(--opp-edge-color)', strokeWidth: 2 }} />
    </>
  );
}
