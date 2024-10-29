import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { speechIdToPositionNameAsian, speechIdToPositionNameNA } from '../utils/speechIdToPositionName';
import nodeIdToNumber from '../utils/nodeIdToNumber';

import { useAppContext } from '../../context/context';

interface ContextMenuProps {
    id: string;
    top: number;
    left: number;
    right: number;
    bottom: number;
    nodeData: any;
    type: string;
    setMenu: React.Dispatch<React.SetStateAction<any>>;
    asrDiars: any;
    setAsrDiars: React.Dispatch<React.SetStateAction<any>>;
    previousIsStart: boolean;
    setPreviousIsStart: React.Dispatch<React.SetStateAction<boolean>>;
    [key: string]: any;
}

function MenuAsr({ id, top, left, right, bottom, nodeData, type, setMenu, asrDiars, setAsrDiars, previousIsStart, setPreviousIsStart, ...props }: ContextMenuProps) {
    const { pois, setPois, isNA, zoomLevel } = useAppContext();

    const [isStart, setIsStart] = useState(!previousIsStart);
    const [selectedPosition, setSelectedPosition] = useState(-100);
    const [speechIdToPositionName, setSpeechIdToPositionName] = useState(speechIdToPositionNameNA);

    useEffect(() => {
        setSpeechIdToPositionName(isNA ? speechIdToPositionNameNA : speechIdToPositionNameAsian);
    }, [isNA]);

    const handlePositionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newSelectedPosition = Number(event.target.value);
        setSelectedPosition(newSelectedPosition);
        // validation
        // if(nodeIdToNumber(asrDiars[newSelectedPosition-1]?.start) >= nodeIdToNumber(id) || nodeIdToNumber(asrDiars[-1]?.end) >= nodeIdToNumber(id)){
        //     console.error("Node cannot belong to more than two speeches.");
        //     toast.error("Node can't belong to 2 speeches.")
        //     return;
        // }
        // やるんなら徹底的にやらないとデッドロックになる

        if (newSelectedPosition == -2) { //POIの設定
            const nodeId = nodeIdToNumber(id);

            if (pois.includes(nodeId)) {
                // nodeIdがpoisに含まれている場合、削除する
                const newPois = pois.filter(poi => poi !== nodeId);
                setPois(newPois);
                toast.success(
                    <span>
                        <strong>{id}</strong> is Deleted from POI.
                    </span>,
                    { duration: 5000 }
                );
            } else {
                // nodeIdがpoisに含まれていない場合、追加する
                const newPois = pois.concat(nodeId);
                setPois(newPois);
                toast.success(
                    <span>
                        <strong>{id}</strong> is set as POI.
                    </span>,
                    { duration: 5000 }
                );
            }
            //push(id) を使うのではなく、setPois(pois.concat(id)) のように新しい配列を作成して状態を更新すべき
            //このidは歯抜けがあると最終的な出力のidとは一致しないことに注意。そう考えるとやはり、最終的な出力はノードを直接走査して取得すべきだな
            setMenu(null);
            return;
        } else if (newSelectedPosition == -1) { //Noneの設定
            setAsrDiars(asrDiars.map((asrDiars: any) => {
                if (asrDiars.positionId === nodeData.positionId) {
                    return {
                        ...asrDiars,
                        start: undefined,
                        end: undefined,
                    };
                }
                return asrDiars;
            }));
            toast.success(
                <span>
                    Cleared all lables of <strong>{speechIdToPositionName[nodeData.positionId]}</strong>.
                </span>,
                { duration: 5000 }
            );
            setMenu(null);
            return;
        } else {
            setAsrDiars(asrDiars.map((asrDiars: any, index: number, array: any[]) => {
                if (asrDiars.positionId === newSelectedPosition) {
                    if (isStart) {
                        return {
                            ...asrDiars,
                            start: nodeIdToNumber(id),
                        };
                    } else {
                        return {
                            ...asrDiars,
                            end: nodeIdToNumber(id),
                        };
                    }
                }

                // 直前のスピーチのendの自動補完。あるendが定義されてないのに次のstartが定義されるとき、そのひとつまえのidを設定する
                if (newSelectedPosition > 0 && !array[newSelectedPosition - 1].end && array[newSelectedPosition - 1].start !== undefined) {
                    // console.log(array[newSelectedPosition - 1].start); //これだとbooleanではなく、ふつうに数値が返ってくる
                    toast.success(
                        <span>
                            Automatically, <strong>{"asr-" + (nodeIdToNumber(id) - 1)}</strong> is also set as <strong>{speechIdToPositionName[newSelectedPosition - 1]}</strong>&apos;s <strong>end</strong> seg.
                        </span>,
                        { duration: 5000 }
                    );
                    array[newSelectedPosition - 1].end = nodeIdToNumber(id) - 1;
                }

                return asrDiars;
            }));

            toast.success(
                <span>
                    <strong>{id}</strong> is set as <strong>{speechIdToPositionName[newSelectedPosition]}</strong>&apos;s <strong>{isStart ? "start" : "end"}</strong> seg.
                </span>,
                { duration: 5000 }
            );

            setPreviousIsStart(isStart);
            setMenu(null);
        }
    };

    return (
        <div
            style={{ top, left }}
            className="absolute bg-white border border-gray-300 shadow-lg z-50 p-2 rounded-md"
            onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
            }}
            {...props}
        >
            <div
                onClick={() => setIsStart(!isStart)}
                style={{
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    color: '#1a73e8',
                    padding: '0px 10px',
                    borderRadius: '5px',
                    transition: 'background-color 0.3s, color 0.3s',
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f1f3f4';
                    (e.currentTarget as HTMLDivElement).style.color = '#0b66c3';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = 'white';
                    (e.currentTarget as HTMLDivElement).style.color = '#1a73e8';
                }}
            >
                <span style={{ color: 'black' }}>It&apos;s </span>
                <span style={{ color: '#1a73e8', fontWeight: 'bold' }}>{isStart ? 'start' : 'end'}</span>
                <span style={{ color: 'black' }}> seg of</span>
            </div>
            <select
                value={selectedPosition}
                onChange={handlePositionChange}
                className="block w-full p-2 my-1 bg-gray-100 rounded-md"
            >
                {speechIdToPositionName.map((label, index) => (
                    <option key={index} value={index}>
                        {label}
                    </option>
                ))}
                <option value={-100}>---</option>
                <option value={-1}>Clear this speech</option>
                <option value={-2}>POI</option>
            </select>
        </div>
    );
}
export default MenuAsr;