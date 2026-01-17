"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, Save, ArrowLeft, Play, Pause, RotateCcw } from 'lucide-react';
import { getAPIRoot } from '@/components/lib/utils';
import toast from 'react-hot-toast';
import YouTube from 'react-youtube';

interface Sentence {
    id: number;
    text: string;
    start_time: number;
    end_time: number;
}

interface Speech {
    id?: number;
    position: string;
    first_sentence_id: number | null;
    last_sentence_id: number | null;
}

interface TimelineEditorProps {
    sentences: Sentence[];
    speeches: Speech[];
    videoId: string;
    roundId: string;
    setSpeeches: (speeches: Speech[]) => void;
    t: (key: string) => string;
}

export function TimelineEditor({
    sentences,
    speeches,
    videoId,
    roundId,
    setSpeeches,
    t
}: TimelineEditorProps) {
    const playerRef = useRef<any>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [localSpeeches, setLocalSpeeches] = useState<Speech[]>(speeches);
    const [isSaving, setIsSaving] = useState(false);
    const [isReloading, setIsReloading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [dragging, setDragging] = useState<{ speechIndex: number; edge: 'start' | 'end' } | null>(null);

    useEffect(() => {
        setLocalSpeeches(speeches);
    }, [speeches]);

    const handlePlayerReady = (event: any) => {
        playerRef.current = event.target;
        setDuration(event.target.getDuration());
    };

    const handleReload = async () => {
        setIsReloading(true);
        try {
            const res = await fetch(getAPIRoot() + `/rounds/id/${roundId}/speeches`);
            if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                    setSpeeches(data);
                    // localSpeeches will be updated via useEffect
                    toast.success("Timeline reset to database values");
                }
            } else {
                toast.error("Failed to reload speeches");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error reloading speeches");
        } finally {
            setIsReloading(false);
        }
    };

    const handlePlayerStateChange = (event: any) => {
        setIsPlaying(event.data === 1); // 1 = playing
    };

    useEffect(() => {
        let animationFrameId: number;

        const updateTime = async () => {
            if (playerRef.current && isPlaying) {
                try {
                    const time = await playerRef.current.getCurrentTime();
                    setCurrentTime(time);
                    animationFrameId = requestAnimationFrame(updateTime);
                } catch (e) {
                    // Ignore errors
                }
            }
        };

        if (isPlaying) {
            updateTime();
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [isPlaying]);

    const getTimeFromSentenceId = (sentenceId: number): number => {
        const sentence = sentences.find(s => s.id === sentenceId);
        return sentence ? sentence.start_time : 0;
    };

    const getEndTimeFromSentenceId = (sentenceId: number): number => {
        const sentence = sentences.find(s => s.id === sentenceId);
        return sentence ? sentence.end_time : 0;
    };

    const getSentenceIdFromTime = (time: number): number => {
        // Find closest sentence
        let closest = sentences[0];
        let minDiff = Math.abs(sentences[0].start_time - time);

        for (const s of sentences) {
            const diff = Math.abs(s.start_time - time);
            if (diff < minDiff) {
                minDiff = diff;
                closest = s;
            }
        }
        return closest.id;
    };

    const getSentenceLocalIndex = (sentenceId: number | null | undefined): string => {
        if (!sentenceId) return '?';
        const index = sentences.findIndex(s => s.id === sentenceId);
        return index !== -1 ? (index + 1).toString() : '?';
    };

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current || duration === 0) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickedTime = (x / rect.width) * duration;

        if (playerRef.current) {
            playerRef.current.seekTo(clickedTime, true);
            setCurrentTime(clickedTime);
        }
    };

    const handleBarMouseDown = (speechIndex: number, edge: 'start' | 'end', e: React.MouseEvent) => {
        e.stopPropagation();
        setDragging({ speechIndex, edge });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!dragging || !timelineRef.current || duration === 0) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = Math.max(0, Math.min(duration, (x / rect.width) * duration));
        const sentenceId = getSentenceIdFromTime(time);

        const newSpeeches = [...localSpeeches];
        if (dragging.edge === 'start') {
            newSpeeches[dragging.speechIndex].first_sentence_id = sentenceId;
        } else {
            newSpeeches[dragging.speechIndex].last_sentence_id = sentenceId;
        }
        setLocalSpeeches(newSpeeches);
    };

    const handleMouseUp = () => {
        setDragging(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const entries = localSpeeches
                .filter(s => s.first_sentence_id && s.last_sentence_id)
                .map(s => ({
                    position: s.position,
                    first_sentence_id: s.first_sentence_id!,
                    last_sentence_id: s.last_sentence_id!
                }));

            const res = await fetch(getAPIRoot() + `/rounds/${roundId}/diarization`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries }),
            });

            if (!res.ok) throw new Error("Failed to save");

            const updated = await res.json();
            setSpeeches(updated);
            toast.success("Diarization saved!");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const togglePlayPause = () => {
        if (playerRef.current) {
            if (isPlaying) {
                playerRef.current.pauseVideo();
            } else {
                playerRef.current.playVideo();
            }
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg">{t('dashboard.steps.subStep2B.title') || "Step 2-B: Visual Diarization Editor"}</h3>
                    <p className="text-sm text-slate-500">{t('dashboard.steps.subStep2B.description') || "Drag the colored bars to adjust speaker ranges"}</p>
                </div>
            </div>

            {/* Video Player */}
            <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                {videoId ? (
                    <YouTube
                        videoId={videoId}
                        onReady={handlePlayerReady}
                        onStateChange={handlePlayerStateChange}
                        opts={{
                            width: '100%',
                            height: '100%',
                            playerVars: {
                                playsinline: 1,
                                controls: 1
                            }
                        }}
                        className="w-full h-full"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-white">{t('dashboard.steps.errors.videoNotFound') || "Video ID not found"}</div>
                )}
            </div>

            {/* Timeline Editor */}
            <div className="space-y-2">
                <div
                    ref={timelineRef}
                    className="relative h-24 bg-slate-50 dark:bg-slate-900 rounded-lg cursor-pointer select-none border border-slate-200 dark:border-slate-700 mt-10 mb-8"
                    onClick={handleTimelineClick}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Speaker Bars & Guides */}
                    {[...localSpeeches]
                        .sort((a, b) => (a.first_sentence_id || 0) - (b.first_sentence_id || 0))
                        .map((speech, sortedIdx) => {
                            if (!speech.first_sentence_id || !speech.last_sentence_id || duration === 0) return null;

                            // Find the index in the original array to safely update state
                            const originalIndex = localSpeeches.indexOf(speech);

                            const startTime = getTimeFromSentenceId(speech.first_sentence_id);
                            const endTime = getEndTimeFromSentenceId(speech.last_sentence_id);
                            const left = (startTime / duration) * 100;
                            const width = ((endTime - startTime) / duration) * 100;
                            const right = left + width;

                            const isProposition = speech.position.includes('Proposition');
                            const baseColor = isProposition ? 'bg-red-500' : 'bg-blue-500';
                            const borderColor = isProposition ? 'border-red-500' : 'border-blue-500';
                            const textColor = isProposition ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400';

                            // Strict Layout: Even Index (in sorted time order) = Top, Odd = Bottom
                            const isEven = sortedIdx % 2 === 0;

                            // Compact vertical layout:
                            // Top row: 12px
                            // Bottom row: 52px (leaving 16px vertical gap between rows)
                            const barTop = isEven ? '12px' : '52px';

                            // Labels follow the bar position but sit OUTSIDE the container
                            const labelStyle = isEven
                                ? { top: '-20px', bottom: 'auto' }
                                : { top: 'auto', bottom: '-20px' };

                            const shortLabel = speech.position.split('_').pop();

                            return (
                                <React.Fragment key={sortedIdx}>
                                    {/* Vertical Guide Lines & Labels */}
                                    <div
                                        className="absolute top-0 bottom-0 pointer-events-none w-[2px] text-slate-400 dark:text-slate-500 z-0"
                                        style={{
                                            left: `${left}%`,
                                            background: 'linear-gradient(to bottom, currentColor 50%, transparent 50%)',
                                            backgroundSize: '2px 12px' // 6px dash, 6px gap
                                        }}
                                    >
                                        <span className={`absolute -translate-x-1/2 text-[10px] font-mono font-bold ${textColor}`} style={labelStyle}>
                                            #{getSentenceLocalIndex(speech.first_sentence_id)}
                                        </span>
                                    </div>
                                    <div
                                        className="absolute top-0 bottom-0 pointer-events-none w-[2px] text-slate-400 dark:text-slate-500 z-0"
                                        style={{
                                            left: `${right}%`,
                                            background: 'linear-gradient(to bottom, currentColor 50%, transparent 50%)',
                                            backgroundSize: '2px 12px' // 6px dash, 6px gap
                                        }}
                                    >
                                        <span className={`absolute -translate-x-1/2 text-[10px] font-mono font-bold ${textColor}`} style={labelStyle}>
                                            #{getSentenceLocalIndex(speech.last_sentence_id)}
                                        </span>
                                    </div>

                                    {/* Interactive Bar */}
                                    <div
                                        className={`absolute h-6 ${baseColor} border ${borderColor} bg-opacity-20 hover:bg-opacity-40 transition-all rounded shadow-sm z-10 group`}
                                        style={{
                                            left: `${left}%`,
                                            width: `${width}%`,
                                            top: barTop
                                        }}
                                    >
                                        {/* Start Handle */}
                                        <div
                                            className="absolute left-0 top-0 w-2 h-full cursor-ew-resize hover:bg-black/10 transition-colors"
                                            onMouseDown={(e) => handleBarMouseDown(originalIndex, 'start', e)}
                                        />

                                        {/* Label in Bar (Shortened) */}
                                        <div className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold px-1 truncate pointer-events-none opacity-90 ${textColor}`}>
                                            {shortLabel}
                                        </div>

                                        {/* End Handle */}
                                        <div
                                            className="absolute right-0 top-0 w-2 h-full cursor-ew-resize hover:bg-black/10 transition-colors"
                                            onMouseDown={(e) => handleBarMouseDown(originalIndex, 'end', e)}
                                        />
                                    </div>
                                </React.Fragment>
                            );
                        })}

                    {/* Play Head */}
                    {duration > 0 && (
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-600 pointer-events-none z-20"
                            style={{ left: `${(currentTime / duration) * 100}%` }}
                        >
                            <div className="absolute -top-1 w-3 h-3 bg-red-600 rounded-full shadow-sm" style={{ left: '-5px' }} />
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={handleReload} disabled={isReloading || isSaving} className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/20">
                    <RotateCcw className={`w-4 h-4 mr-2 ${isReloading ? "animate-spin" : ""}`} />
                    {t('dashboard.steps.actions.resetToLastSaved') || "Reset to Last Saved"}
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[200px]">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {t('dashboard.steps.actions.updateContinue') || "Update & Continue"}
                </Button>
            </div>
        </div>
    );
}
