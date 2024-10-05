'use client'
import toast from 'react-hot-toast';
import Head from 'next/head'
import { useState } from 'react'

// Difinition: asr + diarization = transcript

export default function Home() {
    // API Input
    const [motion, setMotion] = useState('');
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');

    const [fileName, setFileName] = useState('');
    const [transcripts, setTranscripts] = useState([]) // filesをtranscriptsに変更
    const [error, setError] = useState('')

    console.log(fileName)

    const handleFileChange = async (event) => {
        const selectedFile = event.target.files[0];

        setError('');
        setFileName(selectedFile.name);

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
            console.log(JSON.stringify(content));
            console.log(content.speeches.length)
            setTranscripts(content.speeches);
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
                "title": title,
                "pois": [],
                "speeches": Array.from({ length: transcripts.length }, () => ([{"start": -1, "end": -1, "text": ""}])), //あとでUPDATEで上書きされる
            }

            const argumentUnitResponse = await fetch('http://localhost:8080/rounds', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            })

            if (!argumentUnitsResponse.ok) {
                throw new Error('Round files failed to upload');
            }



            const data = await argumentUnitResponse.json();
            const roundId = data.id;

            const response2 = await fetch(`http://localhost:8080/round/${roundId}/asr`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(transcripts),
            })

            if (!response2.ok) {
                throw new Error('Failed to upload speech files whose round id=' + roundId);
            }

            toast.success(`Successfully uploaded!`);
        } catch (error) {
            console.error('Error processing files:', error)
            toast.error(`Error: ` + error.message);
        }
    }

    const handleCancel = () => {
        document.getElementById('dropzone-file').value = "";
        setFileName([]);
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
                            placeholder="This House Supports Hate Speech"
                            className="mt-1 p-2 border w-full rounded"
                            value={motion}
                            onChange={(e) => setMotion(e.target.value)}
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="source">
                            Title
                        </label>
                        <input
                            type="text"
                            id="title"
                            placeholder="WSDC_2017_GF"
                            className="mt-1 p-2 border w-full rounded"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="dropzone-file">
                            SpeechText
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
