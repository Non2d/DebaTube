
import { useState, useRef, useEffect, useCallback } from 'react';
import { SpeechFormat } from '../../../../constants/constants';
import { useTranslation } from '../../../../context/LanguageContext';
import { getAudioDuration } from '../../../../components/lib/audioUtils';

export interface RecordingData {
    blob: Blob;
    duration: number;
    timestamp: string;
}

export interface SpeechRecordings {
    [key: number]: RecordingData[];
}

export function useRecordings(
    roundName: string,
    currentSpeechIndex: number,
    currentSpeechName: string
) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [speechRecordings, setSpeechRecordings] = useState<SpeechRecordings>({});

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const durationRef = useRef<number>(0);
    const { t } = useTranslation();

    // Load existing audio files from server when round name changes
    useEffect(() => {
        const loadExistingRecordings = async () => {
            if (!roundName) return;

            try {
                const response = await fetch(`http://localhost:8080/audio/match/${roundName}`);

                if (!response.ok) {
                    if (response.status === 404) {
                        console.log('No existing recordings for this match - resetting');
                        setSpeechRecordings({});
                        return;
                    }
                    throw new Error(`Failed to load recordings: ${response.statusText}`);
                }

                const data = await response.json();

                if (!data.success || !data.files || data.files.length === 0) {
                    console.log('No recordings found for this match');
                    return;
                }

                const recordingsByIndex: SpeechRecordings = {};

                for (const fileInfo of data.files) {
                    const parts = fileInfo.filename.split('_');
                    let speechIndex: number | null = null;

                    if (parts.length >= 1) {
                        const firstPart = parseInt(parts[0]);
                        if (!isNaN(firstPart)) {
                            speechIndex = firstPart;
                        } else {
                            const filename = fileInfo.filename.toLowerCase();
                            if (filename.includes('proposition_1st')) speechIndex = 0;
                            else if (filename.includes('opposition_1st')) speechIndex = 1;
                            else if (filename.includes('proposition_2nd')) speechIndex = 2;
                            else if (filename.includes('opposition_2nd')) speechIndex = 3;
                            else if (filename.includes('proposition_3rd')) speechIndex = 4;
                            else if (filename.includes('opposition_3rd')) speechIndex = 5;
                        }
                    }

                    if (speechIndex === null || isNaN(speechIndex)) continue;

                    const audioResponse = await fetch(`http://localhost:8080/audio/file/${roundName}/${fileInfo.filename}`);
                    if (!audioResponse.ok) {
                        console.error(`Failed to fetch audio file: ${fileInfo.filename}`);
                        continue;
                    }

                    const blob = await audioResponse.blob();

                    let duration = fileInfo.duration || 0;
                    if (duration === 0 && (fileInfo.filename.toLowerCase().endsWith('.mp3') || blob.type.includes('audio'))) {
                        duration = await getAudioDuration(blob);
                    }

                    const recordingData = {
                        blob,
                        duration,
                        timestamp: new Date(fileInfo.modified * 1000).toISOString()
                    };

                    if (!recordingsByIndex[speechIndex]) {
                        recordingsByIndex[speechIndex] = [];
                    }
                    recordingsByIndex[speechIndex].push(recordingData);
                }

                Object.keys(recordingsByIndex).forEach(key => {
                    const index = parseInt(key);
                    recordingsByIndex[index].sort((a, b) =>
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );
                });

                setSpeechRecordings(recordingsByIndex);
            } catch (error) {
                console.error('Failed to load existing recordings:', error);
            }
        };

        loadExistingRecordings();
    }, [roundName]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const recordingData = {
                    blob,
                    duration: durationRef.current,
                    timestamp: new Date().toISOString()
                };

                setSpeechRecordings(prev => ({
                    ...prev,
                    [currentSpeechIndex]: [...(prev[currentSpeechIndex] || []), recordingData]
                }));

                try {
                    const formData = new FormData();
                    formData.append('round_name', roundName);
                    formData.append('speech_index', currentSpeechIndex.toString());
                    const speechName = currentSpeechName.toLowerCase().replace(/ /g, '_');
                    formData.append('speech_name', speechName);
                    formData.append('file', blob, `${speechName}.webm`);
                    formData.append('duration', durationRef.current.toString());

                    const response = await fetch('http://localhost:8080/audio/save', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to save audio: ${response.statusText}`);
                    }

                    const result = await response.json();
                    console.log('Audio saved successfully:', result);
                } catch (error) {
                    console.error('Failed to save recording to API:', error);
                    alert(t('recordPage.messages.failedSave'));
                }

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            durationRef.current = 0;

            intervalRef.current = setInterval(() => {
                setRecordingDuration(prev => {
                    const newDuration = prev + 1;
                    durationRef.current = newDuration;
                    return newDuration;
                });
            }, 1000);
        } catch (error) {
            console.error('Failed to start recording:', error);
            alert(t('recordPage.messages.micDenied'));
        }
    };

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }

            return true; // Signal that recording stopped
        }
        return false;
    }, []);

    const setRecordingDurationSafe = (duration: number) => {
        setRecordingDuration(duration);
        durationRef.current = duration;
    };

    return {
        isRecording,
        recordingDuration,
        setRecordingDuration: setRecordingDurationSafe,
        speechRecordings,
        setSpeechRecordings,
        startRecording,
        stopRecording
    };
}
