"use client";

import React, { useEffect, forwardRef } from 'react';
import ReactFlow, { useNodesState, useEdgesState } from 'reactflow';
import { govNode, oppNode, GovEdge, OppEdge, backgroundNode } from './CustomMacroGraphComponents';
import { speechIdToPositionNameAsian, speechIdToPositionNameNA, isGovernmentFromSpeechId } from '../../../components/lib/constants';

import 'reactflow/dist/style.css'; //必須中の必須！！！注意！！！

const nodeTypes = { "govNode": govNode, "oppNode": oppNode, "backgroundNode": backgroundNode };
const edgeTypes = { "govEdge": GovEdge, "oppEdge": OppEdge };

const nodeTypeMap: { [key: number]: string } = {}; // sequence_id をキー、nodeType を値とするオブジェクト

interface Rebuttal {
    src: number;
    tgt: number;
}

interface MacroStructureProps {
    data: any;
    onGraphNodeClicked: any;
    isPinned: boolean;
}

const MacroStructure = forwardRef<HTMLDivElement, MacroStructureProps>(({ data, onGraphNodeClicked, isPinned }, ref) => {
    let repeatedNum = 1; //TODO: 10回分取得して特徴量出すのは重すぎるので、DBレベルで確信度という指標に落とし込む

    const originY = 0;
    const [nodes, setNodes, onNodesChange] = useNodesState([]); //将来的にノード・エッジの追加や編集機能を追加する
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {

        const poiArgUnitIds = data.pois.map((poi: { argument_unit_id: number }) => poi.argument_unit_id);

        //ノードの初期化
        const newNodes = [];

        let nodeY = originY;
        for (let i = 0; i < data.speeches.length; i++) {
            const speechLength = data.speeches.length;
            const originX = 100;
            const xposOpp = 300;
            const isGovernment = isGovernmentFromSpeechId(i, speechLength);
            const speechIdToPositionName = speechLength == 6 ? speechIdToPositionNameNA : speechIdToPositionNameAsian;

            let startNodeY = nodeY;

            for (let j = 0; j < data.speeches[i].argument_units.length; j++) {
                if (speechIdToPositionName[i] === "LOR" && j == 0) {
                    nodeY += 10;
                    startNodeY = nodeY;
                }

                const finalIsGovernment = poiArgUnitIds.includes(data.speeches[i].argument_units[j].sequence_id) ? !isGovernment : isGovernment;

                const nodeType = finalIsGovernment ? "govNode" : "oppNode";
                const argumentUnit = data.speeches[i].argument_units[j];
                //2025/03/01: とりあえずAPI側でargument_units[i].textは送信しないことにした

                nodeTypeMap[argumentUnit.sequence_id] = nodeType;

                newNodes.push({ id: "adu-" + argumentUnit.sequence_id.toString(), type: nodeType, position: { x: originX + xposOpp * +!finalIsGovernment, y: nodeY }, data: { sequence_id: argumentUnit.sequence_id, label: argumentUnit.sequence_id.toString(), round_id: data.roundId, time: argumentUnit.start, isBackground: false } });
                nodeY += 8;
            }

            const endNodeY = nodeY;

            newNodes.unshift({ id: "speech-" + i.toString(), type: "backgroundNode", position: { x: originX + xposOpp * +!isGovernment, y: startNodeY }, data: { height: endNodeY - startNodeY, isGovernment: isGovernment, isBackground: true } });
        }
        setNodes(newNodes);

        //エッジの前処理
        // console.log(dataRebuttals2Tuples(data.rebuttals));
        // console.log(getRallyIds(dataRebuttals2Tuples(data.rebuttals)));

        //エッジの初期化
        const newEdges = [];

        let isTfBase = true;

        const rebuttalCandidates = data.rebuttals;
        const rebuttalDict: { [key: string]: number } = {};
        for (let i = 0; i < rebuttalCandidates.length; i++) {
            const rebuttal = rebuttalCandidates[i];
            const rebKey = JSON.stringify({ src: rebuttal.src, tgt: rebuttal.tgt });
            if (rebuttalDict[rebKey] === undefined) {
                rebuttalDict[rebKey] = 1;
            } else {
                rebuttalDict[rebKey]++;
                isTfBase = false;
            }
        }

        const repeatedRebuttals: Rebuttal[] = Object.keys(rebuttalDict)
            .filter(key => rebuttalDict[key] >= repeatedNum)
            .map(key => JSON.parse(key) as Rebuttal);

        // 使用するリバッタルリストを選択
        const rebuttalsToUse = isTfBase ? data.rebuttals : repeatedRebuttals;

        for (let i = 0; i < rebuttalsToUse.length; i++) {
            const rebuttal = rebuttalsToUse[i];
            const srcSequenceId = rebuttal.src;
            const tgtSequenceId = rebuttal.tgt;

            // ソースノードのタイプを取得
            const srcNodeType = nodeTypeMap[srcSequenceId];

            // ソースノードが'govNode'の場合のみエッジを追加
            if (srcNodeType === "govNode") {
                newEdges.push({
                    id: `edge-${srcSequenceId}-${tgtSequenceId}`,
                    source: "adu-" + srcSequenceId.toString(),
                    target: "adu-" + tgtSequenceId.toString(),
                    type: "govEdge",
                });
            } else {
                newEdges.push({
                    id: `edge-${srcSequenceId}-${tgtSequenceId}`,
                    source: "adu-" + srcSequenceId.toString(),
                    target: "adu-" + tgtSequenceId.toString(),
                    type: "oppEdge",
                });
            }
        }

        setEdges(newEdges);
    }, []);

    const handleNodeClick = (node: any) => { //薄い部分をクリックすると手前に出てくるバグ
        // console.log(node.data);
        if (!node.data.isBackground) {
            onGraphNodeClicked(node.data.round_id, node.data.time, node.data.sequence_id);
        }
    }

    const proOptions = { hideAttribution: true };

    return (
        <div ref={ref} style={{ cursor: "default", width: '100%', height: '100%' }}>
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
                // panOnScroll
                // panOnDrag={[1, 2]}
                panOnScroll={false} // スクロールによるパンを無効化
                zoomOnScroll={false} // スクロールによるズームを無効化
                zoomOnPinch={false} // ピンチによるズームを無効化
                panOnDrag={false} // ドラッグによるパンを無効化
                zoomOnDoubleClick={false} // ダブルクリックによるズームを無効化
                fitView
                proOptions={proOptions}

                // onNodeClick={(event, node) => handleNodeClick(node)}
                onNodeContextMenu={(event, node) => {
                    event.preventDefault(); // デフォルトの右クリックメニューを表示しない
                    if(!isPinned){
                        return;
                    }
                    handleNodeClick(node);
                }}
            >
                {/* <Controls /> */}
                {/* <Background variant={BackgroundVariant.Dots} gap={12} size={1} /> */}
            </ReactFlow>
        </div>
    );
});

MacroStructure.displayName = 'MacroStructure';

export default MacroStructure;