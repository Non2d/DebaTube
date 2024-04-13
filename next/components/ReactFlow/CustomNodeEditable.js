import { useCallback, useState } from 'react';
import { Handle, Position } from "reactflow";

const CustomNodeEditable = ({ data }) => {
    const [text, setText] = useState(data.label);

    return (
        <div className="w-96 border-1 border-black p-2 text-black text-xs rounded text-justify bg-white">
            <input id="text" name="text" onChange={e => setText(e.target.value)} className="nodrag" defaultValue={text}/>
            <Handle type="target" position={Position.Top} className="w-6 h-1 bg-gray-500 rounded-md cursor-pointer" />
            <Handle type="source" position={Position.Bottom} className="w-6 h-1 bg-gray-500 rounded-md cursor-pointer" />
        </div>
    );
};

export default CustomNodeEditable;