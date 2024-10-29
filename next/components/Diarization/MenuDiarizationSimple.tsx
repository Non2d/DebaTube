import React, { useState, useEffect } from 'react';
import diarizationColors from '../utils/DiarizationColors';
import { speechIdToPositionNameAsian, speechIdToPositionNameNA } from '../utils/speechIdToPositionName';
import { useAppContext } from '../../context/context';

interface ContextMenuProps {
    [key: string]: any; // その他のプロパティを許可
}

function MenuDiarization({id, top, left, nodeData, setMenu}:ContextMenuProps) {
    const { isNA } = useAppContext();

    const [selectedOption, setSelectedOption] = useState<number>(-100);
    const [speechIdToPositionName, setSpeechIdToPositionName] = useState(speechIdToPositionNameNA);
    const options = [
        { label: '---', value: '--' },
        { label: 'Speech 1', value: 'speech1' },
        { label: 'Speech 2', value: 'speech2' },
        { label: 'Speech 3', value: 'speech3' },
    ];

    const handleOptionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedOption(parseInt(event.target.value,10));
    };

    useEffect(() => {
        setSpeechIdToPositionName(isNA ? speechIdToPositionNameNA : speechIdToPositionNameAsian);
    }, [isNA]);

    // console.log(nodeData);

    return (
        <div
            className="absolute bg-white border border-gray-300 rounded shadow-lg p-4"
            style={{ top: `${top}px`, left: `${left}px` }}
        >
            Set this color to:
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
                <option value={-1}>Clear this speech</option>
                <option value={-2}>POI</option>
            </select>
        </div>
    );
}

export default MenuDiarization;