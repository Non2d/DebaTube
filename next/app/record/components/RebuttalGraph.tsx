"use client";

import React, { useEffect, useRef } from 'react';
import ReactFlow, { useNodesState, useEdgesState } from 'reactflow';
import { govNode, oppNode, backgroundNode, GovEdge, OppEdge } from './CustomGraphComponents';
import { isGovernmentFromSpeechId } from '../../../components/lib/constants';

import 'reactflow/dist/style.css';

const nodeTypes = { "govNode": govNode, "oppNode": oppNode, "backgroundNode": backgroundNode };
const edgeTypes = { "govEdge": GovEdge, "oppEdge": OppEdge };

interface Rebuttal {
  src: number;
  tgt: number;
}

interface GraphDataJson {
  speeches: { [key: string]: any[] };
  rebuttals: [number, number][];
}

interface RebuttalGraphProps {
  data: GraphDataJson;
  onNodeClick?: (nodeId: number, startTime: number) => void;
  debateFormat?: string;
  showNodeIds?: boolean;
  showPoiColors?: boolean;
}

const RebuttalGraph: React.FC<RebuttalGraphProps> = ({ data, onNodeClick, debateFormat, showNodeIds = true, showPoiColors = true }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodeDataRef = useRef<{ [key: number]: { startTime: number } }>({});

  useEffect(() => {
    try {
      const nodeTypeMap: { [key: number]: string } = {};
      const poiNodeMap: { [key: number]: boolean } = {};

      // キー名を討論順序にソートする関数
      const getSpeechOrder = (key: string): number => {
        // Prop1, Prop2, etc. または Proposition_1st, Proposition_2nd, etc.
        const propMatch = key.match(/^Prop(?:osition)?[_\s]*(\d+|1st|2nd|3rd|4th)/i);
        // Opp1, Opp2, etc. または Opposition_1st, Opposition_2nd, etc.
        const oppMatch = key.match(/^Opp(?:osition)?[_\s]*(\d+|1st|2nd|3rd|4th)/i);

        const ordinalToNumber = (ordinal: string): number => {
          const map: { [key: string]: number } = {
            '1st': 1, '2nd': 2, '3rd': 3, '4th': 4,
            '1': 1, '2': 2, '3': 3, '4': 4
          };
          return map[ordinal.toLowerCase()] || 0;
        };

        if (propMatch) {
          const num = ordinalToNumber(propMatch[1]);
          // Prop 1st -> 0, Prop 2nd -> 2, Prop 3rd/4th -> 4 or 6
          return (num - 1) * 2;
        } else if (oppMatch) {
          const num = ordinalToNumber(oppMatch[1]);
          // Opp 1st -> 1, Opp 2nd -> 3, Opp 3rd/4th -> 5 or 7
          return (num - 1) * 2 + 1;
        }

        return 999; // unknown format
      };

      // JSONのspeeches形式をexplore形式に変換
      const speechKeys = Object.keys(data.speeches).sort((a, b) => getSpeechOrder(a) - getSpeechOrder(b));

      // IDがローカル（各スピーチで1から始まる）かグローバル（通し番号）かを判定
      const allIds = new Set<number>();
      let hasDuplicateIds = false;
      speechKeys.forEach((key) => {
        (data.speeches[key] || []).forEach((segment: any) => {
          const id = segment.id;
          if (id !== undefined) {
            if (allIds.has(id)) {
              hasDuplicateIds = true;
            }
            allIds.add(id);
          }
        });
      });

      // IDが重複している = ローカルID形式
      const isLocalIdFormat = hasDuplicateIds;

      // ローカルIDの場合、グローバルIDへのマッピングを作成
      const localIdToGlobalId: { [speechKey: string]: { [localId: number]: number } } = {};
      let globalIdCounter = 1;

      if (isLocalIdFormat) {
        speechKeys.forEach((key) => {
          localIdToGlobalId[key] = {};
          (data.speeches[key] || []).forEach((segment: any, idx: number) => {
            const localId = segment.id !== undefined ? segment.id : idx + 1;
            localIdToGlobalId[key][localId] = globalIdCounter++;
          });
        });
      }

      const convertedSpeeches = speechKeys.map((key) => ({
        argument_units: (data.speeches[key] || []).map((segment: any, idx: number) => {
          const id = segment.id !== undefined ? segment.id : idx + 1;
          const globalId = isLocalIdFormat ? localIdToGlobalId[key][id] : id;
          return {
            sequence_id: globalId,
            original_id: id, // Store original DB ID
            start: segment.start || 0,
            type: segment.type || '',
          };
        }),
      }));

      // ノードの初期化
      const newNodes = [];
      let nodeY = 0;
      const originY = 0;
      const originX = 100;
      const xposOpp = 300;

      // Opposition側のスピーチインデックスを特定
      const speechLength = convertedSpeeches.length;
      const oppIndices: number[] = [];
      for (let i = 0; i < speechLength; i++) {
        if (!isGovernmentFromSpeechId(i, speechLength, debateFormat)) {
          oppIndices.push(i);
        }
      }
      const secondLastOppIndex = oppIndices.length >= 2 ? oppIndices[oppIndices.length - 2] : -1;

      for (let i = 0; i < convertedSpeeches.length; i++) {
        const isGovernment = isGovernmentFromSpeechId(i, speechLength, debateFormat);
        let startNodeY = nodeY;

        const argumentUnits = convertedSpeeches[i].argument_units;
        for (let j = 0; j < argumentUnits.length; j++) {
          const argumentUnit = argumentUnits[j];
          // POIの場合は相手チームの色を使用
          const isPoi = argumentUnit.type === 'poi';
          const nodeType = isPoi
            ? (isGovernment ? "oppNode" : "govNode")
            : (isGovernment ? "govNode" : "oppNode");

          nodeTypeMap[argumentUnit.sequence_id] = nodeType;
          poiNodeMap[argumentUnit.sequence_id] = isPoi;

          newNodes.push({
            id: "adu-" + argumentUnit.sequence_id.toString(),
            type: nodeType,
            position: { x: originX + xposOpp * +!isGovernment, y: nodeY },
            data: {
              sequence_id: argumentUnit.sequence_id,
              original_id: argumentUnit.original_id, // Store original ID in node data
              label: argumentUnit.sequence_id.toString(),
              time: argumentUnit.start,
              isBackground: false,
              isPoi: isPoi,
              showNodeIds: showNodeIds,
              showPoiColors: showPoiColors,
            },
          });
          // ノードの start_time をリファレンスに保存
          nodeDataRef.current[argumentUnit.sequence_id] = {
            startTime: argumentUnit.start,
          };
          nodeY += 8;
        }

        const endNodeY = nodeY;
        newNodes.unshift({
          id: "speech-" + i.toString(),
          type: "backgroundNode",
          position: { x: originX + xposOpp * +!isGovernment, y: startNodeY },
          data: { height: endNodeY - startNodeY, isGovernment: isGovernment, isBackground: true },
          selectable: false,
          connectable: false,
          zIndex: -1,
        });

        // Opposition側の最後から2番目のスピーチの後に間隔を入れる
        if (i === secondLastOppIndex) {
          nodeY += 20;
        }
      }

      setNodes(newNodes);

      // エッジの初期化
      const newEdges = [];
      let isTfBase = true;

      // 同じチーム内での反論を除外、かつPOIノードからの反論とPOIノードへの反論も除外
      const filteredRebuttals = data.rebuttals.filter(([src, tgt]) => {
        const srcNodeType = nodeTypeMap[src];
        const tgtNodeType = nodeTypeMap[tgt];
        const isSrcPoi = poiNodeMap[src];
        const isTgtPoi = poiNodeMap[tgt];
        // 異なるチーム間の反論のみを保持、かつソースとターゲットがPOIでない
        return srcNodeType !== tgtNodeType && !isSrcPoi && !isTgtPoi;
      });

      // 1つのADUから複数の反論がある場合、最新の発言(idの大きいADU)への反論だけを採用
      const latestRebuttalsMap: { [src: number]: number } = {};
      filteredRebuttals.forEach(([src, tgt]) => {
        if (!latestRebuttalsMap[src] || tgt > latestRebuttalsMap[src]) {
          latestRebuttalsMap[src] = tgt;
        }
      });

      const dedicatedRebuttals = Object.entries(latestRebuttalsMap).map(([src, tgt]) => [parseInt(src), tgt] as [number, number]);

      const rebuttalCandidates = dedicatedRebuttals.map(([src, tgt]) => ({ src, tgt }));
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
        .filter((key) => rebuttalDict[key] >= 1)
        .map((key) => JSON.parse(key) as Rebuttal);

      const rebuttalsToUse = isTfBase ? rebuttalCandidates : repeatedRebuttals;

      for (let i = 0; i < rebuttalsToUse.length; i++) {
        const rebuttal = rebuttalsToUse[i];
        const srcSequenceId = rebuttal.src;
        const tgtSequenceId = rebuttal.tgt;

        const srcNodeType = nodeTypeMap[srcSequenceId];

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
    } catch (error) {
      console.error("Error converting graph data:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, debateFormat, showNodeIds, showPoiColors]);

  const proOptions = { hideAttribution: true };

  const handleNodeClick = (event: React.MouseEvent, node: any) => {
    if (!node.data.isBackground && onNodeClick) {
      // Use original_id (DB ID) if available, otherwise fallback to sequence_id
      const nodeId = node.data.original_id !== undefined ? node.data.original_id : node.data.sequence_id;
      const startTime = nodeDataRef.current[node.data.sequence_id]?.startTime || 0;
      onNodeClick(nodeId, startTime);
    }
  };

  return (
    <div style={{ cursor: "default", width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodesDraggable={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        panOnDrag={false}
        zoomOnDoubleClick={false}
        fitView
        proOptions={proOptions}
      />
    </div>
  );
};

export default RebuttalGraph;
