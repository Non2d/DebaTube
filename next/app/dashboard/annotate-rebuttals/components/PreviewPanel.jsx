import React from 'react';
import { Eye } from 'lucide-react';
import Cell from './Cell';

const PreviewPanel = ({ 
  cellData, 
  selectedCell, 
  setSelectedCell, 
  clickedCell,
  setClickedCell,
  highlightedCell, 
  setHighlightedCell, 
  cellRefs, 
  getCellColor, 
  renderCellContent, 
  cellVersions,
  textareaRef
}) => {
  const handleCellClick = (cellIndex) => {
    const cell = cellData[cellIndex];
    if (cell && textareaRef.current) {
      // Focus textarea and set cursor position
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(cell.startPosition, cell.endPosition);
      setSelectedCell(cellIndex);
      setClickedCell(cellIndex);
    }
  };

  return (
    <div className="w-1/2 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Eye className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">プレビュー</h2>
        </div>
        <div className="text-sm text-gray-600">
          {cellData.length} セル
        </div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        <div>
          {cellData.map((cell, index) => (
            <Cell
              key={index}
              cell={cell}
              index={index}
              isSelected={selectedCell === index}
              isHighlighted={highlightedCell === index}
              wasLastEdited={cellVersions[index]?.lastEdited}
              onClick={() => handleCellClick(index)}
              onMouseEnter={() => setHighlightedCell(index)}
              onMouseLeave={() => setHighlightedCell(null)}
              cellRefs={cellRefs}
              getCellColor={getCellColor}
              renderCellContent={renderCellContent}
              cellVersions={cellVersions}
            />
          ))}
        </div>
      </div>
      
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>選択中</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gray-300"></div>
            <span>未選択</span>
          </div>
          <div className="text-gray-500">
            💡 セルをクリック → エディタの該当箇所にジャンプ
          </div>
          {clickedCell !== null && cellData[clickedCell] && (
            <div key={`clicked-cell-${clickedCell}-${Date.now()}`} className="mt-4 p-3 border border-gray-300 rounded-lg bg-gray-50">
              <div className="text-sm font-semibold text-gray-700 mb-2">
                クリックされたセル:
              </div>
              <div className={`p-2 rounded border text-sm ${getCellColor ? getCellColor(clickedCell) : 'bg-white border-gray-200'}`}>
                {cellData[clickedCell].isRoleHeader ? (
                  <div className="font-bold text-lg">## {cellData[clickedCell].role}</div>
                ) : (
                  renderCellContent(cellData[clickedCell].content)
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel; 