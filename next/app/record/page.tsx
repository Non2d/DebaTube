"use client";

import { useState, useRef } from 'react';
import Header from '../../components/shared/Header';
import RecordButton from './components/RecordButton';
import TimerDisplay from './components/TimerDisplay';
import AudioPlayer from './components/AudioPlayer';

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

export default function RecordPage() {
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [speechRecordings, setSpeechRecordings] = useState<{[key: number]: {blob: Blob, duration: number} | null}>({});
  const [currentPlayingSpeech, setCurrentPlayingSpeech] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef<number>(0);

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
            duration: durationRef.current
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

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
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
      a.download = `${DEBATE_SPEECHES[speechIndex].name.replace(/ /g, '_')}-${new Date().toISOString().split('T')[0]}.webm`;
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15,18 9,12 15,6"></polyline>
                </svg>
                <span className="font-medium">前へ</span>
              </button>
              
              <div className="text-center px-8">
                <h2 className={`text-2xl font-bold ${
                  currentSpeech.team === 'proposition' ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {currentSpeech.name}
                </h2>
              </div>
              
              <button
                onClick={nextSpeech}
                disabled={currentSpeechIndex === DEBATE_SPEECHES.length - 1}
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-full hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
              >
                <span className="font-medium">次へ</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9,18 15,12 9,6"></polyline>
                </svg>
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
            <h3 className="text-xl font-bold text-gray-900 mb-4">録音済みスピーチ</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {DEBATE_SPEECHES.map((speech, index) => {
                const recording = speechRecordings[index];
                if (!recording) return null;

                return (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className={`font-medium ${
                          speech.team === 'proposition' ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {speech.name}
                        </h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (currentPlayingSpeech === index) {
                              handlePlayPause();
                            } else {
                              setCurrentPlayingSpeech(index);
                              setIsPlaying(true);
                            }
                          }}
                          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                        >
                          {currentPlayingSpeech === index && isPlaying ? '停止' : '再生'}
                        </button>
                        <button
                          onClick={() => downloadAudio(index)}
                          className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                        >
                          ダウンロード
                        </button>
                      </div>
                    </div>
                    <AudioPlayer
                      audioBlob={recording.blob}
                      recordingDuration={recording.duration}
                      isPlaying={currentPlayingSpeech === index ? isPlaying : false}
                      onPlayPause={() => {
                        if (currentPlayingSpeech === index) {
                          handlePlayPause();
                        } else {
                          setCurrentPlayingSpeech(index);
                          setIsPlaying(true);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}