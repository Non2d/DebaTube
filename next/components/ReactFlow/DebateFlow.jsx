"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';

import CustomNode from './CustomNode';
import RootNode from './RootNode';
import GovNode from './GovNode';
import OppNode from './OppNode';
import CustomEdge from './CustomEdge';
import initialNodes from './nodes';
import initialEdges from './edges';

import 'reactflow/dist/style.css';
import 'tailwindcss/tailwind.css';

export default function DebateFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodeTypes = useMemo(() => ({ customNode: CustomNode, rootNode: RootNode, govNode: GovNode, oppNode: OppNode }), []);
  const edgeTypes = useMemo(() => ({ customEdge: CustomEdge }), []);

  const consoleSize = () => {
    let height = 0;
    for (let node of nodes) {
      if (node.height === undefined) {
        return;
      }
      // console.log(height, node.height);
      node.position.y = height;
      height += parseInt(node.height) + 10;
    }
  };

  const onConnect = useCallback(
    (connection) => {
      const edge = { ...connection, type: 'customEdge', animated: true };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges],
  );

  const [uniqueId, setUniqueId] = useState(0);
  const onAddNode = () => {
    //ランダムな文を生成
    const words = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew', 'ice', 'jackfruit', 'kiwi', 'lemon', 'mango', 'nectarine', 'orange', 'pineapple', 'quince', 'raspberry', 'strawberry', 'tangerine', 'ugli', 'victoria', 'watermelon', 'xigua', 'yellow', 'zucchini'];
    let sentenceLength = Math.floor(5+Math.random()*25); // Change this to the desired sentence length
    let sentence = '';
    for (let i = 0; i < sentenceLength; i++) {
      const randomIndex = Math.floor(Math.random() * words.length);
      sentence += words[randomIndex] + ' ';
    }
    sentence = sentence.trim() + '.';

    // Create a new node
    const newNode = { id: "new" + uniqueId, type: "oppNode", position: { x: 700, y: 0 }, data: { label: sentence }, height: 100 };
    setUniqueId(uniqueId + 1);
    // Add the new node to the elements array
    setNodes(nodes => [...nodes, newNode]);
  };

  return (
    consoleSize(),
    <div style={{ width: '100vw', height: '100vh' }}>
      <h1>This is Developper. Debate Flow</h1>
      <button onClick={onAddNode}>Add Node</button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodesDraggable={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}