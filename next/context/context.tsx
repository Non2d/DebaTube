"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextProps {
    pois: number[];
    setPois: React.Dispatch<React.SetStateAction<number[]>>;
    nodeTransparency: number;
    setNodeTransparency: React.Dispatch<React.SetStateAction<number>>;
    isNA: boolean;
    setIsNA: React.Dispatch<React.SetStateAction<boolean>>;
    zoomLevel: number;
    setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
    asrFileName: string | null;
    setAsrFileName: React.Dispatch<React.SetStateAction<string | null>>;
    diarizationFileName: string | null;
    setDiarizationFileName: React.Dispatch<React.SetStateAction<string | null>>;
    exportFileName: string | null;
    setExportFileName: React.Dispatch<React.SetStateAction<string | null>>;
    youtubeLink: string;
    setYoutubeLink: React.Dispatch<React.SetStateAction<string>>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [pois, setPois] = useState<number[]>([]);
    const [nodeTransparency, setNodeTransparency] = useState<number>(0.7);
    const [isNA, setIsNA] = useState<boolean>(false);
    const [zoomLevel, setZoomLevel] = useState<number>(10);
    const [asrFileName, setAsrFileName] = useState<string | null>(null);
    const [diarizationFileName, setDiarizationFileName] = useState<string | null>(null);
    const [exportFileName, setExportFileName] = useState<string | null>(null);
    const [youtubeLink, setYoutubeLink] = useState<string>('');

    return (
        <AppContext.Provider value={{ pois, setPois, nodeTransparency, setNodeTransparency, isNA, setIsNA, zoomLevel, setZoomLevel, asrFileName, setAsrFileName, diarizationFileName, setDiarizationFileName, exportFileName, setExportFileName, youtubeLink, setYoutubeLink }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};