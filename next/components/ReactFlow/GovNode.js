import React from 'react';
import {Handle, Position} from "reactflow";

const GovNode = ({ data }) => {
  return (
    <div className="w-96 p-2 text-black text-xs rounded text-justify bg-white">
      {data.label}
      <Handle type="target" id="a" position={Position.Top} className="w-6 h-1 bg-gray-500 rounded-md cursor-pointer"/>
      <Handle type="source" id="b" position={Position.Bottom} className="w-6 h-1 bg-gray-500 rounded-md cursor-pointer"/>

      <Handle type="target" id="c" position={Position.Right} className="w-1 h-6 bg-gray-500 rounded-md cursor-pointer"/>
      <Handle type="source" id="d" position={Position.Right} className="w-1 h-6 bg-gray-500 rounded-md cursor-pointer"/>
    </div>
  );
};

export default GovNode;