import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { speechIdToPositionNameAsian, speechIdToPositionNameNA, nodeIdToNumber } from '../lib/constants';

import { useAppContext } from '../../context/context';

interface MenuAsrRightProps {
    id: string;
    top: number;
    left: number;
    right: number;
    bottom: number;
    nodeData: any;
    type: string;
    setRightMenu: React.Dispatch<React.SetStateAction<any>>;
    asrDiars: any;
    setAsrDiars: React.Dispatch<React.SetStateAction<any>>;
    [key: string]: any;
}


function MenuAsrRight({ id, top, left, right, bottom, nodeData, type, setRightMenu, asrDiars, setAsrDiars, ...props }: MenuAsrRightProps) {
    const [selectedPosition, setSelectedPosition] = useState(-1);
    const { pois, setPois, isNA } = useAppContext();
    const speechIdToPositionName = isNA ? speechIdToPositionNameNA : speechIdToPositionNameAsian;

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
                <span style={{ color: 'black' }}>Edit this node (developping)</span><br />
                <span style={{ color: 'black' }}>Edit text</span><br />
                <span style={{ color: 'black' }}>Edit start/end time</span>
            </div>
        </div>
    );
}

export default MenuAsrRight;