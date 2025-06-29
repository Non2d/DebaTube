"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';

// 定数定義
const DEFAULT_MARKDOWN = `## PM
First Prime Minister speech
Multiple lines of text

## LO
Leader of Opposition speech
Short text

## DPM
Deputy Prime Minister speech

## DLO
Deputy Leader of Opposition speech

## GW
Government Whip speech

## OW
Opposition Whip speech

## LOR
Leader of Opposition Reply speech

## PMR
Prime Minister Reply speech`;

const CELL_SEPARATOR = '\n\n';  // 空白改行でセルを区切る

const DEBATE_ROLES = {
  GOVERNMENT: ['PM', 'DPM', 'GW', 'PMR'],
  OPPOSITION: ['LO', 'DLO', 'OW', 'LOR']
};

const convertRoleToSide = (role) => {
  if (DEBATE_ROLES.GOVERNMENT.includes(role)) return true;  // 政府側（肯定）
  if (DEBATE_ROLES.OPPOSITION.includes(role)) return false; // 野党側（否定）
  return undefined;
};

const getSideColor = (isGovernment, type = 'background') => {
  if (isGovernment === undefined) return type === 'background' ? 'bg-white border-gray-200' : 'bg-gray-100';
  return isGovernment ? 
    (type === 'background' ? 'bg-red-50 border-red-200' : 'bg-red-100') : 
    (type === 'background' ? 'bg-blue-50 border-blue-200' : 'bg-blue-100');
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
    let currentRole = null;
    
    const cells = parts.map((cellContent, index) => {
      const trimmedContent = cellContent.trim();
      const startPosition = currentPosition;
      const endPosition = currentPosition + cellContent.length;
      
      // Update position for next cell (including separator length)
      currentPosition = endPosition + (index < parts.length - 1 ? CELL_SEPARATOR.length : 0);
      
      // Extract role from markdown header (## ROLE format)
      const roleMatch = trimmedContent.match(/^##\s+([A-Z]+)$/);
      if (roleMatch) {
        currentRole = roleMatch[1];
        return {
          id: index,
          content: '',
          role: currentRole,
          isEmpty: false,
          startPosition,
          endPosition,
          rawContent: cellContent,
          isGovernment: convertRoleToSide(currentRole),
          isRoleHeader: true
        };
      }
      
      // If the content starts with ## ROLE but has more content, split it
      const roleWithContentMatch = trimmedContent.match(/^##\s+([A-Z]+)\n(.*)/s);
      if (roleWithContentMatch) {
        currentRole = roleWithContentMatch[1];
        const content = roleWithContentMatch[2].trim();
        
        // Create two cells: one for the role header and one for the content
        const roleCell = {
          id: index,
          content: '',
          role: currentRole,
          isEmpty: false,
          startPosition,
          endPosition: startPosition + roleWithContentMatch[0].length,
          rawContent: `## ${currentRole}`,
          isGovernment: convertRoleToSide(currentRole),
          isRoleHeader: true
        };
        
        const contentCell = {
          id: index + 0.5, // Use decimal to maintain order
          content,
          role: currentRole,
          isEmpty: content === '',
          startPosition: startPosition + roleWithContentMatch[0].length,
          endPosition,
          rawContent: content,
          isGovernment: convertRoleToSide(currentRole),
          isRoleHeader: false
        };
        
        return [roleCell, contentCell];
      }
      
      return {
        id: index,
        content: trimmedContent,
        role: currentRole,
        isEmpty: trimmedContent === '',
        startPosition,
        endPosition,
        rawContent: cellContent,
        isGovernment: currentRole ? convertRoleToSide(currentRole) : undefined,
        isRoleHeader: false
      };
    }).flat(); // Flatten the array in case we have nested arrays from split cells
    
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
    
    // Simple approach: just render with basic JSX elements to avoid innerHTML
    const lines = content.split('\n');
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
    const cell = cellData[index];
    return getSideColor(cell?.isGovernment, 'background');
  };

  const getHighlightColor = (index) => {
    const cell = cellData[index];
    return getSideColor(cell?.isGovernment, 'highlight');
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
