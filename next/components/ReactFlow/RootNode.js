import React from 'react';
import {Handle, Position} from "reactflow";

const RootNode = ({ data }) => {
  return (
    <div className="w-96 border-black p-2 text-white text-5xs rounded text-center bg-red-700">
      {data.label}
      <Handle type="source" position={Position.Bottom} className="w-6 h-1 bg-red-500 rounded-md cursor-pointer"/>
    </div>
  );
};

export default RootNode;