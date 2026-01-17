"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';
import Header from '../../../../components/shared/Header';
import { getAPIRoot } from '../../../../components/lib/utils';
import { useTranslation } from '../../../../context/LanguageContext';

interface VideoInfo {
    id: string;
    title: string;
    description: string;
    channelTitle: string;
    thumbnailUrl: string;
    publishedAt: string;
}

export default function RegisterPage({ params }: { params: { lang: string } }) {
    const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    const { t } = useTranslation();
    const router = useRouter();

    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [motion, setMotion] = useState('');
    const [style, setStyle] = useState<string>('british_parliamentary');
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
                setVideoInfo({
                    id: videoId,
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!videoInfo.id) {
            toast.error(t('dashboard.modal.messages.urlRequired'));
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
                    round_id: roundId
                }),
            });

            toast.dismiss(toastId);

            if (!externalVideoRes.ok) {
                console.error('Failed to create external video');
                toast('動画メタデータの保存に失敗しましたが、試合は登録されました');
            }

            toast.success(t('dashboard.modal.messages.success'));

            // Redirect to the workflow page
            router.push(`/${params.lang}/dashboard/register/${roundId}`);

        } catch (error: any) {
            toast.error(error.message || t('dashboard.modal.messages.failedCreate'));
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Header />
            <div className="min-h-screen bg-background pt-24 pb-12 px-4">
                <div className="max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <Link
                            href={`/${params.lang}/dashboard`}
                            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t('dashboard.modal.labels.back') || 'Back to Dashboard'}
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {t('dashboard.modal.labels.registerNewRound')}
                        </h1>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 mb-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* YouTube URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('dashboard.modal.labels.youtubeUrl')}
                                </label>
                                <input
                                    type="text"
                                    value={youtubeUrl}
                                    onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                                    placeholder={t('dashboard.modal.placeholders.youtubeUrl')}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* Video Preview */}
                            {isLoadingInfo && (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            )}

                            {videoInfo.thumbnailUrl && !isLoadingInfo && (
                                <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                    <Image
                                        src={videoInfo.thumbnailUrl}
                                        alt={videoInfo.title}
                                        width={640}
                                        height={360}
                                        className="w-full h-auto"
                                        sizes="(max-width: 768px) 100vw, 640px"
                                    />
                                    {videoInfo.title && (
                                        <div className="p-4 bg-gray-50 dark:bg-slate-800">
                                            <h3 className="font-semibold text-gray-900 dark:text-white">{videoInfo.title}</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{videoInfo.channelTitle}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Style */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('dashboard.modal.labels.style')}
                                </label>
                                <select
                                    value={style}
                                    onChange={(e) => setStyle(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={isSubmitting}
                                >
                                    <option value="british_parliamentary">{t('recordPage.formatOptions.bp')}</option>
                                    <option value="asian_parliamentary">{t('recordPage.formatOptions.asian')}</option>
                                    <option value="north_american">{t('recordPage.formatOptions.na')}</option>
                                    <option value="bp_opening_half">{t('recordPage.formatOptions.openingHalfBp')}</option>
                                </select>
                            </div>

                            {/* Motion */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('dashboard.modal.labels.motion')}
                                </label>
                                <input
                                    type="text"
                                    value={motion}
                                    onChange={(e) => setMotion(e.target.value)}
                                    placeholder={t('dashboard.modal.placeholders.motion')}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* Submit Button */}
                            <div className="flex gap-4 pt-4">
                                <Link
                                    href={`/${params.lang}/dashboard`}
                                    className="flex-1 px-6 py-3 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-center"
                                >
                                    {t('dashboard.modal.labels.cancel') || 'Cancel'}
                                </Link>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !videoInfo.id}
                                    className="flex-1 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                                    {t('dashboard.modal.labels.register')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
