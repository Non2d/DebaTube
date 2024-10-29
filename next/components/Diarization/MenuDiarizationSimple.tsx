import React, { useState, useEffect } from 'react';
import diarizationColors from '../utils/DiarizationColors';
import { speechIdToPositionNameAsian, speechIdToPositionNameNA } from '../utils/speechIdToPositionName';
import { useAppContext } from '../../context/context';
import { toast } from 'react-hot-toast';

interface ContextMenuProps {
    [key: string]: any; // その他のプロパティを許可
}

function MenuDiarization({ id, top, left, nodeData, setMenu, setDiarizationId }: ContextMenuProps) {
    const { isNA } = useAppContext();

    const [selectedOption, setSelectedOption] = useState<number>(-100);
    const [speechIdToPositionName, setSpeechIdToPositionName] = useState(speechIdToPositionNameNA);

    const diarizationId = nodeData.speakerId;
    const color = diarizationColors[diarizationId];

    const handleOptionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newSelectedPosition = parseInt(event.target.value, 10);
        setSelectedOption(newSelectedPosition);
        setDiarizationId(newSelectedPosition, diarizationId);
        toast.success(
            <span>
                Set <strong>{speechIdToPositionName[newSelectedPosition]}</strong>&apos;s diarization id to No.<strong>{diarizationId}</strong>
            </span>,
            {
                duration: 5000,
            }
        );
        setMenu(null);
    };

    useEffect(() => {
        setSpeechIdToPositionName(isNA ? speechIdToPositionNameNA : speechIdToPositionNameAsian);
    }, [isNA]);

    return (
        <div
            className="absolute bg-white border border-gray-300 shadow-lg z-50 p-4 rounded-md"
            style={{ top: `${top}px`, left: `${left}px` }}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    color: '#000',
                    padding: '0px 10px',
                    borderRadius: '5px',
                    transition: 'background-color 0.3s, color 0.3s',
                    display: 'inline-block',
                }}
            >
                <strong>Set </strong>
                <div
                    style={{
                        display: 'inline-block',
                        width: '20px',
                        height: '20px',
                        backgroundColor: color,
                        marginLeft: '2px',
                        marginRight: '2px',
                        verticalAlign: 'middle',
                    }}
                ></div>
                <strong> to:</strong>
            </div>
            <select
                value={selectedOption}
                onChange={handleOptionChange}
                className="block w-full p-2 my-1 bg-gray-100 rounded-md"
            >
                {speechIdToPositionName.map((label, index) => (
                    <option key={index} value={index}>
                        {label}
                    </option>
                ))}
                <option value={-100}>---</option>
            </select>
        </div>
    );
}

export default MenuDiarization;