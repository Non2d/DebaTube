"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import Header from '../../components/shared/Header';
import RecordButton from './components/RecordButton';
import TimerDisplay from './components/TimerDisplay';
import RecordingCard from './components/RecordingCard';
import RebuttalGraph from './components/RebuttalGraph';

const DEBATE_SPEECHES = [
  { name: 'Proposition 1st', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition 1st', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition 2nd', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition 2nd', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition Whip', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition Whip', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition Reply', duration: 4 * 60, team: 'proposition' },
  { name: 'Opposition Reply', duration: 4 * 60, team: 'opposition' }
] as const;

interface GraphData {
  speeches: { [key: string]: any[] };
  rebuttals: [number, number][];
}

export default function RecordPage() {
  const [matchName, setMatchName] = useState('');
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [speechRecordings, setSpeechRecordings] = useState<{[key: number]: {blob: Blob, duration: number, timestamp: string}[]}>({});
  const [currentPlayingSpeech, setCurrentPlayingSpeech] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load match name from LocalStorage or set default on mount
  useEffect(() => {
    const savedMatchName = localStorage.getItem('debate_match_name');
    if (savedMatchName) {
      setMatchName(savedMatchName);
    } else {
      // Set default match name: YYYY-MM-DD-session_HHmmss
      const now = new Date();
      const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const time = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHmmss
      const defaultName = `${date}-session_${time}`;
      setMatchName(defaultName);
      localStorage.setItem('debate_match_name', defaultName);
    }
  }, []);

  // Save match name to LocalStorage when it changes
  useEffect(() => {
    if (matchName) {
      localStorage.setItem('debate_match_name', matchName);
    }
  }, [matchName]);

  // Load existing audio files from server when match name changes
  useEffect(() => {
    const loadExistingRecordings = async () => {
      if (!matchName) return;

      try {
        const response = await fetch(`http://localhost:8080/audio/match/${matchName}`);

        if (!response.ok) {
          // If match doesn't exist (404), reset all recordings
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

        // Group files by speech_index and fetch them as blobs
        const recordingsByIndex: {[key: number]: {blob: Blob, duration: number, timestamp: string}[]} = {};

        for (const fileInfo of data.files) {
          // Parse filename: {speech_index}_{speech_name}_{sequence}.webm
          const parts = fileInfo.filename.split('_');
          if (parts.length < 3) continue;

          const speechIndex = parseInt(parts[0]);
          if (isNaN(speechIndex)) continue;

          // Fetch the audio file as blob
          const audioResponse = await fetch(`http://localhost:8080/audio/file/${matchName}/${fileInfo.filename}`);
          if (!audioResponse.ok) {
            console.error(`Failed to fetch audio file: ${fileInfo.filename}`);
            continue;
          }

          const blob = await audioResponse.blob();

          // Use duration from server metadata instead of trying to load it from the audio file
          const duration = fileInfo.duration || 0;

          const recordingData = {
            blob,
            duration,
            timestamp: new Date(fileInfo.modified * 1000).toISOString()
          };

          if (!recordingsByIndex[speechIndex]) {
            recordingsByIndex[speechIndex] = [];
          }
          recordingsByIndex[speechIndex].push(recordingData);
          console.log(`Added recording for speech ${speechIndex}: ${fileInfo.filename}, duration=${duration}s`);
        }

        // Sort recordings by timestamp for each speech
        Object.keys(recordingsByIndex).forEach(key => {
          const index = parseInt(key);
          recordingsByIndex[index].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });

        setSpeechRecordings(recordingsByIndex);
        console.log('Loaded existing recordings:', recordingsByIndex);

      } catch (error) {
        console.error('Failed to load existing recordings:', error);
      }
    };

    loadExistingRecordings();
  }, [matchName]);

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

        // Save to API
        try {
          const formData = new FormData();
          formData.append('match_name', matchName);
          formData.append('speech_index', currentSpeechIndex.toString());
          const speechName = DEBATE_SPEECHES[currentSpeechIndex].name.toLowerCase().replace(/ /g, '_');
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
          alert('録音の保存に失敗しました。もう一度お試しください。');
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
      console.error('録音の開始に失敗しました:', error);
      alert('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      setTimeout(() => {
        if (currentSpeechIndex < DEBATE_SPEECHES.length - 1) {
          setCurrentSpeechIndex(currentSpeechIndex + 1);
          setRecordingDuration(0);
          setCurrentPlayingSpeech(null);
        }
      }, 500);
    }
  };

  const handlePlayPause = (index: number) => {
    console.log('handlePlayPause called with index:', index, 'currentPlayingSpeech:', currentPlayingSpeech, 'isPlaying:', isPlaying);
    if (currentPlayingSpeech === index) {
      console.log('Same speech, toggling isPlaying to:', !isPlaying);
      setIsPlaying(!isPlaying);
    } else {
      console.log('Different speech, setting currentPlayingSpeech to:', index, 'and isPlaying to true');
      setCurrentPlayingSpeech(index);
      setIsPlaying(true);
    }
  };

  const downloadAudio = (speechIndex: number) => {
    const recordings = speechRecordings[speechIndex];
    if (recordings && recordings.length > 0) {
      // Download all recordings for this speech
      recordings.forEach((recording, index) => {
        const url = URL.createObjectURL(recording.blob);
        const a = document.createElement('a');
        a.href = url;
        // タイムスタンプを YYYY-MM-DD_HHmmss 形式に変換
        const date = new Date(recording.timestamp);
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
        const timestamp = `${dateStr}_${timeStr}`;
        const suffix = recordings.length > 1 ? `_${index}` : '';
        a.download = `${DEBATE_SPEECHES[speechIndex].name.replace(/ /g, '_')}-${timestamp}${suffix}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
  };

  const nextSpeech = () => {
    if (currentSpeechIndex < DEBATE_SPEECHES.length - 1) {
      setCurrentSpeechIndex(currentSpeechIndex + 1);
      setRecordingDuration(0);
      setCurrentPlayingSpeech(null);
    }
  };

  const prevSpeech = () => {
    if (currentSpeechIndex > 0) {
      setCurrentSpeechIndex(currentSpeechIndex - 1);
      setRecordingDuration(0);
      setCurrentPlayingSpeech(null);
    }
  };

  const goToSpeech = (index: number) => {
    setCurrentSpeechIndex(index);
    setRecordingDuration(0);
    setCurrentPlayingSpeech(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string) as GraphData;
        // バリデーション
        if (json.speeches && json.rebuttals && Array.isArray(json.rebuttals)) {
          setGraphData(json);
        } else {
          alert('Invalid JSON format. Please ensure it contains "speeches" and "rebuttals" properties.');
        }
      } catch (error) {
        alert('Failed to parse JSON file: ' + (error instanceof Error ? error.message : String(error)));
      }
    };
    reader.readAsText(file);

    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const currentSpeech = DEBATE_SPEECHES[currentSpeechIndex];

  return (
    <>
      <Header />
      <div className="pt-20 min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-8 mb-6">
              <button
                onClick={prevSpeech}
                disabled={currentSpeechIndex === 0}
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-full hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
              >
                <ChevronLeft size={16} />
                <span className="font-medium">Prev</span>
              </button>
              
              <div className="text-center px-8">
                <h2 className={`text-2xl font-bold ${
                  currentSpeech.team === 'proposition' ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {currentSpeech.name}
                </h2>
              </div>
              
              <button
                onClick={nextSpeech}
                disabled={currentSpeechIndex === DEBATE_SPEECHES.length - 1}
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-full hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
              >
                <span className="font-medium">Next</span>
                <ChevronRight size={16} />
              </button>
            </div>

            <TimerDisplay 
              recordingDuration={recordingDuration}
              isRecording={isRecording}
              maxDuration={currentSpeech.duration}
            />

            <RecordButton
              isRecording={isRecording}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
            />
          </div>

          <div className="mt-8">
            <div className="grid grid-cols-4 gap-4">
              {DEBATE_SPEECHES.map((speech, index) => {
                const recordings = speechRecordings[index];

                return (
                  <RecordingCard
                    key={index}
                    speech={speech}
                    index={index}
                    recordings={recordings}
                    currentPlayingSpeech={currentPlayingSpeech}
                    isPlaying={isPlaying}
                    isCurrentSpeech={index === currentSpeechIndex}
                    onPlayPause={handlePlayPause}
                    onDownload={downloadAudio}
                    onClick={goToSpeech}
                  />
                );
              })}
            </div>
          </div>

          {/* Match Name Input */}
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-lg border border-gray-300 shadow-md">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                試合ID:
              </label>
              <input
                type="text"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                className="w-64 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="例: 2025-01-17-session_143052"
              />
            </div>
          </div>

          {/* JSON Upload Section */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">反論グラフの読み込み</h3>
                <p className="text-sm text-gray-600">JSONファイルをアップロードして反論構造を表示します</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload size={16} />
                <span>JSONファイルをアップロード</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {graphData && (
              <div className="mt-2 text-sm text-green-700">
                ✓ JSONファイルを読み込みました
              </div>
            )}
          </div>

          {/* Rebuttal Graph Section */}
          {graphData && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">反論構造の可視化</h2>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <RebuttalGraph data={graphData} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}