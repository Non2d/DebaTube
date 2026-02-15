"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, Save } from 'lucide-react';
import { getAPIRoot } from '@/components/lib/utils';
import toast from 'react-hot-toast';
import { TimelineEditor } from './TimelineEditor';

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

interface ManualDiarizationWorkflowProps {
    roundId: string;
    roundName: string;
    t: (key: string) => string;
    onComplete: () => void;
    debateFormat?: string;
    onZeroSecondSpeeches?: (positions: string[]) => void;
}

const BP_POSITIONS = [
    "Proposition_1st", "Opposition_1st",
    "Proposition_2nd", "Opposition_2nd",
    "Proposition_3rd", "Opposition_3rd",
    "Proposition_4th", "Opposition_4th"
];

const ASIAN_POSITIONS = [
    "Proposition_1st", "Opposition_1st",
    "Proposition_2nd", "Opposition_2nd",
    "Proposition_3rd", "Opposition_3rd",
    "Opposition_4th", "Proposition_4th"
];

const NA_POSITIONS = [
    "Proposition_1st", "Opposition_1st",
    "Proposition_2nd", "Opposition_2nd",
    "Opposition_3rd", "Proposition_3rd"
];

// This component only handles Step 2 (Diarization)
// Steps 1, 3, and 4 are handled by the existing ProcessingSteps flow
export function ManualDiarizationWorkflow({
    roundId,
    roundName,
    t,
    onComplete,
    debateFormat = "british_parliamentary",
    onZeroSecondSpeeches
}: ManualDiarizationWorkflowProps) {
    const [sentences, setSentences] = useState<Sentence[]>([]);
    const [speeches, setSpeeches] = useState<Speech[]>([]);
    const [videoId, setVideoId] = useState<string>("");

    const [diarizationPrompt, setDiarizationPrompt] = useState("");
    const [diarizationJson, setDiarizationJson] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [isPromptReady, setIsPromptReady] = useState(false);

    useEffect(() => {
        const initializeData = async () => {
            await fetchSentences();
            await fetchSpeeches();
        };
        initializeData();
        fetchRoundInfo();
    }, [roundId]);

    // speeches が変わるたびに0秒スピーチをチェックして親に通知
    useEffect(() => {
        if (onZeroSecondSpeeches) {
            const zeros = speeches
                .filter(s => s.first_sentence_id != null && s.first_sentence_id === s.last_sentence_id)
                .map(s => s.position);
            onZeroSecondSpeeches(zeros);
        }
    }, [speeches]);

    const fetchRoundInfo = async () => {
        try {
            const res = await fetch(getAPIRoot() + `/rounds/${roundId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.video_id) {
                    setVideoId(data.video_id);
                }
            }
        } catch (e) { console.error(e); }
    };

    const fetchSentences = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(getAPIRoot() + `/rounds/${roundId}/sentences_with_time`);
            if (res.ok) {
                const data = await res.json();
                setSentences(data);
                generateDiarizationPrompt(data);
            }
        } catch (e) {
            toast.error("Failed to load sentences");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSpeeches = async () => {
        try {
            const speechesRes = await fetch(getAPIRoot() + `/rounds/${roundName}/speeches`);
            if (speechesRes.ok) {
                const loadedSpeeches = await speechesRes.json();
                if (loadedSpeeches.length > 0) {
                    setSpeeches(loadedSpeeches);
                } else {
                    let positions = BP_POSITIONS;
                    const fmt = (debateFormat || "").toLowerCase();
                    if (fmt.includes("asian") || fmt.includes("wsdc")) positions = ASIAN_POSITIONS;
                    else if (fmt.includes("north") || fmt.includes("na")) positions = NA_POSITIONS;

                    setSpeeches(positions.map(p => ({ position: p, first_sentence_id: null, last_sentence_id: null })));
                }
            }
        } catch (e) {
            let positions = BP_POSITIONS;
            const fmt = (debateFormat || "").toLowerCase();
            if (fmt.includes("asian") || fmt.includes("wsdc")) positions = ASIAN_POSITIONS;
            else if (fmt.includes("north") || fmt.includes("na")) positions = NA_POSITIONS;

            setSpeeches(positions.map(p => ({ position: p, first_sentence_id: null, last_sentence_id: null })));
        }
    };

    const generateDiarizationPrompt = (sentenceData: Sentence[]) => {
        if (!sentenceData || sentenceData.length === 0) return;

        let transcriptPreview = "{\n";
        sentenceData.forEach((s, index) => {
            const localId = index + 1; // 1-based local index
            transcriptPreview += `${localId}: "${s.text.replace(/"/g, '\\"')}"\n`;
        });
        transcriptPreview += "}";

        // Determine expected positions based on debate format
        let positions = BP_POSITIONS;
        const fmt = (debateFormat || "").toLowerCase();
        if (fmt.includes("asian") || fmt.includes("wsdc")) positions = ASIAN_POSITIONS;
        else if (fmt.includes("north") || fmt.includes("na")) positions = NA_POSITIONS;

        const systemPrompt = `You are a debate diarization expert.
Format: ${debateFormat}
Expected Speakers: ${positions.join(", ")}
`;

        const prompt = `${systemPrompt}# Instruction

The following transcript is from parliamentary debate. Please detect debaters and return ids of first and last sentence from each speaker.

IMPORTANT RULES:
1. Transcripts may include statements from judges or timekeepers - IGNORE these parts
2. DO NOT consider Point of Information (questions during opponent speeches) as speaker changes
3. You MUST use ONLY these exact position names (no other names allowed):
   ${positions.map(p => `- ${p}`).join('\n   ')}

Return ONLY a JSON object with these exact keys. DO NOT add any other positions like "Reply" speeches.
Use the format [start_id, end_id] for each position.

Example response format:
{
    "Proposition_1st": [10, 20],
    "Opposition_1st": [21, 30],
    ...
}

# Transcription

${transcriptPreview}`;
        setDiarizationPrompt(prompt);
        setIsPromptReady(true);
    };

    const handleDiarizationSubmit = async () => {
        try {
            let parsed = JSON.parse(diarizationJson);
            const entries = [];
            const newSpeeches = [...speeches];

            for (const [key, val] of Object.entries(parsed)) {
                let startLocalIdx: number, endLocalIdx: number;
                if (Array.isArray(val) && val.length >= 2) {
                    startLocalIdx = Number(val[0]);
                    endLocalIdx = Number(val[1]);
                } else {
                    continue;
                }

                // Convert 1-based local index to actual database sentence ID
                const startSentence = sentences[startLocalIdx - 1];
                const endSentence = sentences[endLocalIdx - 1];

                if (!startSentence || !endSentence) {
                    toast.error(`Invalid index for ${key}: [${startLocalIdx}, ${endLocalIdx}]`);
                    continue;
                }

                const start = startSentence.id;
                const end = endSentence.id;

                const idx = newSpeeches.findIndex(s => s.position === key);
                if (idx !== -1) {
                    newSpeeches[idx].first_sentence_id = start;
                    newSpeeches[idx].last_sentence_id = end;
                }

                entries.push({
                    position: key,
                    first_sentence_id: start,
                    last_sentence_id: end
                });
            }

            setSpeeches(newSpeeches);

            setIsLoading(true);
            const res = await fetch(getAPIRoot() + `/rounds/${roundId}/diarization`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries }),
            });

            if (!res.ok) throw new Error("Failed to register diarization");

            const data = await res.json();
            const updatedSpeeches = data.speeches ?? data;
            setSpeeches(updatedSpeeches);
            if (data.warnings && data.warnings.length > 0) {
                data.warnings.forEach((w: string) => toast(w, { icon: '⚠️', duration: 6000 }));
            }
            toast.success("Diarization Saved!");
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied");
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
            {/* STEP 2-A */}
            <div className="space-y-4 animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="font-bold text-lg">{t('dashboard.steps.subStep2A.title') || "Step 2-A: Initial AI Diarization"}</h3>
                            <p className="text-sm text-slate-500">{t('dashboard.steps.subStep2A.description') || "Generate an initial proposal for speaker separation using LLM."}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleCopy(diarizationPrompt)} disabled={!isPromptReady}>
                            <Copy className="w-4 h-4 mr-2" /> {t('dashboard.steps.actions.copyPrompt') || "Copy Prompt"}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>{t('dashboard.steps.labels.transcriptPrompt') || "Transcript Prompt (Auto-generated)"}</Label>
                            <Textarea
                                value={isLoading ? (t('dashboard.steps.status.loadingSentences') || "Loading sentences...") : diarizationPrompt}
                                readOnly
                                className="h-[400px] font-mono text-xs bg-slate-50 dark:bg-slate-800 leading-tight"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('dashboard.steps.labels.geminiResponse') || "Gemini Response (Paste JSON here)"}</Label>
                            <Textarea
                                value={diarizationJson}
                                onChange={(e) => setDiarizationJson(e.target.value)}
                                placeholder={`Example:
{
  "Proposition_1st": [1, 10],
  "Opposition_1st": [11, 25],
  ...
}`}
                                className="h-[400px] font-mono text-xs bg-white dark:bg-slate-900 leading-tight"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <Button onClick={handleDiarizationSubmit} disabled={isLoading || !diarizationJson} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[200px]">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {t('dashboard.steps.actions.registerVerify') || "Register & Verify"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* STEP 2-B */}
            <TimelineEditor
                sentences={sentences}
                speeches={speeches}
                videoId={videoId}
                roundId={roundId}
                setSpeeches={setSpeeches}
                t={t}
            />
        </div>
    );
}
