import React from 'react';

const CustomNode = ({ data }) => {
  return (
    <div className="w-48 border-1 border-black p-2 text-black">
      {data.label}
    </div>
  );
};

export default CustomNode;