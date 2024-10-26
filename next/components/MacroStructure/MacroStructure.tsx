"use client";

import React, { useState, useEffect } from 'react';
import ReactFlow, { useNodesState, useEdgesState, Controls, Background, BackgroundVariant } from 'reactflow';
import { govNode, oppNode, DefaultEdge } from './CustomMacroGraphComponents';
import { speechIdToPositionNameAsian, speechIdToPositionNameNA, isGovernmentFromSpeechId } from '../utils/speechIdToPositionName';
import { dataRebuttals2Tuples, getRallyIds } from './ModelDebate';

import { apiRoot } from '../../components/utils/foundation';

import 'reactflow/dist/style.css'; //必須中の必須！！！注意！！！

const nodeTypes = { "govNode": govNode, "oppNode": oppNode };
const edgeTypes = { "default": DefaultEdge };

export default function MacroStructure({ roundId }: { roundId: number }) {
    const originY = 0;
    const [nodes, setNodes, onNodesChange] = useNodesState([]); //将来的にノード・エッジの追加や編集機能を追加する
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        fetch(apiRoot+`/rounds/${roundId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })
            .then(response => response.json())
            .then(data => {
                //ノードの初期化
                const newNodes = [];

                let nodeY = originY;
                for (let i = 0; i < data.speeches.length; i++) {
                    const speechLength = data.speeches.length;
                    const originX = 100;
                    const xposOpp = 300;
                    const isGovernment = isGovernmentFromSpeechId(i, speechLength);
                    const nodeType = isGovernment ? "govNode" : "oppNode";
                    for (let j = 0; j < data.speeches[i].argument_units.length; j++) {
                        const argumentUnit = data.speeches[i].argument_units[j];
                        const speechIdToPositionName = speechLength == 6 ? speechIdToPositionNameNA : speechIdToPositionNameAsian;
                        if (speechIdToPositionName[i] === "LOR" && j==0) {
                            nodeY+=30;
                        }
                        newNodes.push({ id: "adu-" + argumentUnit.sequence_id.toString(), type: nodeType, position: { x: originX + xposOpp * +!isGovernment, y: nodeY }, data: { label: argumentUnit.sequence_id.toString() } });
                        nodeY += 8;
                    }
                }
                setNodes(newNodes);

                //エッジの前処理
                // console.log(dataRebuttals2Tuples(data.rebuttals));
                console.log(getRallyIds(dataRebuttals2Tuples(data.rebuttals)));

                //エッジの初期化
                const newEdges = [];
                for (let i = 0; i < data.rebuttals.length; i++) {
                    const rebuttal = data.rebuttals[i];
                    const rallyIds = getRallyIds(dataRebuttals2Tuples(data.rebuttals));
                    if(rallyIds.includes(i)){
                        newEdges.push({ id: "edge-" + i.toString(), source: "adu-" + rebuttal.src.toString(), target: "adu-" + rebuttal.tgt.toString(), type: "default", animated: true, style: { stroke: 'pink' }});
                        continue;
                    }
                    newEdges.push({ id: "edge-" + i.toString(), source: "adu-" + rebuttal.src.toString(), target: "adu-" + rebuttal.tgt.toString(), type: "default", animated: true});
                }

                setEdges(newEdges);
            })
            .catch(error => console.error('Error fetching data:', error));
    }, [roundId]);

    return (
        <div style={{ width: '100%', height: '70vh' }}>
            
            {/* <button onClick={onAddNode}>ノードを追加</button> */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange} //グラフ編集機能(現在は未実装)
                onEdgesChange={onEdgesChange}
                // onConnect={onConnect}
                nodesDraggable={false}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                panOnScroll
                panOnDrag={[1, 2]}
                fitView
            >
                <Controls />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
        </div>
    );
}