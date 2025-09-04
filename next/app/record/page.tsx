"use client";

import { useState, useRef } from 'react';
import { Mic, Square, Download, Play, Pause } from 'lucide-react';
import Header from '../../components/shared/Header';

export default function RecordPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      intervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
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
    }
  };

  const playAudio = () => {
    if (audioBlob && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        if (!audioRef.current.src) {
          const url = URL.createObjectURL(audioBlob);
          audioRef.current.src = url;
          
          audioRef.current.onloadedmetadata = () => {
            const audioDuration = audioRef.current?.duration;
            console.log('Duration loaded:', audioDuration);
            if (audioDuration && isFinite(audioDuration)) {
              setDuration(audioDuration);
            } else {
              // durationが取得できない場合は録音時間を使用
              setDuration(recordingDuration);
            }
          };
          
          audioRef.current.ontimeupdate = () => {
            setCurrentTime(audioRef.current?.currentTime || 0);
          };
          
          audioRef.current.onended = () => {
            setIsPlaying(false);
            setCurrentTime(0);
          };
          
          audioRef.current.oncanplaythrough = () => {
            const audioDuration = audioRef.current?.duration;
            console.log('Can play through, duration:', audioDuration);
            if (audioDuration && isFinite(audioDuration)) {
              setDuration(audioDuration);
            } else {
              // durationが取得できない場合は録音時間を使用
              setDuration(recordingDuration);
            }
          };
          
          audioRef.current.load();
        }
        
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = parseFloat(e.target.value);
      const maxTime = duration || recordingDuration;
      const seekTime = Math.min(newTime, maxTime);
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const downloadAudio = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${new Date().toISOString().split('T')[0]}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) {
      return '00:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Header />
      <div className="pt-20 min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              録音アプリ
            </h1>
            <p className="text-gray-600">
              ボタンを押して録音を開始してください
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border">
            {/* 録音時間表示 */}
            <div className="text-center mb-8">
              <div className="text-3xl font-mono font-bold text-gray-900">
                {formatTime(recordingDuration)}
              </div>
              {isRecording && (
                <div className="mt-2 flex justify-center items-center">
                  <div className="animate-pulse bg-red-500 rounded-full w-3 h-3 mr-2"></div>
                  <span className="text-red-500 font-medium">録音中</span>
                </div>
              )}
            </div>

            {/* 録音ボタン */}
            <div className="flex justify-center mb-8">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full p-6 transition-colors duration-200 shadow-lg hover:shadow-xl"
                >
                  <Mic size={48} />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="bg-gray-500 hover:bg-gray-600 text-white rounded-full p-6 transition-colors duration-200 shadow-lg hover:shadow-xl"
                >
                  <Square size={48} />
                </button>
              )}
            </div>

            {/* 録音後のコントロール */}
            {audioBlob && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  録音完了 (録音時間: {formatTime(recordingDuration)})
                </h3>
                
                {/* 音声プレーヤー */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration || recordingDuration)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || recordingDuration}
                    value={currentTime || 0}
                    onChange={handleSeek}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: '#d1d5db',
                      outline: 'none',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                    }}
                  />
                </div>
                
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={playAudio}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors duration-200"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    <span>{isPlaying ? '一時停止' : '再生'}</span>
                  </button>
                  <button
                    onClick={downloadAudio}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors duration-200"
                  >
                    <Download size={20} />
                    <span>ダウンロード</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <audio ref={audioRef} className="hidden" />
        </div>
      </div>
    </>
  );
}