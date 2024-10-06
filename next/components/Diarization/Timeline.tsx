import React, { useEffect, useState, useCallback, useRef, use } from 'react';
import { ReactFlow, Background, BackgroundVariant, SelectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Papa from 'papaparse';

import NodeAsr from './NodeAsr';
import NodeTimeLabel from './NodeTimeLabel';
import NodeDiarization from './NodeDiarization';

import MenuAsr from './MenuAsr';
import MenuAsrRight from './MenuAsrRight';

import nodeIdToNumber from '../utils/nodeIdToNumber';

import { useAppContext } from '../../context/context';

import { toast } from 'react-hot-toast';
import { speechIdToPositionNameAsian, speechIdToPositionNameNA } from '../utils/speechIdToPositionName';

import SidebarTimeline from './SidebarTimeline';

import Youtube from 'react-youtube';

interface AsrNodeDataProps {
    text: string;
    start: number;
    end: number;
    positionId: number;
    isPoi: boolean;
}

interface DiarizationNodeDataProps {
    speakerId: number;
    width: number;
    height: number;
}

interface TimeLabelNodeDataProps {
    seconds: number;
}

interface Node {
    id: string;
    data: any;
    position: {
        x: number;
        y: number;
    };
    type: string; // typeは存在しない可能性があるのでオプションにする
}

interface Asr {
    start: number;
    end: number;
    text: string;
}

interface Diarization {
    start: number;
    end: number;
    speaker: number;
}

interface MenuDiarizationProps {
    id: string;
    top: number;
    left: number;
    right: number;
    bottom: number;
    nodeData: any;
    type: string;
    [key: string]: any; // その他のプロパティを許可
}

function extractYoutubeVideoId(url: string): string | null {
    const match = url.match(/v=([^&]+)/);
    return match ? match[1] : null;
}

//文字起こしデータの取得・設定
const Timeline = () => {
    const [nodes, setNodes] = useState<Node[]>([]);

    const { pois, setPois, nodeTransparency, setNodeTransparency, isNA, setIsNA, zoomLevel, setZoomLevel, asrFileName, setAsrFileName, diarizationFileName, setDiarizationFileName, exportFileName, setExportFileName, youtubeLink } = useAppContext();
    const [asrs, setAsrs] = React.useState<Asr[]>([]);
    const [diarizations, setDiarizations] = React.useState<Diarization[]>([]);

    // Youtube Window
    const ytId = extractYoutubeVideoId(youtubeLink);
    const ytProps = {
        height: (400 * 9) / 16,
        width: 400,
        playerVars: {
            autoplay: 0, // 自動再生を無効
        },
    };
    const [ytPlayer, setYtPlayer] = useState<YT.Player>();

    // time labels
    const [timeLabels, setTimeLabels] = useState<Node[]>([]);

    useEffect(() => {
        const interval = 5;
        const duration = 180 * zoomLevel;
        const newTimeLabels: Node[] = [];

        for (let i = 0; i <= duration; i += interval) {
            newTimeLabels.push({
                id: `tl-${i + 1}`,
                type: 'NodeTimeLabel',
                data: { seconds: i * 60 / zoomLevel, ytPlayer: ytPlayer },
                position: { x: 0, y: -13 + i * 60 },
            });
        }

        setTimeLabels(newTimeLabels);
    }, [ytPlayer, zoomLevel]);

    // Asr
    const handleAsrFileSelect = (file: File) => {
        setAsrFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result;
            if (typeof text === 'string') {
                const parsedData = Papa.parse<Asr>(text, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true
                });
                const formattedData = parsedData.data
                    .filter(item => !isNaN(Number(item.start)) && !isNaN(Number(item.end))) // Filter out invalid entries
                    .map((item) => ({
                        start: item.start,
                        end: item.end,
                        text: item.text // Assuming item.text is the correct value
                    }));
                setAsrs(formattedData); // Store data in state
            }
        };
        reader.readAsText(file);
    };

    // Diarization
    const handleDiarizationFileSelect = (file: File) => {
        setDiarizationFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result;
            if (typeof text === 'string') {
                const parsedData = Papa.parse<Diarization>(text, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true
                });
                const formattedData = parsedData.data
                    .filter(item => !isNaN(Number(item.start)) && !isNaN(Number(item.end))) // Filter out invalid entries
                    .map((item) => {
                        const speakerString = String(item.speaker) || ''; // Ensure speaker is a string
                        const speakerNumber = parseInt(speakerString.match(/\d+/)?.[0] || '-1', 10); // Extract number from speaker string
                        return {
                            start: item.start,
                            end: item.end,
                            speaker: speakerNumber
                        };
                    })
                    .filter(item => item.speaker !== -1); // Filter out entries with invalid speaker numbers
                setDiarizations(formattedData); // Store data in state
            }
        };
        reader.readAsText(file);
    };

    //Initialize all nodes
    useEffect(() => {
        const asrNodes = asrs.map((asr, index) => {
            console.log(zoomLevel);
            const existingNode = nodes.find(node => node.id === `asr-${index}`);
            return {
                id: `asr-${index}`,
                type: 'NodeAsr',
                data: {
                    text: asr.text,
                    start: asr.start,
                    end: asr.end,
                    positionId: existingNode?.data.positionId,
                    isPoi: existingNode?.data.isPoi
                },
                position: { x: 90, y: zoomLevel * asr.start },
            }
        });
        const diarizationNodes = diarizations.map((diarization, index) => {
            return {
                id: `dia-${index}`,
                type: 'NodeDiarization',
                data: { speakerId: diarization.speaker, width: 3000, height: zoomLevel * (diarization.end - diarization.start) },
                position: { x: 90, y: zoomLevel * diarization.start },
            };
        });

        setNodes([...timeLabels, ...diarizationNodes, ...asrNodes]);
    }, [asrs, diarizations, zoomLevel, timeLabels]);

    //Menus
    const [menu, setMenu] = useState<MenuDiarizationProps | null>(null);
    const [rightMenu, setRightMenu] = useState<MenuDiarizationProps | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const onNodeClick = useCallback(
        (event: React.MouseEvent, node: any) => {
            // Prevent native context menu from showing
            event.preventDefault();

            if (ref.current === null) {
                console.error('Ref is null');
                return;
            }
            const pane = ref.current.getBoundingClientRect();

            if (node.type === 'NodeAsr') {
                // Node 1用のメニューを表示
                setMenu({
                    id: node.id,
                    top: event.clientY,
                    left: event.clientX,
                    right: pane.width - event.clientX,
                    bottom: pane.height - event.clientY,
                    nodeData: node.data,
                    type: 'MenuAsr'
                });
            } else if (node.type === 'NodeDiarization') {
                // Node 2用のメニューを表示
                setMenu({
                    id: node.id,
                    top: event.clientY,
                    left: event.clientX,
                    right: pane.width - event.clientX,
                    bottom: pane.height - event.clientY,
                    nodeData: node.data,
                    type: 'MenuDiarization'
                });
            }

        },
        [setMenu],
    );

    const onNodeContextMenu = useCallback(
        (event: React.MouseEvent, node: any) => {
            // Prevent native context menu from showing
            event.preventDefault();

            if (ref.current === null) {
                toast.error('Ref is null');
                return;
            }
            const pane = ref.current.getBoundingClientRect();

            if (node.type === 'NodeAsr') {
                // Node 1用のメニューを表示
                setRightMenu({
                    id: node.id,
                    top: event.clientY,
                    left: event.clientX,
                    right: pane.width - event.clientX,
                    bottom: pane.height - event.clientY,
                    nodeData: node.data,
                    type: 'MenuAsr'
                });
            } else if (node.type === 'NodeDiarization') {
                // Node 2用のメニューを表示
                setRightMenu({
                    id: node.id,
                    top: event.clientY,
                    left: event.clientX,
                    right: pane.width - event.clientX,
                    bottom: pane.height - event.clientY,
                    nodeData: node.data,
                    type: 'MenuDiarization'
                });
            }

        },
        [setRightMenu],
    );

    // Diarization Datas
    const [asrDiars, setAsrDiars] = useState<any[]>([
        { positionId: 0, start: undefined, end: undefined }, //PM
        { positionId: 1, start: undefined, end: undefined }, //LO
        { positionId: 2, start: undefined, end: undefined }, //DPM
        { positionId: 3, start: undefined, end: undefined }, //DLO
        { positionId: 4, start: undefined, end: undefined }, //GWまたはLOR
        { positionId: 5, start: undefined, end: undefined }, //OWまたはPMR
        { positionId: 6, start: undefined, end: undefined }, //LOR
        { positionId: 7, start: undefined, end: undefined }, //PMR
    ]);

    useEffect(() => { //ここでノードの更新！！！最新状態の反映！！！！
        // あとで負荷を減らしたい
        const newNodes = nodes.map((node) => {
            const id = nodeIdToNumber(node.id);
            if (node.type === 'NodeAsr') {
                // node.id が条件を満たすすべての asrDiar を抽出
                const matchingAsrDiars = asrDiars.filter((asrDiar) =>
                    (asrDiar.start <= id && id <= asrDiar.end) ||
                    id === asrDiar.start ||
                    id === asrDiar.end
                );

                // 一致する positionId のリストを作成
                const positionIds = matchingAsrDiars.map((asrDiar) => asrDiar.positionId);

                // positionId を更新するロジック (例として最初の positionId を使用)
                const positionId = positionIds.length > 0 ? positionIds[0] : -1;

                const isPoi = pois.includes(id);

                return {
                    ...node,
                    data: {
                        ...node.data,
                        positionId,
                        isPoi,
                    },
                };
            }
            return node;
        });

        setNodes(newNodes);

    }, [asrDiars, pois]);

    //util
    const [previousIsStart, setPreviousIsStart] = useState(false); //初期値をfalseにすると、isStartの初期値がtrueになる

    const defaultViewport: any = { x: 0, y: 60, zoom: 1 };

    const handleExportJson = () => {
        const speechLength = isNA ? 6 : 8;
        const speechIdToPositionName = isNA ? speechIdToPositionNameNA : speechIdToPositionNameAsian;

        for (let i = 0; i < speechLength; i++) {
            if (asrDiars[i].start === undefined && asrDiars[i].end === undefined) {
                toast.error(
                    <span>
                        <strong>{speechIdToPositionName[i]}</strong> is not labeled.
                    </span>,
                    { duration: 5000 });
                return;
            }
        }

        const speeches: Asr[][] = Array.from({ length: speechLength }, () => []);
        const pois = [];
        for (let i = 0; i < nodes.length; i++) {
            const positionId = nodes[i].data.positionId;
            if (positionId !== undefined && 0 <= positionId && positionId <= 7) {
                if (nodes[i].data.isPoi) {
                    pois.push(nodeIdToNumber(nodes[i].id));
                }
                speeches[nodes[i].data.positionId].push({
                    text: nodes[i].data.text,
                    start: nodes[i].data.start,
                    end: nodes[i].data.end
                });
            }
        }
        const dst = {
            pois: pois,
            speeches: speeches
        }

        const json = JSON.stringify(dst, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        if (!exportFileName) {
            toast.error('Export file name is not set.');
        } else {
            a.download = exportFileName;
        }
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <ReactFlow
                ref={ref}
                nodes={nodes}
                nodeTypes={{ NodeAsr: NodeAsr, NodeTimeLabel: NodeTimeLabel, NodeDiarization: NodeDiarization }}
                onPaneClick={() => {
                    setMenu(null);
                    setRightMenu(null);
                }}
                panOnScroll
                onNodeClick={(event, node) => {
                    if (node.type != 'NodeAsr') {
                        setMenu(null);
                        return;
                    }
                    setRightMenu(null);
                    onNodeClick(event, node);// ノードがクリックされたときはメニューを閉じない
                    event.stopPropagation(); // 親要素へのクリックイベント伝播を止める
                }}
                onNodeContextMenu={(event, node) => {
                    if (node.type != 'NodeAsr') {
                        setRightMenu(null);
                        return;
                    }
                    setMenu(null);
                    onNodeContextMenu(event, node); // ノードのコンテキストメニューが開かれたときはメニューを閉じない
                    event.stopPropagation(); // 親要素へのクリックイベント伝播を止める
                }}
                defaultViewport={defaultViewport} // デフォルトのカメラの座標を指定
            >
                <Background
                    variant={BackgroundVariant.Lines}
                    gap={[10000, 60]}
                    lineWidth={2}
                />
            </ReactFlow>
            {/* ReactFlow外にMenuを移動 */}
            {menu && menu.type === 'MenuAsr' && <MenuAsr setMenu={setMenu} asrDiars={asrDiars} setAsrDiars={setAsrDiars} previousIsStart={previousIsStart} setPreviousIsStart={setPreviousIsStart} {...menu} />}
            {rightMenu && rightMenu.type === 'MenuAsr' && <MenuAsrRight setRightMenu={setRightMenu} asrDiars={asrDiars} setAsrDiars={setAsrDiars} previousIsStart={previousIsStart} setPreviousIsStart={setPreviousIsStart} {...rightMenu} />}
            <SidebarTimeline
                isNA={isNA}
                setIsNA={setIsNA}
                zoomLevel={zoomLevel}
                setZoomLevel={setZoomLevel}
                nodeTransparency={nodeTransparency}
                setNodeTransparency={setNodeTransparency}
                handleExportJson={handleExportJson}
                onAsrFileSelect={handleAsrFileSelect}
                onDiarizationFileSelect={handleDiarizationFileSelect}
            />
            {youtubeLink && (
                <div className="fixed bottom-0 right-0">
                    <Youtube videoId={ytId} opts={ytProps} onReady={(e: any) => setYtPlayer(e.target)} />
                </div>
            )}
        </div>
    );
};

export default Timeline;