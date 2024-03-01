import React from 'react';
import {Handle, Position} from "reactflow";

const CustomNode = ({ data }) => {
  return (
    <div className="w-96 border-1 border-black p-2 text-black text-xs rounded text-justify bg-white">
      {data.label}
      <Handle type="target" position={Position.Top} className="w-6 h-1 bg-gray-500 rounded-md cursor-pointer"/>
      <Handle type="source" position={Position.Bottom} className="w-6 h-1 bg-gray-500 rounded-md cursor-pointer"/>
    </div>
  );
};

export default CustomNode;