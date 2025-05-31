"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';

// 定数定義
const DEFAULT_MARKDOWN = `First cell
Multiple lines of text

Second cell
Short text

Third cell`;

const CELL_SEPARATOR = '\n\n';  // 空白改行でセルを区切る

const CELL_COLORS = {
  background: [
    'bg-blue-50 border-blue-200',
    'bg-green-50 border-green-200', 
    'bg-purple-50 border-purple-200',
    'bg-orange-50 border-orange-200',
    'bg-pink-50 border-pink-200',
    'bg-indigo-50 border-indigo-200',
    'bg-yellow-50 border-yellow-200',
    'bg-red-50 border-red-200'
  ],
  highlight: [
    'bg-blue-100',
    'bg-green-100', 
    'bg-purple-100',
    'bg-orange-100',
    'bg-pink-100',
    'bg-indigo-100',
    'bg-yellow-100',
    'bg-red-100'
  ]
};

const InteractiveSheetApp = () => {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [highlightedCell, setHighlightedCell] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [cellVersions, setCellVersions] = useState({});
  const textareaRef = useRef(null);
  const cellRefs = useRef({});

  const parseMarkdownToCells = (text) => {
    const parts = text.split(CELL_SEPARATOR);
    let currentPosition = 0;
    
    const cells = parts.map((cellContent, index) => {
      const trimmedContent = cellContent.trim();
      const startPosition = currentPosition;
      const endPosition = currentPosition + cellContent.length;
      
      // Update position for next cell (including separator length)
      currentPosition = endPosition + (index < parts.length - 1 ? CELL_SEPARATOR.length : 0);
      
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
    const text = content;
    
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
    return CELL_COLORS.background[index % CELL_COLORS.background.length];
  };

  const getHighlightColor = (index) => {
    return CELL_COLORS.highlight[index % CELL_COLORS.highlight.length];
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
      <EditorPanel
        markdown={markdown}
        setMarkdown={setMarkdown}
        textareaRef={textareaRef}
        selectedCell={selectedCell}
        cellData={cellData}
        getHighlightColor={getHighlightColor}
        DEFAULT_MARKDOWN={DEFAULT_MARKDOWN}
      />
      <PreviewPanel
        cellData={cellData}
        selectedCell={selectedCell}
        setSelectedCell={setSelectedCell}
        highlightedCell={highlightedCell}
        setHighlightedCell={setHighlightedCell}
        cellRefs={cellRefs}
        getCellColor={getCellColor}
        renderCellContent={renderCellContent}
        cellVersions={cellVersions}
        textareaRef={textareaRef}
      />
    </div>
  );
};

export default InteractiveSheetApp;