import React from 'react';
import { Handle, Position } from "reactflow";

const OppNode = ({ data }) => {
  return (
    <div className="w-32 h-2 bg-blue-500">
      <Handle type="target" id="tgt" position={Position.Left} className="w-1 h-1 bg-blue-500" />
      <Handle type="source" id="src" position={Position.Left} className="w-1 h-1 bg-blue-500" />
    </div>
  );
};

export default OppNode;