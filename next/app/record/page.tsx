"use client";

import { useState, useRef } from 'react';
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
  { name: 'Opposition Reply', duration: 4 * 60, team: 'opposition' },
  { name: 'Proposition Reply', duration: 4 * 60, team: 'proposition' }
] as const;

interface GraphData {
  speeches: { [key: string]: any[] };
  rebuttals: [number, number][];
}

export default function RecordPage() {
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [speechRecordings, setSpeechRecordings] = useState<{[key: number]: {blob: Blob, duration: number, timestamp: string} | null}>({});
  const [currentPlayingSpeech, setCurrentPlayingSpeech] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setSpeechRecordings(prev => ({
          ...prev,
          [currentSpeechIndex]: {
            blob,
            duration: durationRef.current,
            timestamp: new Date().toISOString()
          }
        }));
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
    if (currentPlayingSpeech === index) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentPlayingSpeech(index);
      setIsPlaying(true);
    }
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
  };

  const downloadAudio = (speechIndex: number) => {
    const speechRecording = speechRecordings[speechIndex];
    if (speechRecording) {
      const url = URL.createObjectURL(speechRecording.blob);
      const a = document.createElement('a');
      a.href = url;
      // タイムスタンプを YYYY-MM-DD_HHmmss 形式に変換
      const date = new Date(speechRecording.timestamp);
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
      const timestamp = `${dateStr}_${timeStr}`;
      a.download = `${DEBATE_SPEECHES[speechIndex].name.replace(/ /g, '_')}-${timestamp}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
                const recording = speechRecordings[index];

                return (
                  <RecordingCard
                    key={index}
                    speech={speech}
                    index={index}
                    recording={recording}
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