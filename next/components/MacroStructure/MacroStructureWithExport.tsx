"use client";

import React, { useRef } from 'react';
import MacroStructure from './MacroStructure';
import ImageExportButton from '../ImageExport/ImageExportButton';

interface MacroStructureWithExportProps {
    data: any;
    onGraphNodeClicked: any;
    isPinned: boolean;
    title?: string;
    showExportButton?: boolean;
}

export default function MacroStructureWithExport({ 
    data, 
    onGraphNodeClicked, 
    isPinned, 
    title = 'graph',
    showExportButton = true 
}: MacroStructureWithExportProps) {
    const macroStructureRef = useRef<HTMLDivElement>(null);

    return (
        <div className="relative w-full h-full">
            <MacroStructure
                ref={macroStructureRef}
                data={data}
                onGraphNodeClicked={onGraphNodeClicked}
                isPinned={isPinned}
            />
            
            {showExportButton && isPinned && (
                <div className="absolute top-2 right-2 z-10">
                    <ImageExportButton
                        targetRef={macroStructureRef}
                        fileName={title}
                    />
                </div>
            )}
        </div>
    );
}
