'use client'
import toast from 'react-hot-toast';
import Head from 'next/head'
import { useState } from 'react'
import { apiRoot } from '../../components/utils/foundation';
import Image from 'next/image';

// Difinition: asr + diarization = transcript

export default function Home() {
    const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    const [videoTitle, setVideoTitle] = useState('');

    // API Input
    const [motion, setMotion] = useState('');
    const [videoId, setVideoId] = useState('');
    const [fileName, setFileName] = useState('');
    const [transcript, setTranscript] = useState([]); // filesをtranscriptsに変更
    const [poiSegmentIds, setPoiSegmentIds] = useState([]);
    const [error, setError] = useState('');

    const videoMetadataFromTitle = async (title) => {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${title}&key=${YOUTUBE_API_KEY}`);
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        return data;
    }

    const handleFileChange = async (event) => {
        const selectedFile = event.target.files[0];

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
                    resolve(JSON.parse(reader.result)); // JSONオブジェクトにパース
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
        });

        try {
            const content = await readerPromise;
            setTranscript(content.speeches);
            setPoiSegmentIds(content.pois);

            const first20SegmentsOfPM = content.speeches[0]
                .slice(0, 10)
                .map(segment => segment.text)
                .join('');

            const first20SegmentsOfLO = content.speeches[1]
                .slice(0, 10)
                .map(segment => segment.text)
                .join('');

            const requestText = "1st proposition:" + first20SegmentsOfPM + ", 1st opposition:" + first20SegmentsOfLO;

            console.log(requestText);

            const response = await fetch(apiRoot + '/motion', {
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

            console.log(data);
            setMotion(data);
        } catch (error) {
            handleCancel();
            toast.error('Error reading file: ' + error.message);
        }

    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        try {
            const requestBody = {
                "motion": motion,
                "video_id": videoId,
                "poi_segment_ids": poiSegmentIds,
                "speeches": transcript, //あとでUPDATEで上書きされる
            }

            const data = await toast.promise(
                (async () => {
                    const response = await fetch(apiRoot + '/rounds', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(requestBody),
                    });

                    if (!response.ok) { //これがないと、Promise自体はResolve=成功扱いになる
                        const errorData = await response.json();
                        throw new Error(errorData.detail || 'Sorry, no idea what happened.');
                    }

                    const data = await response.json();
                    return data;
                })(),
                {
                    loading: 'GPT is analyzing...',
                    success: 'Success!',
                    error: (err) => {
                        // `err` contains the error object
                        return `Error: ${err.message}`;
                    }
                }
            );

            console.log(data);

        } catch (error) {
            console.error('Error processing files:', error)
        }
    }

    const handleCancel = () => {
        document.getElementById('dropzone-file').value = "";
        setFileName("");
    };

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center">
            <Head>
                <title>Registration Page</title>
            </Head>

            <div className="bg-white p-8 rounded shadow-md w-2/3 h-2/3 mt-10">

                <h1 className="text-2xl font-bold mb-6">Registration Page</h1>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="motion">
                            Motion
                        </label>
                        <input
                            type="text"
                            id="motion"
                            placeholder="This House..."
                            className="mt-1 p-2 border w-full rounded"
                            value={motion}
                            onChange={(e) => setMotion(e.target.value)}
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="source">
                            Video ID
                        </label>
                        <input
                            type="text"
                            id="youtube-url"
                            placeholder="Input Youtube URL Here. System will automatically extract video ID."
                            className="mt-1 p-2 border w-full rounded"
                            value={videoId}
                            onChange={(e) => {
                                const url = e.target.value;
                                const videoIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/);
                                if (videoIdMatch && videoIdMatch[1]) {
                                    setVideoId(videoIdMatch[1]);
                                } else {
                                    setVideoId(''); // Clear the video ID if the URL is invalid
                                    toast.error('Invalid YouTube URL. Maybe you input url of list or sth?');
                                }
                            }}
                        />
                        <label className="block text-gray-500 mt-2">
                            {videoTitle}
                        </label>
                        {videoId && (
                            <>
                                <span className="text-gray-500">Thumbnail: </span>
                                <Image
                                    src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                                    alt={videoTitle}
                                    width={480} // Specify the width
                                    height={360} // Specify the height
                                    className="object-cover"
                                />
                            </>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="dropzone-file">
                            Speech Text
                        </label>
                        <label
                            htmlFor="dropzone-file"
                            className="flex flex-col items-center justify-center w-full h-21 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                        >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {(() => {
                                    if (!fileName) {
                                        return (
                                            <>
                                                <svg
                                                    className="w-8 h-8 mb-4 text-gray-500"
                                                    aria-hidden="true"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 20 16"
                                                >
                                                    <path
                                                        stroke="currentColor"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth="2"
                                                        d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                                                    />
                                                </svg>
                                                <p className="mb-2 text-sm text-gray-500">
                                                    <span className="font-semibold">Click or drag & drop</span> files here
                                                </p>
                                            </>
                                        );
                                    } else {
                                        return (
                                            <>
                                                <div className="mb-2 text-sm text-gray-500">
                                                    {fileName}
                                                </div>
                                                <button onClick={handleCancel} className="text-blue-500 underline">Cancel</button>
                                            </>
                                        );
                                    }
                                })()}
                            </div>
                            <input
                                id="dropzone-file"
                                type="file"
                                className="hidden"
                                accept=".json"
                                onChange={handleFileChange}
                            />
                        </label>
                        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded w-full shadow-md transition duration-300"
                    >
                        Upload Files
                    </button>
                </form>
            </div>
        </div>
    )
}
