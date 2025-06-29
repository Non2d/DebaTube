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
  const [videoTitle, setVideoTitle] = useState('');
  
  // API Input
  const [motion, setMotion] = useState('');
  const [tag, setTag] = useState('');
  const [videoId, setVideoId] = useState('');
  const [fileName, setFileName] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [poiSegmentIds, setPoiSegmentIds] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoMetadataFromTitle = async (title: string) => {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${title}&key=${YOUTUBE_API_KEY}`);
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    return data;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setError('');
    setFileName(selectedFile.name);
    const csvTitle = selectedFile.name.split('.')[0];
    const videoMetadata = await videoMetadataFromTitle(csvTitle);
    setVideoId(videoMetadata.items[0].id.videoId);
    setVideoTitle(videoMetadata.items[0].snippet.title);

    const reader = new FileReader();
    reader.readAsText(selectedFile);
    const readerPromise = new Promise((resolve, reject) => {
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result as string));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });

    try {
      const content: any = await readerPromise;
      setTranscript(content.speeches);
      setPoiSegmentIds(content.pois);

      const first20SegmentsOfPM = content.speeches[0]
        .slice(0, 10)
        .map((segment: any) => segment.text)
        .join('');

      const first20SegmentsOfLO = content.speeches[1]
        .slice(0, 10)
        .map((segment: any) => segment.text)
        .join('');

      const requestText = "1st proposition:" + first20SegmentsOfPM + ", 1st opposition:" + first20SegmentsOfLO;

      const response = await fetch(getAPIRoot() + '/motion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ digest: requestText }),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setMotion(data);
    } catch (error: any) {
      handleCancel();
      toast.error('Error reading file: ' + error.message);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const requestBody = {
        "motion": motion,
        "video_id": videoId,
        "poi_segment_ids": poiSegmentIds,
        "speeches": transcript,
        "tag": tag,
      };

      const data = await toast.promise(
        (async () => {
          const response = await fetch(getAPIRoot() + '/rounds', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Sorry, no idea what happened.');
          }

          const data = await response.json();
          return data;
        })(),
        {
          loading: 'GPT is analyzing...',
          success: 'Success!',
          error: (err: any) => {
            return `Error: ${err.message}`;
          }
        }
      );

      // Reset form
      setMotion('');
      setTag('');
      setVideoId('');
      setFileName('');
      setTranscript([]);
      setPoiSegmentIds([]);
      setVideoTitle('');
      setError('');
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error processing files:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    const fileInput = document.getElementById('dropzone-file') as HTMLInputElement;
    if (fileInput) fileInput.value = "";
    setFileName("");
  };

  const handleClose = () => {
    // Reset all form data when closing
    setMotion('');
    setTag('');
    setVideoId('');
    setFileName('');
    setTranscript([]);
    setPoiSegmentIds([]);
    setVideoTitle('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Register New Round</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-gray-700 mb-2" htmlFor="motion">
              Motion
            </label>
            <input
              type="text"
              id="motion"
              placeholder="This House..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={motion}
              onChange={(e) => setMotion(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-2" htmlFor="tag">
              Tag
            </label>
            <input
              type="text"
              id="tag"
              placeholder="Crime,Environment,etc."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-2" htmlFor="youtube-url">
              Video ID
            </label>
            <input
              type="text"
              id="youtube-url"
              placeholder="Input Youtube URL Here. System will automatically extract video ID."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={videoId}
              onChange={(e) => {
                const url = e.target.value;
                const videoIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/);
                if (videoIdMatch && videoIdMatch[1]) {
                  setVideoId(videoIdMatch[1]);
                } else {
                  setVideoId('');
                  if (url && !videoIdMatch) {
                    toast.error('Invalid YouTube URL. Maybe you input url of list or sth?');
                  }
                }
              }}
              disabled={isSubmitting}
              required
            />
            {videoTitle && (
              <p className="text-gray-500 mt-2">{videoTitle}</p>
            )}
            {videoId && (
              <div className="mt-3">
                <span className="text-gray-500 text-sm">Thumbnail:</span>
                <div className="mt-2">
                  <Image
                    src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                    alt={videoTitle}
                    width={320}
                    height={240}
                    className="rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 mb-2" htmlFor="dropzone-file">
              Speech Text
            </label>
            <label
              htmlFor="dropzone-file"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {!fileName ? (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click or drag & drop</span> files here
                    </p>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="mb-2 text-sm text-gray-700">{fileName}</p>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="text-blue-500 hover:text-blue-700 underline text-sm"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <input
                id="dropzone-file"
                type="file"
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
                disabled={isSubmitting}
                required
              />
            </label>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !motion || !tag || !videoId || !fileName}
            >
              {isSubmitting ? '処理中...' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}