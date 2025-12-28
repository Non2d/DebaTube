import React from 'react';
import { Handle, Position } from "reactflow";
import { BaseEdge, getStraightPath } from 'reactflow';

export const govNode = ({ data }: { data: any }) => {
  // POI色分けが無効でPOIノードの場合は青色（元のチーム色）、それ以外は赤色
  const isBlue = (!data.showPoiColors && data.isPoi);
  const bgClass = isBlue ? "bg-[#0065bd] dark:bg-blue-400" : "bg-red-600 dark:bg-red-400";

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
            left: '-25px',
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
  // POI色分けが無効でPOIノードの場合は赤色（元のチーム色）、それ以外は青色
  const isRed = (!data.showPoiColors && data.isPoi);
  const bgClass = isRed ? "bg-red-600 dark:bg-red-400" : "bg-[#0065bd] dark:bg-blue-400";

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
            right: '-25px',
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
