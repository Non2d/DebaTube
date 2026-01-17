"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, Save, ArrowLeft, Play, Pause } from 'lucide-react';
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
    const [isPlaying, setIsPlaying] = useState(false);
    const [dragging, setDragging] = useState<{ speechIndex: number; edge: 'start' | 'end' } | null>(null);

    useEffect(() => {
        setLocalSpeeches(speeches);
    }, [speeches]);

    const handlePlayerReady = (event: any) => {
        playerRef.current = event.target;
        setDuration(event.target.getDuration());
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
                    <h3 className="font-bold text-lg">Step 2-B: Visual Diarization Editor</h3>
                    <p className="text-sm text-slate-500">Drag the colored bars to adjust speaker ranges</p>
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
                    <div className="flex items-center justify-center h-full text-white">Video ID not found</div>
                )}
            </div>

            {/* Timeline Editor */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label className="font-semibold">Speaker Timeline</Label>
                    <Button size="sm" variant="ghost" onClick={togglePlayPause}>
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                </div>

                <div
                    ref={timelineRef}
                    className="relative h-24 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer select-none border-2 border-slate-300 dark:border-slate-600"
                    onClick={handleTimelineClick}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Speaker Bars */}
                    {localSpeeches.map((speech, idx) => {
                        if (!speech.first_sentence_id || !speech.last_sentence_id || duration === 0) return null;

                        const startTime = getTimeFromSentenceId(speech.first_sentence_id);
                        const endTime = getEndTimeFromSentenceId(speech.last_sentence_id);
                        const left = (startTime / duration) * 100;
                        const width = ((endTime - startTime) / duration) * 100;

                        const isProposition = speech.position.includes('Proposition');
                        const color = isProposition ? 'bg-red-500' : 'bg-blue-500';
                        const hoverColor = isProposition ? 'hover:bg-red-600' : 'hover:bg-blue-600';

                        // Two rows: Proposition (Top), Opposition (Bottom)
                        const topPosition = isProposition ? '10px' : '50px';

                        return (
                            <div
                                key={idx}
                                className={`absolute h-8 ${color} opacity-70 hover:opacity-90 transition-opacity rounded`}
                                style={{
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    top: topPosition
                                }}
                            >
                                {/* Start Handle */}
                                <div
                                    className={`absolute left-0 top-0 w-2 h-full ${hoverColor} cursor-ew-resize`}
                                    onMouseDown={(e) => handleBarMouseDown(idx, 'start', e)}
                                />

                                {/* Label */}
                                <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold px-2 truncate pointer-events-none">
                                    {speech.position.replace(/_/g, ' ')}
                                </div>

                                {/* End Handle */}
                                <div
                                    className={`absolute right-0 top-0 w-2 h-full ${hoverColor} cursor-ew-resize`}
                                    onMouseDown={(e) => handleBarMouseDown(idx, 'end', e)}
                                />
                            </div>
                        );
                    })}

                    {/* Current Time Indicator */}
                    {duration > 0 && (
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 pointer-events-none z-10"
                            style={{ left: `${(currentTime / duration) * 100}%` }}
                        >
                            <div className="absolute -top-1 w-3 h-3 bg-yellow-400 rounded-full" style={{ left: '-5px' }} />
                        </div>
                    )}
                </div>

                {/* Time Labels */}
                <div className="flex justify-between text-xs text-slate-500 px-1">
                    <span>0:00</span>
                    <span>{new Date(duration * 1000).toISOString().substr(11, 8)}</span>
                </div>
            </div>

            {/* Speech List */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {localSpeeches.map((speech, idx) => (
                    <div
                        key={idx}
                        className={`p-2 rounded border text-xs ${speech.position.includes('Proposition')
                            ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                            : 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                            }`}
                    >
                        <div className="font-bold truncate">{speech.position.replace(/_/g, ' ')}</div>
                        <div className="text-slate-600 dark:text-slate-400">
                            #{getSentenceLocalIndex(speech.first_sentence_id)} - #{getSentenceLocalIndex(speech.last_sentence_id)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[200px]">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Confirm & Continue
                </Button>
            </div>
        </div>
    );
}
