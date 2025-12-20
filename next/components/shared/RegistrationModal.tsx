"use client";

import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { getAPIRoot } from '../lib/utils';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RegistrationModal({ isOpen, onClose, onSuccess }: RegistrationModalProps) {
  const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  const [input, setInput] = useState({
    youtubeUrl: '',
    audioFile: null as File | null,
    title: ''
  });
  const [videoInfo, setVideoInfo] = useState({ id: '', title: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // YouTubeのURLからビデオIDを抽出
  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?]+)/);
    return match?.[1] || '';
  };

  // YouTube動画情報を取得
  const fetchVideoTitle = async (videoId: string) => {
    if (!videoId || !YOUTUBE_API_KEY) return '';

    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      return data.items?.[0]?.snippet?.title || '';
    } catch {
      return '';
    }
  };

  // YouTube URL変更時の処理
  const handleYoutubeUrlChange = async (url: string) => {
    setInput(prev => ({ ...prev, youtubeUrl: url }));

    const videoId = extractVideoId(url);
    if (videoId) {
      const title = await fetchVideoTitle(videoId);
      setVideoInfo({ id: videoId, title });
    } else {
      setVideoInfo({ id: '', title: '' });
    }
  };

  // ファイル選択処理
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileBaseName = file.name.replace(/\.[^/.]+$/, '');
      setInput(prev => ({ ...prev, audioFile: file, title: fileBaseName }));
    }
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (!input.youtubeUrl && !input.audioFile) {
      toast.error('YouTube URLまたは音声ファイルを選択してください');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Roundを作成
      const roundRes = await fetch(getAPIRoot() + '/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title || videoInfo.title,
          video_id: videoInfo.id,
        }),
      });

      if (!roundRes.ok) {
        throw new Error('Failed to create round');
      }

      const roundData = await roundRes.json();
      console.log('Round response:', roundData); // デバッグ用

      // roundIdの取得（レスポンス構造に応じて調整）
      const roundId = roundData.id || roundData.round_id || roundData.data?.id;

      if (!roundId) {
        throw new Error('Round ID not found in response');
      }

      // 2. 音声処理APIを呼び出し
      let processRes;

      if (input.youtubeUrl && videoInfo.id) {
        // YouTube URLの場合
        processRes = await fetch('/api/nlp/extract-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: input.youtubeUrl,
            is_playlist: false,
            round_id: parseInt(roundId),
            start_bg_tasks: false
          }),
        });
      } else if (input.audioFile) {
        // 音声ファイルの場合
        const formData = new FormData();
        formData.append('file', input.audioFile);
        formData.append('round_id', roundId.toString());
        formData.append('start_bg_tasks', 'false');

        processRes = await fetch('/api/nlp/upload-audio', {
          method: 'POST',
          body: formData,
        });
      }

      if (!processRes?.ok) {
        throw new Error('Failed to process audio');
      }

      toast.success('登録が完了しました！');

      // リセットして閉じる
      resetForm();
      onSuccess?.();
      onClose();

    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // フォームリセット
  const resetForm = () => {
    setInput({ youtubeUrl: '', audioFile: null, title: '' });
    setVideoInfo({ id: '', title: '' });
  };

  // モーダルを閉じる
  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">Register new round</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* タイトル */}
          <div>
            <label className="block text-sm font-medium mb-2">
              タイトル
            </label>
            <textarea
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={1}
              placeholder="タイトルを入力..."
              value={input.title || videoInfo.title}
              onChange={(e) => setInput(prev => ({ ...prev, title: e.target.value }))}
              disabled={isSubmitting}
            />
          </div>

          {/* YouTube URL入力 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              YouTube URL
            </label>
            <input
              type="text"
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              value={input.youtubeUrl}
              onChange={(e) => handleYoutubeUrlChange(e.target.value)}
              disabled={isSubmitting}
            />

            {/* サムネイルプレビュー */}
            {videoInfo.id && (
              <div className="mt-3 space-y-2">
                <Image
                  src={`https://img.youtube.com/vi/${videoInfo.id}/mqdefault.jpg`}
                  alt={videoInfo.title}
                  width={320}
                  height={180}
                  className="rounded"
                />
              </div>
            )}
          </div>

          {/* ファイルアップロード */}
          <div>
            <label className="block text-sm font-medium mb-2">
              音声ファイル
            </label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="file"
                className="hidden"
                accept="audio/*"
                onChange={handleFileSelect}
                disabled={isSubmitting}
              />
              {!input.audioFile ? (
                <>
                  <Upload className="w-8 h-8 mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">クリックしてファイルを選択</p>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium">{input.audioFile.name}</p>
                  <button
                    type="button"
                    onClick={() => setInput(prev => ({ ...prev, audioFile: null }))}
                    className="text-sm text-blue-500 hover:underline mt-1"
                  >
                    削除
                  </button>
                </div>
              )}
            </label>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              disabled={isSubmitting || (!input.youtubeUrl && !input.audioFile)}
            >
              {isSubmitting ? '処理中...' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}