import React, { useEffect, useState } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    BackgroundVariant,
    type Node,
    type Edge,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import { DefaultEdge, govNodeD, oppNodeD } from './CustomDetailedGraphComponents';
import NodeTimeLabel from '../Diarization/NodeTimeLabel';
import { isGovernmentFromSpeechId } from '../utils/speechIdToPositionName';

interface DetailedStructureProps {
    roundId: number;
}

import { apiRoot } from '../../components/utils/foundation';

const DetailedStructure: React.FC<DetailedStructureProps> = ({ roundId }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const defaultViewport: any = { x: 0, y: 60, zoom: 1 };
    const [ytPlayer, setYtPlayer] = useState<YT.Player>();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [rebuttals, setRebuttals] = useState<Edge[]>([]);
    const [timeLabelNodes, setTimeLabelNodes] = useState<Node[]>([]);
    const [argNodes, setArgNodes] = useState<Node[]>([]);
    const zoomLevel = 1;

    const setArgumentUnits = (speeches:any) => {
        const newDebateNodes: Node[] = [];

        // console.log(speeches);

        const initArgId = speeches[0].argument_units[0].id;

        for (let i = 0; i < speeches.length; i++) {
            const isGovernment = isGovernmentFromSpeechId(i, speeches.length);
            speeches[i].argument_units.forEach((argUnit: any) => {
                // console.log(argUnit);
                const argId = argUnit.id - initArgId;
                newDebateNodes.push({
                    id: `arg-${argId}`,
                    type: isGovernment ? 'govNodeD' : 'oppNodeD',
                    data: { sequenceId: argId, text: argUnit.text, width: 1000, height: zoomLevel*(argUnit.end-argUnit.start)},
                    position: { x: 100 + (isGovernment?0:1300), y: zoomLevel*argUnit.start },
                });
            });
        }
        // console.log(newDebateNodes);
        setArgNodes(newDebateNodes);
    }

    const setRebuttalEdges = (rebuttals:any) => {
        const newRebuttals: Edge[] = [];
        rebuttals.forEach((rebuttal:any) => {
            newRebuttals.push({
                id: `reb-${rebuttal.id}`,
                source: `arg-${rebuttal.src}`,
                target: `arg-${rebuttal.tgt}`,
            });
        });
        // console.log(newRebuttals);
        setRebuttals(newRebuttals);
    }

    const fetchData = async () => {
        try {
            const response = await fetch(apiRoot+`/rounds/${roundId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setData(data);
            setArgumentUnits(data.speeches);
            setRebuttalEdges(data.rebuttals);

            setLoading(false);
        } catch (error: any) {
            setError(error.message);
            setLoading(false);
        }
    };

    const setTimeLabels = () => {
        const interval = 5;
        const duration = 180 * zoomLevel;
        const newTimeLabelNodes: Node[] = [];

        for (let i = 0; i <= duration; i += interval) {
            const nodeId = `tl-${i + 1}`;
            const nodeExists = nodes.some(node => node.id === nodeId);
            newTimeLabelNodes.push({
                id: nodeId,
                type: 'NodeTimeLabel',
                data: { seconds: i * 60 / zoomLevel, ytPlayer: ytPlayer },
                position: { x: 0, y: -13 + i * 60 },
            });
        }

        setTimeLabelNodes(newTimeLabelNodes);
    }

    useEffect(() => {
        setTimeLabels();
    }, []);

    useEffect(() => {
        fetchData();
    }, [roundId]);

    useEffect(() => {
        setNodes([...timeLabelNodes, ...argNodes]);
    }, [timeLabelNodes, argNodes]);

    useEffect(() => {
        setEdges([...rebuttals]);
    }, [rebuttals]);


    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div style={{ width: '100vw', height: '90vh' }}>
            {/* コンポーネントの内容 */}
            <ReactFlow
                nodes={nodes}
                nodeTypes={{ NodeTimeLabel: NodeTimeLabel, govNodeD: govNodeD, oppNodeD: oppNodeD }}
                edges={edges}
                edgeTypes={{ default: DefaultEdge}}
                panOnScroll
                defaultViewport={defaultViewport} // デフォルトのカメラの座標を指定
            >
                <MiniMap zoomable />
                <Controls />
                <Background
                    variant={BackgroundVariant.Lines}
                    gap={[10000, 60]}
                    lineWidth={2}
                />
            </ReactFlow>
        </div>
    );
};

export default DetailedStructure;