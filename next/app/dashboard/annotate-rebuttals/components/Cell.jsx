import React from 'react';
import { Navigation } from 'lucide-react';

const Cell = ({ cell, index, isSelected, isHighlighted, onClick, onMouseEnter, onMouseLeave, getCellColor, getHighlightColor, renderCellContent, cellVersions, cellRefs }) => {
  if (cell.isRoleHeader) {
    return (
      <div className="relative">
        <div className={`px-2 py-1 rounded text-xs font-mono ${
          cell.isGovernment === true ? 'bg-red-100 text-red-800' : 
          cell.isGovernment === false ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {cell.role}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={el => cellRefs.current[index] = el}
      className={`border border-gray-300 transition-all duration-200 cursor-pointer relative group ${
        isSelected ? getCellColor(index) : 'bg-white hover:bg-gray-50'
      } ${
        isHighlighted ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
      } ${
        cell.isGovernment === true ? 'ml-0 mr-auto' : 
        cell.isGovernment === false ? 'mr-0 ml-auto' : ''
      }`}
      style={{ 
        borderTop: index === 0 ? '2px solid #374151' : '1px solid #d1d5db',
        maxWidth: '80%'
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Cell Number with Color Indicator */}
      <div className="absolute -left-12 top-2 flex items-center space-x-1">
      </div>
      
      {/* Click indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Navigation className="w-4 h-4 text-blue-500" />
      </div>
      
      {/* Cell Content */}
      <div className="p-4 min-h-[60px] relative">
        {cell.isEmpty ? (
          <div className="text-gray-400 italic text-sm">（空のセル）</div>
        ) : (
          <div 
            key={`content-${cellVersions[index]?.version || 0}-${cellVersions[index]?.timestamp || 0}`}
            className="text-sm text-gray-700 leading-relaxed"
            lang="auto"
          >
            {renderCellContent(cell.content)}
          </div>
        )}
        
        {/* Connection Line */}
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
        )}
      </div>
    </div>
  );
};

export default Cell; 