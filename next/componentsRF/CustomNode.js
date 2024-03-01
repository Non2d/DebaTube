import React from 'react';

const CustomNode = ({ data }) => {
  return (
    <div style={{ width: '100px', border: '1px solid #222', padding: '10px' }}>
      {data.label}
    </div>
  );
};

export default CustomNode;