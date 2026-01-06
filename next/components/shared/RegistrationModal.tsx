"use client";

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { getAPIRoot } from '../lib/utils';
import { useTranslation } from '../../context/LanguageContext';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RegistrationModal({ isOpen, onClose, onSuccess }: RegistrationModalProps) {
  const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  const { t } = useTranslation();

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [motion, setMotion] = useState('');
  const [style, setStyle] = useState('british_parliamentary');
  const [videoInfo, setVideoInfo] = useState<{
    id: string;
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string;
    tags: string[];
    categoryId: string;
  }>({
    id: '',
    title: '',
    description: '',
    publishedAt: '',
    channelId: '',
    channelTitle: '',
    thumbnailUrl: '',
    tags: [],
    categoryId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  // YouTubeのURLからビデオIDを抽出
  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?]+)/);
    return match?.[1] || '';
  };

  const fetchVideoInfo = async (videoId: string) => {
    if (!videoId || !YOUTUBE_API_KEY) return null;

    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      const snippet = data.items?.[0]?.snippet;
      if (snippet) {
        return {
          title: snippet.title,
          description: snippet.description,
          publishedAt: snippet.publishedAt,
          channelId: snippet.channelId,
          channelTitle: snippet.channelTitle,
          thumbnailUrl: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url,
          tags: snippet.tags || [],
          categoryId: snippet.categoryId
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleYoutubeUrlChange = async (url: string) => {
    const videoId = extractVideoId(url);
    let newUrl = url;
    if (videoId) {
      newUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }

    setYoutubeUrl(newUrl);

    if (videoId) {
      setIsLoadingInfo(true);
      const info = await fetchVideoInfo(videoId);
      if (info) {
        setVideoInfo({ id: videoId, ...info });
      } else {
        // Fallback if API fails or no key
        setVideoInfo({
          id: videoId,
          title: '',
          description: '',
          publishedAt: '',
          channelId: '',
          channelTitle: '',
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          tags: [],
          categoryId: ''
        });
      }
      setIsLoadingInfo(false);
    } else {
      setVideoInfo({
        id: '',
        title: '',
        description: '',
        publishedAt: '',
        channelId: '',
        channelTitle: '',
        thumbnailUrl: '',
        tags: [],
        categoryId: ''
      });
    }
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (!youtubeUrl || !videoInfo.id) {
      toast.error(t('dashboard.modal.messages.selectUrlOrFile'));
      return;
    }

    setIsSubmitting(true);


    try {
      // 1. Roundを先に作成（即座に完了）
      const roundRes = await fetch(getAPIRoot() + '/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: videoInfo.title || `YouTube Video ${videoInfo.id}`,
          type: 'external_video',
          style: style,
          motion: motion || null,
          video_id: videoInfo.id,
          owner_id: 'public',
        }),
      });

      if (!roundRes.ok) {
        const errorData = await roundRes.json().catch(() => null);
        const errorDetail = errorData?.detail || '';

        if (errorDetail.includes('already registered')) {
          throw new Error(t('dashboard.modal.messages.videoAlreadyRegistered'));
        }
        throw new Error(t('dashboard.modal.messages.failedCreate'));
      }

      const roundData = await roundRes.json();
      const roundId = roundData.id || roundData.round_id || roundData.data?.id;

      if (!roundId) {
        throw new Error(t('dashboard.modal.messages.idNotFound'));
      }

      // 2. ExternalVideoを作成（transcript取得含む、1-2秒かかる）
      const toastId = toast.loading('字幕を取得中...');

      const externalVideoRes = await fetch(getAPIRoot() + '/external-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoInfo.id,
          title: videoInfo.title,
          description: videoInfo.description,
          published_at: videoInfo.publishedAt,
          channel_id: videoInfo.channelId,
          channel_title: videoInfo.channelTitle,
          thumbnail_url: videoInfo.thumbnailUrl,
          tags: videoInfo.tags,
          category_id: videoInfo.categoryId,
        }),
      });

      toast.dismiss(toastId);

      if (!externalVideoRes.ok) {
        console.error('Failed to create external video');
        // ExternalVideoの失敗は警告のみ（Roundは作成済み）
        toast('動画メタデータの保存に失敗しましたが、試合は登録されました');
      }

      toast.success(t('dashboard.modal.messages.success'));
      resetForm();
      onClose();

    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || t('dashboard.modal.messages.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setYoutubeUrl('');
    setMotion('');
    setStyle('british_parliamentary');
    setVideoInfo({
      id: '',
      title: '',
      description: '',
      publishedAt: '',
      channelId: '',
      channelTitle: '',
      thumbnailUrl: '',
      tags: [],
      categoryId: ''
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-800/50">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('dashboard.modal.title')}</h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">

          {/* YouTube URL入力 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('dashboard.modal.labels.youtubeUrl')}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={t('dashboard.modal.placeholders.youtubeUrl')}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none transition-all text-gray-900 dark:text-gray-100"
                value={youtubeUrl}
                onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
              {isLoadingInfo && (
                <div className="absolute right-3 top-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                </div>
              )}
            </div>
          </div>

          {/* Style入力 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('dashboard.modal.labels.style')}
            </label>
            <div className="relative">
              <select
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none transition-all text-gray-900 dark:text-gray-100 appearance-none"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="british_parliamentary">{t('recordPage.formatOptions.bp')}</option>
                <option value="north_american">{t('recordPage.formatOptions.na')}</option>
                <option value="asian">{t('recordPage.formatOptions.asian')}</option>
                <option value="bp_opening_half">{t('recordPage.formatOptions.openingHalfBp')}</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
              </div>
            </div>
          </div>

          {/* Motion入力 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('dashboard.modal.labels.motion')}
            </label>
            <textarea
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none transition-all text-gray-900 dark:text-gray-100 resize-none"
              rows={3}
              placeholder={t('dashboard.modal.placeholders.motion')}
              value={motion}
              onChange={(e) => setMotion(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* ビデオ情報プレビュー */}
          {videoInfo.id && (
            <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 transition-all duration-300">
              <div className="aspect-video relative rounded-lg overflow-hidden bg-black mb-4 shadow-md">
                <Image
                  src={videoInfo.thumbnailUrl}
                  alt={videoInfo.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 600px"
                />
              </div>
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 line-clamp-2 leading-tight">
                {videoInfo.title || 'Loading title...'}
              </h3>
            </div>
          )}

        </form>

        {/* ボタン */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-800/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
            disabled={isSubmitting}
          >
            {t('dashboard.modal.buttons.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg shadow-md hover:shadow-lg transform transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isSubmitting || !videoInfo.id}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? t('dashboard.modal.buttons.processing') : t('dashboard.modal.buttons.register')}
          </button>
        </div>
      </div>
    </div>
  );
}