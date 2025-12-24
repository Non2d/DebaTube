"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Upload, Zap, List, Hash, Check, Tags, Eye, Search } from 'lucide-react';
import RecordButton from './components/RecordButton';
import TimerDisplay from './components/TimerDisplay';
import RecordingCard from './components/RecordingCard';
import RebuttalGraph from './components/RebuttalGraph';
import UnifiedAudioPlayer from './components/UnifiedAudioPlayer';
import Header from '../../components/shared/Header';
import SearchableSelect from './components/SearchableSelect';
import { DEBATE_FORMATS, DebateFormatType, SpeechFormat } from '../../constants/constants';
import { logTabSwitch, logPlaybackEvent, logGraphNodeClick } from '../../utils/userLogger';
import { localToGlobalTime, buildSpeechSegments } from './utils/speechTimeline';
import { useTranslation } from '../../context/LanguageContext';

interface GraphData {
  speeches: { [key: string]: any[] };
  rebuttals: [number, number][];
}


type TabType = 'audio' | 'visualization';

export default function RecordPage() {
  const [activeTab, setActiveTab] = useState<TabType>('audio');
  const [roundName, setRoundName] = useState('');
  const [debateFormat, setDebateFormat] = useState<DebateFormatType>('BP'); // Default format
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [speechRecordings, setSpeechRecordings] = useState<{ [key: number]: { blob: Blob, duration: number, timestamp: string }[] }>({});
  const [currentPlayingSpeech, setCurrentPlayingSpeech] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);
  const [generationElapsedTime, setGenerationElapsedTime] = useState<number>(0);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [autoLoadedGraphData, setAutoLoadedGraphData] = useState<GraphData | null>(null);
  const [seekTargetTime, setSeekTargetTime] = useState<number | null>(null);
  const [unifiedSeekTime, setUnifiedSeekTime] = useState<number | undefined>(undefined);

  const [isUnifiedPlaying, setIsUnifiedPlaying] = useState(false);
  const [tryCount, setTryCount] = useState<number | null>(null);
  const [roundCandidates, setRoundCandidates] = useState<string[]>([]);
  const [showNodeIds, setShowNodeIds] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('graph_show_node_ids');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [showPoiColors, setShowPoiColors] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('graph_show_poi_colors');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const { t } = useTranslation();

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

    // Fetch round candidates
    fetch('http://localhost:8080/rounds')
      .then(res => res.json())
      .then(data => {
        // Unique names
        const names = Array.from(new Set(data.map((r: any) => r.name))).sort() as string[];
        setRoundCandidates(names);
      })
      .catch(err => console.error('Failed to fetch rounds:', err));
  }, []);

  // Load round name from LocalStorage or set default on mount
  useEffect(() => {
    const savedRoundName = localStorage.getItem('debate_round_name');
    if (savedRoundName) {
      setRoundName(savedRoundName);
    } else {
      // Set default round name: YYYY-MM-DD-session_HHmmss
      const now = new Date();
      const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const time = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHmmss
      const defaultName = `${date}-session_${time}`;
      setRoundName(defaultName);
      localStorage.setItem('debate_round_name', defaultName);
    }
  }, []);

  // Save round name to LocalStorage when it changes
  useEffect(() => {
    if (roundName) {
      localStorage.setItem('debate_round_name', roundName);
    }
  }, [roundName]);


  // Save debate format to LocalStorage when it changes (skip on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem('debate_format', debateFormat);
  }, [debateFormat]);

  // Save graph display options to LocalStorage when they change
  useEffect(() => {
    localStorage.setItem('graph_show_node_ids', showNodeIds.toString());
  }, [showNodeIds]);

  useEffect(() => {
    localStorage.setItem('graph_show_poi_colors', showPoiColors.toString());
  }, [showPoiColors]);

  // Reset seekTargetTime after use
  useEffect(() => {
    if (seekTargetTime !== null) {
      const timer = setTimeout(() => {
        setSeekTargetTime(null);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [seekTargetTime]);

  // Track elapsed time during graph generation
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isGeneratingGraph && generationStartTime !== null) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - generationStartTime) / 1000);
        setGenerationElapsedTime(elapsed);
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGeneratingGraph, generationStartTime]);

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

  // Load existing audio files from server when round name changes
  useEffect(() => {
    const loadExistingRecordings = async () => {
      if (!roundName) return;

      try {
        const response = await fetch(`http://localhost:8080/audio/match/${roundName}`);

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
        const recordingsByIndex: { [key: number]: { blob: Blob, duration: number, timestamp: string }[] } = {};

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
          const audioResponse = await fetch(`http://localhost:8080/audio/file/${roundName}/${fileInfo.filename}`);
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

        // Save to API
        try {
          const formData = new FormData();
          formData.append('round_name', roundName);
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
    if (!roundName) {
      setGenerationError(t('recordPage.messages.enterRoundId'));
      return;
    }

    if (!areAllAudioFilesReady()) {
      setGenerationError(t('recordPage.messages.allAudioRequired'));
      return;
    }

    // 確認ダイアログ
    const confirmed = window.confirm(
      t('recordPage.messages.confirmGenerate')
    );

    if (!confirmed) {
      return;
    }

    setIsGeneratingGraph(true);
    setGenerationError(null);
    setGenerationSuccess(null);
    setGenerationStartTime(Date.now());
    setGenerationElapsedTime(0);

    try {
      const formData = new FormData();
      formData.append('round_name', roundName);
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

      // round_name を保存（round_id は廃止）
      if (result.round_name) {
        console.log(`[generateDebateGraph] Round name: ${result.round_name}`);
      }

      // グラフデータを自動読み込み
      if (result.round_name || roundName) {
        // 新しいtry_countがあれば設定
        if (result.try_count) {
          setTryCount(result.try_count);
        }
        await autoLoadGraphData(result.round_name || roundName, result.try_count);
      }

      setGenerationSuccess(
        t('recordPage.status.success', { seconds: result.processing_time_seconds }) + '\n' +
        t('recordPage.status.transcribed', { files: result.summary.files_transcribed }) + '\n' +
        t('recordPage.status.adus', { total: result.summary.total_adus }) + '\n' +
        t('recordPage.status.rebuttalPairs', { total: result.summary.total_rebuttal_pairs }) + '\n' +
        `Round: ${result.round_name || roundName}`
      );
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
  const autoLoadGraphData = useCallback(async (roundNameToLoad: string, specificTryCount?: number) => {
    if (!roundNameToLoad) return;

    const targetTryCount = specificTryCount !== undefined ? specificTryCount : tryCount;

    try {
      console.log(`[autoLoadGraphData] Loading graph for round: ${roundNameToLoad} (try: ${targetTryCount})`);
      let url = `http://localhost:8080/rebuttal-graph/${roundNameToLoad}`;
      if (targetTryCount !== null && targetTryCount !== undefined) {
        url += `?try_count=${targetTryCount}`;
      }
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`[autoLoadGraphData] Graph not found for round: ${roundNameToLoad}`);
        setAutoLoadedGraphData(null);
        return;
      }

      const result = await response.json();
      if (result.status === 'success' && result.data) {
        setAutoLoadedGraphData(result.data);
        console.log(`[autoLoadGraphData] Graph loaded successfully for round: ${roundNameToLoad}`);
      }
    } catch (error) {
      console.error('[autoLoadGraphData] Error:', error);
      setAutoLoadedGraphData(null);
    }
  }, [tryCount]);

  // Load graph data when roundName changes or on mount
  useEffect(() => {
    if (roundName) {
      autoLoadGraphData(roundName);
    }
  }, [roundName, autoLoadGraphData]);

  // ノードクリック時のハンドラー - グローバルIDとstart_timeからスピーチを特定し、seekbarをジャンプ
  const handleGraphNodeClick = (nodeId: number) => {
    if (!autoLoadedGraphData) return;

    // ログを記録
    logGraphNodeClick(nodeId);

    try {
      // グローバルID(DB ID)をローカルIDとスピーチキーに逆引き
      let speechKey: string | null = null;
      let foundStartTime: number | null = null;

      // Search for the node with this ID in the graph data
      for (const key of Object.keys(autoLoadedGraphData.speeches)) {
        const segments = autoLoadedGraphData.speeches[key] || [];
        const foundSegment = segments.find((segment: any) => segment.id === nodeId);

        if (foundSegment) {
          speechKey = key;
          foundStartTime = foundSegment.start || 0;
          break;
        }
      }

      if (!speechKey || foundStartTime === null) {
        console.warn(`[handleGraphNodeClick] Node ID not found in graph data: ${nodeId}`);
        return;
      }

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

  const handleGraphNodeClickCtrl2 = (nodeId: number) => {
    if (!autoLoadedGraphData) return;

    // ログを記録
    logGraphNodeClick(nodeId);

    try {
      // Find segment with this ID
      let speechKey: string | null = null;
      let foundStartTime: number | null = null;

      for (const key of Object.keys(autoLoadedGraphData.speeches)) {
        const segments = autoLoadedGraphData.speeches[key] || [];
        const foundSegment = segments.find((segment: any) => segment.id === nodeId);

        if (foundSegment) {
          speechKey = key;
          foundStartTime = foundSegment.start || 0;
          break;
        }
      }

      if (!speechKey || foundStartTime === null) {
        console.warn(`[handleGraphNodeClickCtrl2] Node ID not found: ${nodeId}`);
        return;
      }

      // スピーチキーからspeech_indexを抽出
      let speechIndex = DEBATE_SPEECHES.findIndex(
        (speech: SpeechFormat) => speech.name.toLowerCase().replace(/ /g, '_') === speechKey!.toLowerCase()
      );

      if (speechIndex === -1) {
        console.warn(`[handleGraphNodeClickCtrl2] Speech index not found for: ${speechKey}`);
        return;
      }

      // 累積時間を計算: 該当スピーチより前のすべてのスピーチのdurationを合計
      const segments = buildSpeechSegments(speechRecordings, DEBATE_SPEECHES.length);
      const globalTime = localToGlobalTime(speechIndex, foundStartTime, segments);

      // Unified Audio Playerにシーク
      setUnifiedSeekTime(globalTime);

      console.log(`[handleGraphNodeClickCtrl2] Speech ${speechIndex} at local ${foundStartTime}s -> global ${globalTime}s`);
    } catch (error) {
      console.error('[handleGraphNodeClickCtrl2] Error:', error);
    }
  };

  // Memoized handler for UnifiedAudioPlayer play/pause
  const handleUnifiedPlayPause = () => {
    setIsUnifiedPlaying(prev => !prev);
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
          alert(t('recordPage.messages.invalidJson'));
        }
      } catch (error) {
        alert(t('recordPage.messages.failedJson', { error: error instanceof Error ? error.message : String(error) }));
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
          {/* Top Navigation */}
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100 p-1 rounded-lg inline-flex shadow-inner">
              <button
                onClick={() => {
                  setActiveTab('audio');
                  logTabSwitch('audio', roundName);
                }}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'audio'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                {t('recordPage.tabs.audio')}
              </button>
              <button
                onClick={() => {
                  setActiveTab('visualization');
                  logTabSwitch('visualization', roundName);
                }}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'visualization'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                {t('recordPage.tabs.visualization')}
              </button>
            </div>
          </div>

          {/* Tab content */}

          {/* Audio Tab */}
          {activeTab === 'audio' && (
            <div>
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-8 mb-6">
                  <div className="text-center px-8">
                    <h2 className={`text-2xl font-bold ${currentSpeech.team === 'proposition' ? 'text-red-600' : 'text-blue-600'
                      }`}>
                      {currentSpeech.name}
                    </h2>
                  </div>
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
              {/* Settings & Actions Area */}
              {/* Modern Control Bar */}


              <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm ring-1 ring-slate-900/5 mt-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                  {/* Format Input Group */}
                  <div className="lg:col-span-3">
                    <div className="relative group h-full">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <List size={18} strokeWidth={2} />
                      </div>
                      <select
                        value={debateFormat}
                        onChange={(e) => setDebateFormat(e.target.value as DebateFormatType)}
                        className="h-12 w-full pl-10 pr-10 bg-white border-0 ring-1 ring-slate-200/80 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer hover:bg-slate-50/50"
                      >
                        <option value="NA">{t('recordPage.formatOptions.na')}</option>
                        <option value="ASIAN">{t('recordPage.formatOptions.asian')}</option>
                        <option value="BP">{t('recordPage.formatOptions.bp')}</option>
                        <option value="OPENING_HALF_BP_ORDER">{t('recordPage.formatOptions.openingHalfBp')}</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="transition-transform group-focus-within:rotate-180">
                          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <label className="absolute -top-2 left-3 px-1 bg-white text-[10px] uppercase tracking-wider font-bold text-slate-400 pointer-events-none">{t('recordPage.controls.format')}</label>
                    </div>
                  </div>

                  {/* Round ID Input Group (Combined) */}
                  <div className="lg:col-span-6 flex gap-2">
                    <div className="relative group h-full flex-1">
                      <SearchableSelect
                        options={roundCandidates}
                        value={roundName}
                        onChange={setRoundName}
                        placeholder={t('recordPage.controls.enterRoundId')}
                        label={t('recordPage.controls.roundId')}
                      />
                    </div>


                  </div>

                  {/* Primary Action Button */}
                  <div className="lg:col-span-3">
                    <button
                      onClick={generateDebateGraph}
                      disabled={!areAllAudioFilesReady() || isGeneratingGraph || !roundName}
                      className={`h-12 w-full flex items-center justify-center gap-2.5 rounded-xl text-sm font-bold tracking-wide transition-all shadow-md active:scale-[0.98] ${isGeneratingGraph
                        ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200 cursor-wait'
                        : !roundName
                          ? 'bg-slate-100 text-slate-400 ring-1 ring-slate-200 cursor-not-allowed'
                          : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg focus:ring-4 focus:ring-indigo-500/20'
                        }`}
                    >
                      <Zap size={18} className={isGeneratingGraph ? "animate-pulse" : "fill-current"} />
                      <span>{isGeneratingGraph ? t('recordPage.controls.processing') : t('recordPage.controls.generateGraph')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Messages Area */}
              {(isGeneratingGraph || generationError || generationSuccess) && (
                <div className="mt-4 pt-4 border-t border-slate-200/60 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-center">
                    {isGeneratingGraph && (
                      <div className="flex items-center gap-2 text-xs font-mono text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        {t('recordPage.status.processing', { seconds: generationElapsedTime })}
                      </div>
                    )}
                    {generationError && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
                        <span className="font-bold">Error:</span> {generationError}
                      </div>
                    )}
                    {generationSuccess && (
                      <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 shadow-sm">
                        <Check size={16} className="text-emerald-500" />
                        <span className="whitespace-pre-line font-medium">{generationSuccess}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Feedback Tab */}
          {activeTab === 'visualization' && (
            <div>
              {autoLoadedGraphData && (
                <div className="mb-6">
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                    <RebuttalGraph data={autoLoadedGraphData} onNodeClick={handleGraphNodeClickCtrl2} debateFormat={debateFormat} showNodeIds={showNodeIds} showPoiColors={showPoiColors} />
                  </div>
                </div>
              )}
              {!autoLoadedGraphData && (
                <div className="mb-6 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg" style={{ height: '600px' }}>
                  <p className="text-gray-600 font-medium">{t('recordPage.messages.noGraphData')}</p>
                </div>
              )}

              {/* Unified Audio Player - Middle */}
              <div className="mt-4 mb-6">
                <UnifiedAudioPlayer
                  speechRecordings={speechRecordings}
                  speechCount={DEBATE_SPEECHES.length}
                  isPlaying={isUnifiedPlaying}
                  onPlayPause={handleUnifiedPlayPause}
                  seekToGlobalTime={unifiedSeekTime}
                />
              </div>

              {/* Modern Action Footer */}
              <div className="mt-4">
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm ring-1 ring-slate-900/5">
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-6">

                    {/* Round ID Badge (Editable) */}
                    <div className="w-full lg:w-auto flex gap-2">
                      <div className="relative group h-full flex-1 lg:w-80">
                        <SearchableSelect
                          options={roundCandidates}
                          value={roundName}
                          onChange={setRoundName}
                          placeholder={t('recordPage.controls.searchRoundId')}
                          label={t('recordPage.controls.roundId')}
                        />
                      </div>
                      <div className="w-24 relative group h-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                          <Hash size={18} strokeWidth={2} />
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={tryCount || ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : null;
                            setTryCount(val);
                          }}
                          className="h-12 w-full pl-9 pr-3 bg-white border-0 ring-1 ring-slate-200/80 rounded-xl text-sm font-semibold text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono hover:bg-slate-50/50"
                          placeholder="1"
                        />
                        <label className="absolute -top-2 left-1 px-1 bg-white text-[10px] uppercase tracking-wider font-bold text-slate-400 pointer-events-none">Try</label>
                      </div>
                    </div>

                    {/* Display Options Toggles */}
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 bg-slate-50 px-6 py-3 rounded-xl ring-1 ring-slate-200/80">
                      {/* POI Toggle */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-600">{t('recordPage.toggles.poiColor')}</span>
                        <button
                          onClick={() => setShowPoiColors(!showPoiColors)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showPoiColors ? 'bg-indigo-600' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm ${showPoiColors ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>

                      <div className="w-px h-6 bg-slate-300 mx-2"></div>

                      {/* Node ID Toggle */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-600">{t('recordPage.toggles.nodeId')}</span>
                        <button
                          onClick={() => setShowNodeIds(!showNodeIds)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showNodeIds ? 'bg-indigo-600' : 'bg-slate-300'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm ${showNodeIds ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>


      </div >
    </>
  );
}