"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  SelectionMode
} from 'reactflow';

import RootNode from './RootNode';
import GovNode from './MacroGovNode';
import OppNode from './MacroOppNode';
import CustomEdge from './CustomEdge';
import fetchNodes from './nodesMacroDb';
import fetchEdges from './edgesDb';

import 'reactflow/dist/style.css';
import 'tailwindcss/tailwind.css';

const panOnDrag = [1, 2]; //ビューポート操作
const originY = 100; //原点のy座標

export default function DebateFlowMacro({roundId}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodeTypes = useMemo(() => ({ rootNode: RootNode, govNode: GovNode, oppNode: OppNode }), []);
  const edgeTypes = useMemo(() => ({ customEdge: CustomEdge }), []);
  useEffect(() => {
    fetchNodes(roundId).then(setNodes);
    fetchEdges(roundId).then(setEdges);
  }, []);

  const consoleSize = () => {
    let height = originY;
    for (let node of nodes) {
      if (node.height === undefined) {
        return;
      }
      if (node.type === "rootNode") {
        continue;
      }
      if([1,2,3].includes(node.data.initAduFlag)){
        height -= 0;
      } else if(node.data.initAduFlag == 4){
        height += 10;
      }
      node.position.y = height;
      height += parseInt(node.height);
    }
  };

  const onConnect = useCallback(
    (connection) => {
      const edge = { ...connection, type: 'customEdge', animated: true };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges],
  );

  return (
    consoleSize(),
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* <button onClick={onAddNode}>ノードを追加</button> */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodesDraggable={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnScroll
        selectionOnDrag
        panOnDrag={panOnDrag}
        selectionMode={SelectionMode.Partial}
      >
        <Controls />
        {/* <MiniMap /> */}
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}