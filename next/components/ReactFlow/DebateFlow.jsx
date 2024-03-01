"use client";
import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';

import CustomNode from './CustomNode';
 
import 'reactflow/dist/style.css';
import 'tailwindcss/tailwind.css';
 
const initialNodes = [
  { id: '1', type:"customNode", position: { x: 0, y: 0 }, data: { label: '1' } },
  { id: '2', position: { x: 0, y: 100 }, data: { label: 'This is a debate about the individuals whom politics has forgotten.' } },
  { id: '3', position: { x: 0, y: 200 }, data: { label: 'React+D3.jsアプリ作成の基本は React で作った DOM 要素を、D3 関数に渡してチャートを描くことです。DOM 要素を作り出すまでは React の仕事で、その DOM 要素をもらってチャート描くのは D3 の仕事です。' } },
  { id: '4', position: { x: 0, y: 300 }, data: { label: 'React+D3.jsアプリ作成の基本は React で作った DOM 要素を、D3 関数に渡してチャートを描くことです。DOM 要素を作り出すまでは React の仕事で、その DOM 要素をもらってチャート描くのは D3 の仕事です。' } }
];
const initialEdges = [{}];
 
export default function DebateFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodeTypes = useMemo(() => ({ customNode: CustomNode }), []);
 
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );
 
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodesDraggable={false}
        nodeTypes={nodeTypes}
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}