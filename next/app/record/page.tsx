"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Upload, Zap } from 'lucide-react';
import RecordButton from './components/RecordButton';
import TimerDisplay from './components/TimerDisplay';
import RecordingCard from './components/RecordingCard';
import RebuttalGraph from './components/RebuttalGraph';
import UnifiedAudioPlayer from './components/UnifiedAudioPlayer';
import Header from '../../components/shared/Header';
import { DEBATE_FORMATS, DebateFormatType, SpeechFormat } from '../../constants/constants';
import { logTabSwitch, logPlaybackEvent, logGraphNodeClick } from '../../utils/userLogger';
import { localToGlobalTime, buildSpeechSegments } from './utils/speechTimeline';

interface GraphData {
  speeches: { [key: string]: any[] };
  rebuttals: [number, number][];
}

type TabType = 'home' | 'baseline' | 'ctrl' | 'ctrl2';

export default function RecordPage() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [matchName, setMatchName] = useState('');
  const [debateFormat, setDebateFormat] = useState<DebateFormatType>('BP'); // Default format
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [speechRecordings, setSpeechRecordings] = useState<{[key: number]: {blob: Blob, duration: number, timestamp: string}[]}>({});
  const [currentPlayingSpeech, setCurrentPlayingSpeech] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);
  const [autoLoadedGraphData, setAutoLoadedGraphData] = useState<GraphData | null>(null);
  const [seekTargetTime, setSeekTargetTime] = useState<number | null>(null);
  const [unifiedSeekTime, setUnifiedSeekTime] = useState<number | undefined>(undefined);
  const [isUnifiedPlaying, setIsUnifiedPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isInitialMount = useRef<boolean>(true);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Get current debate speeches based on selected format
  const DEBATE_SPEECHES = DEBATE_FORMATS[debateFormat];

  // Load debate format from LocalStorage after mount to avoid hydration errors
  useEffect(() => {
    const savedFormat = localStorage.getItem('debate_format');
    if (savedFormat && (savedFormat === 'NA' || savedFormat === 'ASIAN' || savedFormat === 'BP' || savedFormat === 'OPENING_HALF_BP_ORDER')) {
      setDebateFormat(savedFormat as DebateFormatType);
    }
  }, []);

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

  // Save debate format to LocalStorage when it changes (skip on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem('debate_format', debateFormat);
  }, [debateFormat]);

  // Reset seekTargetTime after use
  useEffect(() => {
    if (seekTargetTime !== null) {
      const timer = setTimeout(() => {
        setSeekTargetTime(null);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [seekTargetTime]);

  // Reset unifiedSeekTime after use
  useEffect(() => {
    if (unifiedSeekTime !== undefined) {
      const timer = setTimeout(() => {
        setUnifiedSeekTime(undefined);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [unifiedSeekTime]);

  // Helper function to get duration from audio blob
  const getAudioDuration = async (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();

      const handleLoadedMetadata = () => {
        const duration = audio.duration;
        URL.revokeObjectURL(url);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleError);
        resolve(duration || 0);
      };

      const handleError = () => {
        URL.revokeObjectURL(url);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleError);
        resolve(0);
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('error', handleError);
      audio.src = url;
    });
  };

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
          // Parse filename: {speech_index}_{speech_name}_{sequence}.{ext}
          // Support multiple filename formats
          const parts = fileInfo.filename.split('_');
          let speechIndex: number | null = null;

          // Try to parse speech_index from first part
          if (parts.length >= 1) {
            const firstPart = parseInt(parts[0]);
            if (!isNaN(firstPart)) {
              speechIndex = firstPart;
            } else {
              // If first part is not a number, try to extract from speech name
              // e.g., "Opposition_1st-2025-11-16.mp3" -> extract index from context
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

          // Fetch the audio file as blob
          const audioResponse = await fetch(`http://localhost:8080/audio/file/${matchName}/${fileInfo.filename}`);
          if (!audioResponse.ok) {
            console.error(`Failed to fetch audio file: ${fileInfo.filename}`);
            continue;
          }

          const blob = await audioResponse.blob();

          // Use duration from server metadata if available, otherwise auto-detect from MP3
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
          alert('Failed to save recording. Please try again.');
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
      alert('Microphone access denied. Please check your browser settings.');
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

  // 全ての音声ファイルが揃っているかをチェック
  const areAllAudioFilesReady = () => {
    const recordedSpeechIndices = Object.keys(speechRecordings)
      .filter(key => speechRecordings[parseInt(key)] && speechRecordings[parseInt(key)].length > 0)
      .map(key => parseInt(key));
    return recordedSpeechIndices.length > 0; // 少なくとも1つの音声があればOK
  };

  // 音声からディベートグラフを生成
  const generateDebateGraph = async () => {
    if (!matchName) {
      setGenerationError('Please enter Match ID');
      return;
    }

    if (!areAllAudioFilesReady()) {
      setGenerationError('All audio files required');
      return;
    }

    // 確認ダイアログ
    const confirmed = window.confirm(
      'Generate graph?\n\n' +
      'This may take several minutes to complete.'
    );

    if (!confirmed) {
      return;
    }

    setIsGeneratingGraph(true);
    setGenerationError(null);
    setGenerationSuccess(null);

    try {
      const formData = new FormData();
      formData.append('match_name', matchName);
      formData.append('debate_format', debateFormat);

      // 全ての音声ファイルを FormData に追加
      let totalFiles = 0;
      for (let i = 0; i < DEBATE_SPEECHES.length; i++) {
        const recordings = speechRecordings[i];
        if (recordings && recordings.length > 0) {
          for (let j = 0; j < recordings.length; j++) {
            const blob = recordings[j].blob;
            const date = new Date(recordings[j].timestamp);
            const dateStr = date.toISOString().split('T')[0];
            const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
            const timestamp = `${dateStr}_${timeStr}`;
            const suffix = recordings.length > 1 ? `_${j}` : '';
            const filename = `${DEBATE_SPEECHES[i].name.replace(/ /g, '_')}-${timestamp}${suffix}.webm`;
            formData.append('files', blob, filename);
            totalFiles++;
          }
        }
      }

      console.log(`[generateDebateGraph] Uploading ${totalFiles} audio files...`);

      const response = await fetch('http://localhost:8080/audio-to-debate-graph-batch', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to generate debate graph: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[generateDebateGraph] Success:', result);

      // 反論グラフの JSON を自動読み込み
      if (result.rebuttal_graph_file) {
        try {
          // ファイルパスから JSON ファイルを読み込む
          // Note: ファイルシステムへの直接アクセスはできないため、サーバーから返されたデータを使用
          setGraphData({
            speeches: result.summary,
            rebuttals: []
          });

          setGenerationSuccess(
            `Graph generated successfully!\n` +
            `- Transcribed: ${result.summary.files_transcribed} files\n` +
            `- ADUs: ${result.summary.total_adus}\n` +
            `- Rebuttal pairs: ${result.summary.total_rebuttal_pairs}\n` +
            `Results saved to: ${result.results_directory}`
          );
        } catch (error) {
          console.error('Failed to load graph data:', error);
          setGenerationSuccess(
            `Graph generated successfully!\n` +
            `Results saved to: ${result.results_directory}`
          );
        }
      }
    } catch (error) {
      console.error('[generateDebateGraph] Error:', error);
      setGenerationError(
        error instanceof Error ? error.message : 'Failed to generate graph'
      );
    } finally {
      setIsGeneratingGraph(false);
    }
  };

  // グラフデータを自動読み込み（サーバーから）
  const autoLoadGraphData = async (matchId: string) => {
    if (!matchId) return;

    try {
      console.log(`[autoLoadGraphData] Loading graph for match: ${matchId}`);
      const response = await fetch(`http://localhost:8080/rebuttal-graph/${matchId}`);

      if (!response.ok) {
        console.warn(`[autoLoadGraphData] Graph not found for match: ${matchId}`);
        setAutoLoadedGraphData(null);
        return;
      }

      const result = await response.json();
      if (result.status === 'success' && result.data) {
        setAutoLoadedGraphData(result.data);
        console.log(`[autoLoadGraphData] Graph loaded successfully for match: ${matchId}`);
      }
    } catch (error) {
      console.error('[autoLoadGraphData] Error:', error);
      setAutoLoadedGraphData(null);
    }
  };

  // ノードクリック時のハンドラー - グローバルIDとstart_timeからスピーチを特定し、seekbarをジャンプ
  const handleGraphNodeClick = (globalNodeId: number) => {
    if (!autoLoadedGraphData) return;

    // ログを記録
    logGraphNodeClick(globalNodeId);

    try {
      // グローバルIDをローカルIDとスピーチキーに逆引き
      // ローカルIDは各スピーチで1から始まるので、グローバルIDを割り当てた順序で逆引き

      let speechKey: string | null = null;

      // グローバルIDマッピングを再構築（グラフデータの順序をそのまま使用）
      let globalIdCounter = 1;
      const globalIdToInfo: { [globalId: number]: { speechKey: string, localId: number, startTime: number } } = {};

      Object.keys(autoLoadedGraphData.speeches).forEach((key) => {
        (autoLoadedGraphData.speeches[key] || []).forEach((segment: any) => {
          const localSegmentId = segment.id !== undefined ? segment.id : 1;
          globalIdToInfo[globalIdCounter] = {
            speechKey: key,
            localId: localSegmentId,
            startTime: segment.start || 0
          };
          globalIdCounter++;
        });
      });

      if (!globalIdToInfo[globalNodeId]) {
        console.warn(`[handleGraphNodeClick] Global ID not found: ${globalNodeId}`);
        console.warn(`[handleGraphNodeClick] Available global IDs:`, Object.keys(globalIdToInfo));
        return;
      }

      const { speechKey: foundSpeechKey, startTime: foundStartTime } = globalIdToInfo[globalNodeId];
      speechKey = foundSpeechKey;

      // スピーチキーからspeech_indexを抽出
      let speechIndex = DEBATE_SPEECHES.findIndex(
        (speech: SpeechFormat) => speech.name.toLowerCase().replace(/ /g, '_') === speechKey.toLowerCase()
      );

      if (speechIndex === -1) {
        console.warn(`[handleGraphNodeClick] Speech index not found for: ${speechKey}`);
        return;
      }

      // 実際の開始時刻を使用
      handleGraphNodeTimeJump(speechIndex, foundStartTime);

      console.log(`[handleGraphNodeClick] Triggering time jump for ${speechKey} (index: ${speechIndex}) at ${foundStartTime}s`);
    } catch (error) {
      console.error('[handleGraphNodeClick] Error:', error);
    }
  };

  // ハンドラー: グラフノードクリックでシークバーをジャンプ
  const handleGraphNodeTimeJump = (speechIndex: number, time: number) => {
    // 対応するスピーチを再生状態にする
    setCurrentPlayingSpeech(speechIndex);
    setIsPlaying(true);

    // シークバーがこの時間にジャンプするようにする
    setSeekTargetTime(time);

    console.log(`[handleGraphNodeTimeJump] Speech ${speechIndex} jump to ${time}s`);
  };

  // ハンドラー: Ctrl-2タブでのグラフノードクリック（累積時間計算）
  const handleGraphNodeClickCtrl2 = (globalNodeId: number) => {
    if (!autoLoadedGraphData) return;

    // ログを記録
    logGraphNodeClick(globalNodeId);

    try {
      // グローバルIDをローカルIDとスピーチキーに逆引き
      let globalIdCounter = 1;
      const globalIdToInfo: { [globalId: number]: { speechKey: string, localId: number, startTime: number } } = {};

      Object.keys(autoLoadedGraphData.speeches).forEach((key) => {
        (autoLoadedGraphData.speeches[key] || []).forEach((segment: any) => {
          const localSegmentId = segment.id !== undefined ? segment.id : 1;
          globalIdToInfo[globalIdCounter] = {
            speechKey: key,
            localId: localSegmentId,
            startTime: segment.start || 0
          };
          globalIdCounter++;
        });
      });

      if (!globalIdToInfo[globalNodeId]) {
        console.warn(`[handleGraphNodeClickCtrl2] Global ID not found: ${globalNodeId}`);
        return;
      }

      const { speechKey: foundSpeechKey, startTime: foundStartTime } = globalIdToInfo[globalNodeId];

      // スピーチキーからspeech_indexを抽出
      let speechIndex = DEBATE_SPEECHES.findIndex(
        (speech: SpeechFormat) => speech.name.toLowerCase().replace(/ /g, '_') === foundSpeechKey.toLowerCase()
      );

      if (speechIndex === -1) {
        console.warn(`[handleGraphNodeClickCtrl2] Speech index not found for: ${foundSpeechKey}`);
        return;
      }

      // 累積時間を計算: 該当スピーチより前のすべてのスピーチのdurationを合計
      const segments = buildSpeechSegments(speechRecordings, DEBATE_SPEECHES.length);
      const globalTime = localToGlobalTime(speechIndex, foundStartTime, segments);

      // Unified Audio Playerにシーク
      setUnifiedSeekTime(globalTime);
      setIsUnifiedPlaying(true);

      console.log(`[handleGraphNodeClickCtrl2] Speech ${speechIndex} at local ${foundStartTime}s -> global ${globalTime}s`);
    } catch (error) {
      console.error('[handleGraphNodeClickCtrl2] Error:', error);
    }
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
          // Feedback (Ctrl) でも表示されるように
          setAutoLoadedGraphData(json);
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
      <Header title="DebaTube Live" />
      <div className="min-h-screen bg-white flex flex-col pt-16">
        <div className="flex-1 max-w-4xl mx-auto px-4 py-4 w-full">
          {/* Tab content */}

          {/* Home Tab */}
          {activeTab === 'home' && (
          <div>
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
              {DEBATE_SPEECHES.map((speech: SpeechFormat, index: number) => {
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

          {/* Match Name and Format Selection */}
          <div className="mt-8 flex justify-center gap-4">
            {/* Debate Format Selection */}
            <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-lg border border-gray-300 shadow-md">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Format:
              </label>
              <select
                value={debateFormat}
                onChange={(e) => setDebateFormat(e.target.value as DebateFormatType)}
                className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="NA">NA (6 speeches)</option>
                <option value="ASIAN">ASIAN (8 speeches)</option>
                <option value="BP">BP (8 speeches)</option>
                <option value="OPENING_HALF_BP_ORDER">Opening Half BP (4 speeches)</option>
              </select>
            </div>

            {/* Match Name Input */}
            <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-lg border border-gray-300 shadow-md">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Match ID:
              </label>
              <input
                type="text"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                className="w-64 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="e.g., 2025-01-17-session_143052"
              />
            </div>
          </div>

          {/* Generate Graph and JSON Upload Section */}
          <div className="mt-8 space-y-4">
            {/* Generate Debate Graph */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Generate Debate Graph from Audio</h3>
                  <p className="text-sm text-gray-600">At least one audio file required to generate</p>
                </div>
                <button
                  onClick={generateDebateGraph}
                  disabled={!areAllAudioFilesReady() || isGeneratingGraph || !matchName}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    !areAllAudioFilesReady() || !matchName
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : isGeneratingGraph
                      ? 'bg-amber-500 text-white cursor-wait'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  <Zap size={16} />
                  <span>{isGeneratingGraph ? 'Generating...' : 'Generate Graph'}</span>
                </button>
              </div>
              {generationError && (
                <div className="mt-2 text-sm text-red-700 bg-red-100 p-2 rounded">
                  ✗ {generationError}
                </div>
              )}
              {generationSuccess && (
                <div className="mt-2 text-sm text-green-700 bg-green-100 p-2 rounded whitespace-pre-line">
                  ✓ {generationSuccess}
                </div>
              )}
            </div>

            {/* JSON Upload Section */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Load Rebuttal Graph</h3>
                  <p className="text-sm text-gray-600">Upload JSON file to display rebuttal structure</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Upload size={16} />
                  <span>Upload JSON File</span>
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
                  ✓ JSON file loaded successfully
                </div>
              )}
            </div>
          </div>

          {/* Rebuttal Graph Section */}
          {graphData && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Rebuttal Structure Visualization</h2>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <RebuttalGraph data={graphData} debateFormat={debateFormat} />
              </div>
            </div>
          )}
          </div>
          )}

          {/* Baseline Tab */}
          {activeTab === 'baseline' && (
          <div>
            {/* Recording Cards */}
            <div className="mb-12">
              <div className="grid grid-cols-4 gap-4">
                {DEBATE_SPEECHES.map((speech: SpeechFormat, index: number) => {
                  const recordings = speechRecordings[index];

                  return (
                    <RecordingCard
                      key={index}
                      speech={speech}
                      index={index}
                      recordings={recordings}
                      currentPlayingSpeech={currentPlayingSpeech}
                      isPlaying={isPlaying}
                      isCurrentSpeech={false}
                      onPlayPause={handlePlayPause}
                      onDownload={downloadAudio}
                      onClick={() => {}}
                      hideDownload={true}
                    />
                  );
                })}
              </div>
            </div>

            {/* Match Name - Bottom */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">
                ID: <span className="font-semibold">{matchName}</span>
              </p>
            </div>
          </div>
          )}

          {/* Ctrl Tab */}
          {activeTab === 'ctrl' && (
          <div>
            {/* Rebuttal Graph Section for Ctrl - Top */}
            {autoLoadedGraphData && (
              <div className="mb-12">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                  <RebuttalGraph data={autoLoadedGraphData} onNodeClick={handleGraphNodeClick} debateFormat={debateFormat} />
                </div>
              </div>
            )}
            {!autoLoadedGraphData && (
              <div className="mb-12 p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <p className="text-gray-600">Graph data not available. Please generate graph in Home tab.</p>
              </div>
            )}

            {/* Recording Cards - Middle */}
            <div className="mt-8 mb-12">
              <div className="grid grid-cols-4 gap-4">
                {DEBATE_SPEECHES.map((speech: SpeechFormat, index: number) => {
                  const recordings = speechRecordings[index];
                  const shouldSeek = currentPlayingSpeech === index && seekTargetTime !== null;

                  return (
                    <RecordingCard
                      key={index}
                      speech={speech}
                      index={index}
                      recordings={recordings}
                      currentPlayingSpeech={currentPlayingSpeech}
                      isPlaying={isPlaying}
                      isCurrentSpeech={false}
                      onPlayPause={handlePlayPause}
                      onDownload={downloadAudio}
                      onClick={() => {}}
                      hideDownload={true}
                      seekTime={shouldSeek ? seekTargetTime : undefined}
                      onTimeJump={(time: number) => handleGraphNodeTimeJump(index, time)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Match Name - Bottom */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">
                ID: <span className="font-semibold">{matchName}</span>
              </p>
            </div>
          </div>
          )}

          {/* Ctrl-2 Tab */}
          {activeTab === 'ctrl2' && (
          <div>
            {/* Rebuttal Graph Section for Ctrl-2 - Top */}
            {autoLoadedGraphData && (
              <div className="mb-12">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                  <RebuttalGraph data={autoLoadedGraphData} onNodeClick={handleGraphNodeClickCtrl2} debateFormat={debateFormat} />
                </div>
              </div>
            )}
            {!autoLoadedGraphData && (
              <div className="mb-12 p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <p className="text-gray-600">Graph data not available. Please generate graph in Home tab.</p>
              </div>
            )}

            {/* Unified Audio Player - Middle */}
            <div className="mt-8 mb-12">
              <UnifiedAudioPlayer
                speechRecordings={speechRecordings}
                speechCount={DEBATE_SPEECHES.length}
                isPlaying={isUnifiedPlaying}
                onPlayPause={() => setIsUnifiedPlaying(!isUnifiedPlaying)}
                seekToGlobalTime={unifiedSeekTime}
              />
            </div>

            {/* Match Name - Bottom */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">
                ID: <span className="font-semibold">{matchName}</span>
              </p>
            </div>
          </div>
          )}
        </div>

        {/* Tab Navigation - Bottom */}
        <div className="border-t border-gray-200 bg-white">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setActiveTab('home');
                  logTabSwitch('home', matchName);
                }}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'home'
                    ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => {
                  setActiveTab('baseline');
                  logTabSwitch('baseline', matchName);
                  if (matchName) autoLoadGraphData(matchName);
                }}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'baseline'
                    ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Feedback (Baseline)
              </button>
              <button
                onClick={() => {
                  setActiveTab('ctrl');
                  logTabSwitch('ctrl', matchName);
                  if (matchName) autoLoadGraphData(matchName);
                }}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'ctrl'
                    ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Feedback (Ctrl)
              </button>
              <button
                onClick={() => {
                  setActiveTab('ctrl2');
                  logTabSwitch('ctrl2', matchName);
                  if (matchName) autoLoadGraphData(matchName);
                }}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'ctrl2'
                    ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Feedback (Ctrl-2)
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}