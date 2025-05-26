"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Grid, Edit, Layers, RefreshCw, Navigation } from 'lucide-react';

const InteractiveSheetApp = () => {
  const [markdown, setMarkdown] = useState(
`
This is a simple interactive sheet editor.
--
This is the first cell.
--
The cells are separated by a line with just two dashes (--).
`);

  const [highlightedCell, setHighlightedCell] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [cellVersions, setCellVersions] = useState({});
  const [lastEditedCell, setLastEditedCell] = useState(null);
  const textareaRef = useRef(null);
  const cellRefs = useRef({});

  const parseMarkdownToCells = (text) => {
    const separatorRegex = /^--$/m;
    const parts = text.split(separatorRegex);
    let currentPosition = 0;
    
    const cells = parts.map((cellContent, index) => {
      const trimmedContent = cellContent.trim();
      const startPosition = currentPosition;
      const endPosition = currentPosition + cellContent.length;
      
      // Update position for next cell (including separator length)
      currentPosition = endPosition + (index < parts.length - 1 ? 3 : 0); // 3 for "--\n"
      
      return {
        id: index,
        content: trimmedContent,
        isEmpty: trimmedContent === '',
        startPosition,
        endPosition,
        rawContent: cellContent
      };
    });
    
    return cells.filter(cell => !(cell.id === cells.length - 1 && cell.content === ''));
  };

  const cellData = useMemo(() => {
    const cells = parseMarkdownToCells(markdown);
    
    // Check if any cell content has changed and update versions
    cells.forEach((cell, index) => {
      const currentContent = cell.content;
      const previousContent = cellVersions[index]?.content;
      
      if (previousContent !== undefined && previousContent !== currentContent) {
        // Content has changed, increment version to force re-render
        setCellVersions(prev => ({
          ...prev,
          [index]: {
            content: currentContent,
            version: (prev[index]?.version || 0) + 1,
            timestamp: Date.now()
          }
        }));
        setLastEditedCell(index);
        
        // Clear last edited cell after a short delay
        setTimeout(() => setLastEditedCell(null), 1000);
      } else if (previousContent === undefined) {
        // Initialize version for new cells
        setCellVersions(prev => ({
          ...prev,
          [index]: {
            content: currentContent,
            version: 0,
            timestamp: Date.now()
          }
        }));
      }
    });
    
    return cells;
  }, [markdown, cellVersions]);

  const renderCellContent = (content) => {
    if (!content) return null;
    
    // Split content by markdown patterns and render as React elements
    const parts = [];
    let lastIndex = 0;
    const text = content;
    
    // Simple regex patterns for markdown
    const patterns = [
      { regex: /\*\*(.*?)\*\*/g, component: (match, content) => <strong key={match.index}>{content}</strong> },
      { regex: /\*(.*?)\*/g, component: (match, content) => <em key={match.index}>{content}</em> },
      { regex: /~~(.*?)~~/g, component: (match, content) => <del key={match.index}>{content}</del> },
      { regex: /`(.*?)`/g, component: (match, content) => <code key={match.index} className="bg-gray-100 px-1 rounded text-sm">{content}</code> }
    ];
    
    // Simple approach: just render with basic JSX elements to avoid innerHTML
    const lines = text.split('\n');
    return (
      <div>
        {lines.map((line, index) => (
          <React.Fragment key={index}>
            {line}
            {index < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const getCellColor = (index) => {
    const colors = [
      'bg-blue-50 border-blue-200',
      'bg-green-50 border-green-200', 
      'bg-purple-50 border-purple-200',
      'bg-orange-50 border-orange-200',
      'bg-pink-50 border-pink-200',
      'bg-indigo-50 border-indigo-200',
      'bg-yellow-50 border-yellow-200',
      'bg-red-50 border-red-200'
    ];
    return colors[index % colors.length];
  };

  const getHighlightColor = (index) => {
    const colors = [
      'bg-blue-100',
      'bg-green-100', 
      'bg-purple-100',
      'bg-orange-100',
      'bg-pink-100',
      'bg-indigo-100',
      'bg-yellow-100',
      'bg-red-100'
    ];
    return colors[index % colors.length];
  };

  const handleCellClick = (cellIndex) => {
    const cell = cellData[cellIndex];
    if (cell && textareaRef.current) {
      // Focus textarea and set cursor position
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(cell.startPosition, cell.endPosition);
      setSelectedCell(cellIndex);
    }
  };

  const handleCellHover = (cellIndex) => {
    setHighlightedCell(cellIndex);
  };

  const handleCellLeave = () => {
    setHighlightedCell(null);
  };

  const scrollToCellInPreview = (cellIndex) => {
    const cellElement = cellRefs.current[cellIndex];
    if (cellElement) {
      cellElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  };

  // Handle textarea selection to highlight corresponding cell
  const handleTextareaSelect = () => {
    if (textareaRef.current) {
      const cursorPosition = textareaRef.current.selectionStart;
      const cellIndex = cellData.findIndex(cell => 
        cursorPosition >= cell.startPosition && cursorPosition <= cell.endPosition
      );
      
      if (cellIndex !== -1) {
        setSelectedCell(cellIndex);
        scrollToCellInPreview(cellIndex);
      }
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('selectionchange', handleTextareaSelect);
      textarea.addEventListener('click', handleTextareaSelect);
      textarea.addEventListener('keyup', handleTextareaSelect);
      
      return () => {
        textarea.removeEventListener('selectionchange', handleTextareaSelect);
        textarea.removeEventListener('click', handleTextareaSelect);
        textarea.removeEventListener('keyup', handleTextareaSelect);
      };
    }
  }, [cellData]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Markdown Editor */}
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
            placeholder="セルの内容を入力してください...

セルは -- で区切られます。

例:
最初のセル
複数行のテキスト

--

2番目のセル
短いテキスト

--

3番目のセル"
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
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">--</span>
              <span>セル区切り（独立した行に記述）</span>
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

      {/* Right Panel - Sheet Preview */}
      <div className="w-1/2 flex flex-col">
        <div className="bg-white border-b border-gray-200 p-4 flex items-center space-x-2">
          <Grid className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-800">シートプレビュー</h2>
          <div className="ml-auto flex items-center space-x-2 text-sm text-gray-500">
            <Layers className="w-4 h-4" />
            <span>{cellData.length} セル</span>
          </div>
        </div>
        
        {/* Sheet Display Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {cellData.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <Grid className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg mb-2">セルがありません</p>
              <p className="text-sm">左側のエディタでセルを作成してください</p>
            </div>
          ) : (
            <div className="space-y-0">
              {cellData.map((cell, index) => (
                <div
                  key={`${cell.id}-${cellVersions[index]?.version || 0}`}
                  ref={el => cellRefs.current[index] = el}
                  className={`border border-gray-300 transition-all duration-200 cursor-pointer relative group ${
                    selectedCell === index ? getCellColor(index) : 'bg-white hover:bg-gray-50'
                  } ${
                    highlightedCell === index ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
                  } ${
                    lastEditedCell === index ? 'ring-2 ring-green-400 ring-opacity-75 animate-pulse' : ''
                  }`}
                  style={{ borderTop: index === 0 ? '2px solid #374151' : '1px solid #d1d5db' }}
                  onClick={() => handleCellClick(index)}
                  onMouseEnter={() => handleCellHover(index)}
                  onMouseLeave={handleCellLeave}
                >
                  {/* Cell Number with Color Indicator */}
                  <div className="absolute -left-12 top-2 flex items-center space-x-1">
                    <div 
                      className={`w-3 h-3 rounded-full ${getCellColor(index).split(' ')[0]} border ${getCellColor(index).split(' ')[1]}`}
                    ></div>
                    <span className="text-xs text-gray-400 font-mono">{index + 1}</span>
                  </div>
                  
                  {/* Click indicator */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Navigation className="w-4 h-4 text-blue-500" />
                  </div>
                  
                  {/* Cell Content with forced re-render */}
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
                    
                    {/* Edit indicator */}
                    {lastEditedCell === index && (
                      <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-2 py-1 rounded animate-fade-in">
                        更新
                      </div>
                    )}
                    
                    {/* Connection Line Animation */}
                    {selectedCell === index && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 animate-pulse"></div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Bottom border */}
              <div className="border-t-2 border-gray-400"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractiveSheetApp;