import React from 'react';
import { Edit, Navigation } from 'lucide-react';

const EditorPanel = ({ markdown, setMarkdown, textareaRef, selectedCell, cellData, getHighlightColor, DEFAULT_MARKDOWN }) => {
  return (
    <div className="w-1/2 flex flex-col border-r border-gray-300">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Edit className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">セルエディタ</h2>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Navigation className="w-4 h-4" />
          <span>クリック・選択で連動</span>
        </div>
      </div>
      
      <div className="flex-1 p-4 relative">
        <textarea
          ref={textareaRef}
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          className="w-full h-full p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-relaxed"
          placeholder={DEFAULT_MARKDOWN}
          style={{
            background: selectedCell !== null ? 
              `linear-gradient(to right, transparent ${(cellData[selectedCell]?.startPosition / markdown.length) * 100}%, ${getHighlightColor(selectedCell)} ${(cellData[selectedCell]?.startPosition / markdown.length) * 100}%, ${getHighlightColor(selectedCell)} ${(cellData[selectedCell]?.endPosition / markdown.length) * 100}%, transparent ${(cellData[selectedCell]?.endPosition / markdown.length) * 100}%)` : 
              'white'
          }}
        />
      </div>
      
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-center space-x-2">
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">空白行</span>
            <span>セル区切り（空行で区切る）</span>
          </div>
          <div className="text-gray-500">
            💡 右のセルをクリック → エディタの該当箇所にジャンプ
          </div>
          <div className="text-gray-500">
            💡 編集すると該当セルが自動で再翻訳されます
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPanel; 