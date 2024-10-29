// import React, { useState } from 'react';
// import diarizationColors from '../utils/DiarizationColors';

// interface ContextMenuProps {
//     id: string;
//     top: number;
//     left: number;
//     right: number;
//     bottom: number;
//     nodeData: any;
//     type: string;
//     nodes: any[];
//     setNodes: React.Dispatch<React.SetStateAction<any[]>>;
//     options: { diarizationId: number; label: string; color: string }[];
//     setOptions: React.Dispatch<React.SetStateAction<{ diarizationId: number; label: string; color: string }[]>>;
//     [key: string]: any; // その他のプロパティを許可
// }

// function MenuDiarization({ id, top, left, right, bottom, nodeData, type, nodes, setNodes, options, setOptions, ...props }: ContextMenuProps) {
//     const color = diarizationColors[nodeData.speakerId % 20];
//     const [selectedOption, setSelectedOption] = useState(0);

//     const handleOptionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
//         const selectedValue = Number(event.target.value);
//         setSelectedOption(selectedValue);

//         // optionsを更新
//         setOptions(prevOptions =>
//             prevOptions.map(option =>
//                 option.diarizationId === selectedValue ? { ...option, diarizationId: nodeData.speaker, color: diarizationColors[nodeData.speakerId % 20] } : option
//             )
//         );
//     };

//     return (
//         <div
//             style={{ top, left }}
//             className="absolute bg-white border border-gray-300 shadow-lg z-50 p-2 rounded-md"
//             {...props}
//         >
//             <span style={{ display: 'inline-block', width: '50px', height: '20px', backgroundColor: color }}></span> is
//             <select
//                 value={selectedOption}
//                 onChange={handleOptionChange}
//                 className="block w-full p-2 my-1 bg-gray-100 rounded-md"
//             >
//                 {options.map(option => (
//                     <option key={option.diarizationId} value={option.diarizationId} style={{ backgroundColor: option.color }}>
//                         {option.label}
//                     </option>
//                 ))}
//             </select>
//         </div>
//     );
// }

// export default MenuDiarization;