"use client";

import { useState, useRef, useEffect } from 'react';
import RecordButton from './components/RecordButton';
import TimerDisplay from './components/TimerDisplay';
import RecordingCard from './components/RecordingCard';
import RebuttalGraph from './components/RebuttalGraph';
import UnifiedAudioPlayer from './components/UnifiedAudioPlayer';
import Header from '../../../components/shared/Header';
import { DEBATE_FORMATS, DebateFormatType, SpeechFormat } from '../../../constants/constants';
import { logTabSwitch } from '../../../utils/userLogger';
import { useTranslation } from '../../../context/LanguageContext';
import { useSearchParams } from 'next/navigation';

// Extracted Components
import TabNavigation, { TabType } from './components/TabNavigation';
import SpeechNavigator from './components/SpeechNavigator';
import GenerationControlBar from './components/GenerationControlBar';
import VisualizationControlBar from './components/VisualizationControlBar';
import GenerationStatus from './components/GenerationStatus';
import RecordList from './components/RecordList';

// Custom Hooks
import { useRecordings } from './hooks/useRecordings';
import { useDebateGraph } from './hooks/useDebateGraph';
import { useGraphGeneration } from './hooks/useGraphGeneration';
import { useGraphNodeNavigation } from './hooks/useGraphNodeNavigation';

export default function RecordPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [roundName, setRoundName] = useState('');
  const [motion, setMotion] = useState('');
  const [debateFormat, setDebateFormat] = useState<DebateFormatType>('BP'); // Default format
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
  const [currentPlayingSpeech, setCurrentPlayingSpeech] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUnifiedPlaying, setIsUnifiedPlaying] = useState(false);

  const [roundCandidates, setRoundCandidates] = useState<string[]>([]);
  const [showNodeIds, setShowNodeIds] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedNodeIds = localStorage.getItem('graph_show_node_ids');
      if (savedNodeIds !== null) {
        setShowNodeIds(savedNodeIds === 'true');
      } else {
        setShowNodeIds(true); // Default to true if not in localStorage
      }
    }
  }, []);
  const [callLlmAllAtOnce, setCallLlmAllAtOnce] = useState(true);
  const [useLatestTranscription, setUseLatestTranscription] = useState(true);
  const [aduModel, setAduModel] = useState("gemini-2.5-flash");
  const [rebuttalModel, setRebuttalModel] = useState("gemini-2.5-flash");
  const [transcriptionModel, setTranscriptionModel] = useState("groq-whisper-large-v3-turbo");
  const [manualMode, setManualMode] = useState(false);
  // Removed independent resumeTryCount state to synchronize with Visualization tab
  // const [resumeTryCount, setResumeTryCount] = useState<number | null>(null);
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  const isInitialMount = useRef<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Get current debate speeches based on selected format
  const DEBATE_SPEECHES = DEBATE_FORMATS[debateFormat];
  const currentSpeech = DEBATE_SPEECHES[currentSpeechIndex];

  // --- Hooks ---
  const {
    isRecording,
    recordingDuration,
    setRecordingDuration,
    speechRecordings,
    startRecording,
    stopRecording
  } = useRecordings(roundName, currentSpeechIndex, currentSpeech.name);

  const {
    autoLoadedGraphData,
    setAutoLoadedGraphData,
    tryCount,
    setTryCount,
    autoLoadGraphData,
    handleFileSelect: handleFileSelectInternal
  } = useDebateGraph(roundName);

  // Wrapper/Adapter removed: tryCount is now nullable and shared directly.

  const areAllAudioFilesReady = () => {
    const recordedSpeechIndices = Object.keys(speechRecordings)
      .filter(key => speechRecordings[parseInt(key)] && speechRecordings[parseInt(key)].length > 0)
      .map(key => parseInt(key));
    return recordedSpeechIndices.length > 0; // 少なくとも1つの音声があればOK
  };

  const {
    isGeneratingGraph,
    generationError,
    generationSuccess,
    generationElapsedTime,
    generateDebateGraph,
    manualState,
    submitManualAdu,
    submitManualRebuttal
  } = useGraphGeneration({
    roundName,
    debateFormat,
    motion,
    speechRecordings,
    debateSpeeches: DEBATE_SPEECHES,
    areAllAudioFilesReady: areAllAudioFilesReady(),
    callLlmAllAtOnce,
    useLatestTranscription,
    aduModel,
    rebuttalModel,
    transcriptionModel,
    manualMode,
    resumeTryCount: tryCount, // Synced
    setResumeTryCount: setTryCount, // Synced
    onSuccess: (result) => {
      if (result.try_count) {
        setTryCount(result.try_count);
      }
      if (result.round_name || roundName) {
        autoLoadGraphData(result.round_name || roundName, result.try_count);
      }
    }
  });

  const {
    seekTargetTime,
    unifiedSeekTime,
    handleGraphNodeClickUnified
  } = useGraphNodeNavigation({
    autoLoadedGraphData,
    debateSpeeches: DEBATE_SPEECHES,
    speechRecordings,
    setCurrentPlayingSpeech,
    setIsPlaying
  });


  // --- Effects ---

  // Load debate format from LocalStorage after mount to avoid hydration errors
  useEffect(() => {
    const savedFormat = localStorage.getItem('debate_format');
    if (savedFormat && (savedFormat === 'NA' || savedFormat === 'ASIAN' || savedFormat === 'WSDC' || savedFormat === 'HPDU' || savedFormat === 'BP' || savedFormat === 'OPENING_HALF_BP_ORDER')) {
      setDebateFormat(savedFormat as DebateFormatType);
    }

    // Fetch round candidates (type=record only)
    fetch('http://localhost:8080/rounds')
      .then(res => res.json())
      .then(data => {
        // Filter by type=record and get unique names
        const recordRounds = data.filter((r: any) => r.type === 'record');
        const names = Array.from(new Set(recordRounds.map((r: any) => r.name))).sort() as string[];
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

  // Auto-load latest version when round name changes
  useEffect(() => {
    if (roundName) {
      fetch(`http://localhost:8080/rounds/${roundName}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.try_count) {
            setTryCount(data.try_count);
          }
        })
        .catch(err => console.error('Failed to fetch latest version:', err));
    }
  }, [roundName]);

  // Restore active tab from LocalStorage
  useEffect(() => {
    const savedTab = localStorage.getItem('record_active_tab') as TabType;
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  // Handle URL parameters for navigation from Explore page
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    const urlRoundName = searchParams.get('roundName');
    const urlTryCount = searchParams.get('tryCount');

    if (tab) {
      setActiveTab(tab);
      localStorage.setItem('record_active_tab', tab);
    }

    if (urlRoundName) {
      setRoundName(urlRoundName);
      localStorage.setItem('debate_round_name', urlRoundName);
    }

    if (urlTryCount) {
      const tryCountNum = parseInt(urlTryCount);
      if (!isNaN(tryCountNum)) {
        setTryCount(tryCountNum);
      }
    }
  }, [searchParams, setTryCount]);

  useEffect(() => {
    if (roundName) {
      localStorage.setItem('debate_round_name', roundName);
    }
  }, [roundName]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem('debate_format', debateFormat);
  }, [debateFormat]);

  useEffect(() => {
    if (showNodeIds !== null) {
      localStorage.setItem('graph_show_node_ids', showNodeIds.toString());
    }
  }, [showNodeIds]);


  // --- Handlers ---

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    logTabSwitch(tab, roundName);
    localStorage.setItem('record_active_tab', tab);
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
      recordings.forEach((recording, index) => {
        const url = URL.createObjectURL(recording.blob);
        const a = document.createElement('a');
        a.href = url;
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

  const handleInternalStopRecording = () => {
    if (stopRecording()) {
      setTimeout(() => {
        if (currentSpeechIndex < DEBATE_SPEECHES.length - 1) {
          setCurrentSpeechIndex(currentSpeechIndex + 1);
          setRecordingDuration(0);
          setCurrentPlayingSpeech(null);
        }
      }, 500);
    }
  }

  const handleUnifiedPlayPause = () => {
    setIsUnifiedPlaying(prev => !prev);
  };

  return (
    <>
      <Header title="DebaTube Live" />
      <div className="min-h-screen bg-background text-foreground flex flex-col pt-16 transition-colors duration-300">
        <div className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-2 max-w-7xl flex flex-col">
          <TabNavigation activeTab={activeTab} onTabSwitch={handleTabSwitch} />

          {activeTab === 'dashboard' && (
            <div className="flex flex-col flex-1 pb-4 space-y-4">
              <RecordList onSelectRound={(round, tryNum) => {
                setRoundName(round);
                setTryCount(tryNum);
                handleTabSwitch('visualization');
                // Since setting state happens, visualization tab will pick up new roundName and tryCount via hooks/effects
                // But explicit autoload might be safer if hook deps aren't strict enough, but they seem to be.
                autoLoadGraphData(round, tryNum);
              }} />
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="flex flex-col flex-1 pb-4 space-y-4">
              <div className="text-center mb-8">
                <SpeechNavigator
                  currentSpeech={currentSpeech}
                  onPrev={prevSpeech}
                  onNext={nextSpeech}
                  canPrev={currentSpeechIndex > 0}
                  canNext={currentSpeechIndex < DEBATE_SPEECHES.length - 1}
                />

                <TimerDisplay
                  recordingDuration={recordingDuration}
                  isRecording={isRecording}
                  maxDuration={currentSpeech.duration}
                />

                <RecordButton
                  isRecording={isRecording}
                  onStartRecording={startRecording}
                  onStopRecording={handleInternalStopRecording}
                />
              </div>

              <div className="mt-2">
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

              <GenerationStatus
                isGeneratingGraph={isGeneratingGraph}
                generationError={generationError}
                generationSuccess={generationSuccess}
                generationElapsedTime={generationElapsedTime}
              />

              <GenerationControlBar
                debateFormat={debateFormat}
                setDebateFormat={setDebateFormat}
                roundName={roundName}
                setRoundName={setRoundName}
                motion={motion}
                setMotion={setMotion}
                roundCandidates={roundCandidates}
                generateDebateGraph={generateDebateGraph}
                isGeneratingGraph={isGeneratingGraph}
                areAllAudioFilesReady={areAllAudioFilesReady()}
                callLlmAllAtOnce={callLlmAllAtOnce}
                setCallLlmAllAtOnce={setCallLlmAllAtOnce}
                useLatestTranscription={useLatestTranscription}
                setUseLatestTranscription={setUseLatestTranscription}
                aduModel={aduModel}
                setAduModel={setAduModel}
                rebuttalModel={rebuttalModel}
                setRebuttalModel={setRebuttalModel}
                transcriptionModel={transcriptionModel}
                setTranscriptionModel={setTranscriptionModel}
                generationElapsedTime={generationElapsedTime}
                manualMode={manualMode}
                setManualMode={setManualMode}
                manualState={manualState}
                onManualSubmitAdu={submitManualAdu}
                onManualSubmitRebuttal={submitManualRebuttal}
                resumeTryCount={tryCount}
                setResumeTryCount={setTryCount}
              />
            </div>
          )}

          {activeTab === 'visualization' && (
            <div className="flex flex-col flex-1 min-h-0 h-full">
              {autoLoadedGraphData && (
                <div className="flex-1 min-h-0 basis-0 grow mb-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden relative">
                  <RebuttalGraph
                    data={autoLoadedGraphData}
                    onNodeClick={handleGraphNodeClickUnified}
                    debateFormat={debateFormat}
                    showNodeIds={showNodeIds ?? true}
                  />
                </div>
              )}
              {!autoLoadedGraphData && (
                <div className="flex-1 min-h-0 basis-0 grow mb-2 flex items-center justify-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg">
                  <p className="text-gray-600 dark:text-gray-400">{t('recordPage.messages.noGraphData')}</p>
                </div>
              )}

              <div className="mt-2 mb-2">
                <UnifiedAudioPlayer
                  speechRecordings={speechRecordings}
                  speechCount={DEBATE_SPEECHES.length}
                  isPlaying={isUnifiedPlaying}
                  onPlayPause={handleUnifiedPlayPause}
                  seekToGlobalTime={unifiedSeekTime}
                />
              </div>

              <div className="mt-2 mb-2">
                {showNodeIds !== null && (
                  <VisualizationControlBar
                    roundName={roundName}
                    setRoundName={setRoundName}
                    tryCount={tryCount}
                    setTryCount={setTryCount}
                    roundCandidates={roundCandidates}
                    showNodeIds={showNodeIds}
                    setShowNodeIds={setShowNodeIds}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}