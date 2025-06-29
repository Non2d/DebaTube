import React, { useState } from 'react';
import { Menu, X, Download } from 'lucide-react';
import { useAppContext } from '../../../../context/context';

interface SidebarTimelineProps {
    isNA: boolean;
    setIsNA: React.Dispatch<React.SetStateAction<boolean>>;
    zoomLevel: number;
    setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
    nodeTransparency: number;
    setNodeTransparency: React.Dispatch<React.SetStateAction<number>>;
    handleExportJson: () => void;
    onAsrFileSelect: (file: File) => void;
    onDiarizationFileSelect: (file: File) => void;
}

const SidebarTimeline = ({ isNA, setIsNA, zoomLevel, setZoomLevel, nodeTransparency, setNodeTransparency, handleExportJson, onAsrFileSelect, onDiarizationFileSelect }: SidebarTimelineProps) => {
    const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

    const { asrFileName, setAsrFileName, diarizationFileName, setDiarizationFileName, exportFileName, setExportFileName, youtubeLink, setYoutubeLink } = useAppContext();

    const [isOpen, setIsOpen] = useState(false);

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative h-screen">
            <button
                onClick={toggleSidebar}
                className="fixed top-24 right-4 z-30 p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div
                className={`rounded z-20 fixed top-20 right-0 h-full w-80 bg-gray-800 text-white p-5 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <nav className="mt-16 space-y-6">
                    <div>
                        <label
                            htmlFor="asr-file-upload"
                            className="block w-full cursor-pointer"
                        >
                            <div
                                className="inline-block w-full text-2xl py-2 px-4 rounded border-0 font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 text-center"
                            >
                                ASR File...
                            </div>
                        </label>
                        <input
                            id="asr-file-upload"
                            type="file"
                            accept=".csv"
                            onChange={async (e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    onAsrFileSelect(e.target.files[0]);
                                    setAsrFileName(e.target.files[0].name);

                                    const exportFileNameWoExt = e.target.files[0].name.replace(/\..*$/, '');
                                    setExportFileName(exportFileNameWoExt + ".json");
                                    const response = await fetch(
                                        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(
                                            exportFileNameWoExt
                                        )}&key=${YOUTUBE_API_KEY}`
                                    );
                                    const data = await response.json();
                                    if (data.items && data.items.length > 0) {
                                        const firstVideo = data.items[0];
                                        const inputYoutubeUrl = `https://www.youtube.com/watch?v=${firstVideo.id.videoId}`;
                                        setYoutubeLink(inputYoutubeUrl);
                                    } else {
                                        setYoutubeLink('Video not found from uploaded file name.');
                                    }
                                } else {
                                    setAsrFileName(null);
                                }
                            }}
                            className="hidden"
                        />
                        <p className="mt-2 text-sm text-gray-400">
                            {asrFileName ? asrFileName : 'File is not selected'}
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="diarization-file-upload"
                            className="block w-full cursor-pointer"
                        >
                            <div
                                className="inline-block w-full text-2xl py-2 px-4 rounded border-0 font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 text-center"
                            >
                                Diarization File...
                            </div>
                        </label>
                        <input
                            id="diarization-file-upload"
                            type="file"
                            accept=".csv"
                            onChange={async (e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    onDiarizationFileSelect(e.target.files[0]);
                                    setDiarizationFileName(e.target.files[0].name);
                                    setExportFileName(e.target.files[0].name.replace(/\..*$/, '') + ".json");

                                    const exportFileNameWoExt = e.target.files[0].name.replace(/\..*$/, '');
                                    setExportFileName(exportFileNameWoExt + ".json");
                                    const response = await fetch(
                                        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
                                            exportFileNameWoExt
                                        )}&key=${YOUTUBE_API_KEY}`
                                    );
                                    const data = await response.json();
                                    if (data.items && data.items.length > 0) {
                                        const firstVideo = data.items[0];
                                        const inputYoutubeUrl = `https://www.youtube.com/watch?v=${firstVideo.id.videoId}`;
                                        setYoutubeLink(inputYoutubeUrl);
                                    } else {
                                        setYoutubeLink('Video not found from uploaded file name.');
                                    }
                                } else {
                                    setDiarizationFileName(null);
                                }
                            }}
                            className="hidden"
                        />
                        <p className="mt-2 text-sm text-gray-400">
                            {diarizationFileName ? diarizationFileName : 'File is not selected'}
                        </p>
                    </div>

                    <div>
                        <button
                            onClick={() => setIsNA(!isNA)}
                            className="w-full py-2 px-4 bg-white text-gray-800 rounded hover:bg-gray-200 transition-colors text-2xl"
                        >
                            <span className="font-bold text-blue-600">{isNA ? 'NA' : 'Asian'}</span> style
                        </button>
                    </div>

                    <div>
                        <label className="block mb-2 font-bold">Time scale</label>
                        <input
                            type="range"
                            min="3"
                            max="25"
                            step="1"
                            value={zoomLevel}
                            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block mb-2 font-bold">Node transparency</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={nodeTransparency}
                            onChange={(e) => setNodeTransparency(parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>
                    <div className="mt-4">
                        <label>
                            <span className="font-bold">Youtube Link</span>
                            <input
                                type="text"
                                value={youtubeLink}
                                onChange={(e) => setYoutubeLink(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=4HUFM3JZaLQ"
                                className="mt-2 w-full text-black h-10 rounded"
                            />
                        </label>
                    </div>
                    <div>
                        <button
                            onClick={handleExportJson}
                            className="font-bold mt-10 w-full py-5 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center justify-center"
                        >
                            <Download size={18} className="mr-2" />
                            Export JSON
                        </button>
                        <p className="mt-2 text-sm text-gray-400">
                            {exportFileName ? exportFileName : 'File is not selected'}
                        </p>
                    </div>
                </nav>
            </div>
        </div>
    );
};

export default SidebarTimeline;