'use client'
import Head from 'next/head'
import { useState } from 'react'

export default function Home() {
    // API Input
    const [motion, setMotion] = useState('');
    const [source, setSource] = useState('');

    const [fileNames, setFileNames] = useState([])
    const [transcripts, setTranscripts] = useState([]) // filesをtranscriptsに変更
    const [error, setError] = useState('')
    const maxFiles = 8

    const handleFileChange = async (event) => {
        const selectedFiles = Array.from(event.target.files);
        if (selectedFiles.length > maxFiles) {
            setError(`You can only upload up to ${maxFiles} files.`);
        } else {
            setError('');
            setFileNames(selectedFiles.map(file => file.name));
    
            const readers = selectedFiles.map(file => {
                const reader = new FileReader();
                reader.readAsText(file);
                return new Promise(resolve => {
                    reader.onload = () => resolve(JSON.parse(reader.result)); // JSONオブジェクトにパース
                });
            });
    
            const contents = await Promise.all(readers);
            const filteredContents = contents.map(content => content.segments.map(segment => ({
                text: segment.text,
                start: segment.start,
                end: segment.end
            })));
            setTranscripts(filteredContents);
        }
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        try {
            console.log(transcripts[0]);

            const req_body = {
                "motion": motion,
                "source": {
                    "title": "WSDC 2019 Round 1",
                    "url": null
                },
                "POIs": [],
                "rebuttals": [],
                "speeches": [
                    {
                        "ADUs": [
                            {
                                "segments": [],//transcripts[0],
                                "sequence_id": null,
                                "transcript": null
                            }
                        ],
                        "start_time": null
                    }
                ]
            }

            const response = await fetch('http://localhost:8080/rounds', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(req_body),
            })

            const response2 = await fetch('http://localhost:8080/speech/{speech_id}/asr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(transcripts[0]),
            })

            if (response.ok && response2.ok) {
                alert('Files uploaded successfully')
            } else {
                alert('Failed to upload files')
            }
        } catch (error) {
            console.error('Error processing files:', error)
            alert('An error occurred while uploading files')
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <Head>
                <title>Registration Page</title>
            </Head>

            <div className="bg-white p-8 rounded shadow-md w-96">
                <h1 className="text-2xl font-bold mb-6">Registration Page</h1>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="motion">
                            Motion
                        </label>
                        <input
                            type="text"
                            id="motion"
                            placeholder="This House Would ..."
                            className="mt-1 p-2 border w-full rounded"
                            value={motion}
                            onChange={(e) => setMotion(e.target.value)}
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="source">
                            Source
                        </label>
                        <input
                            type="text"
                            id="source"
                            placeholder="xxx.mp3"
                            className="mt-1 p-2 border w-full rounded"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2" htmlFor="dropzone-file">
                            SpeechText
                        </label>
                        <label
                            htmlFor="dropzone-file"
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                        >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
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
                                {fileNames.length > 0 ? (
                                    <ul className="mb-2 text-sm text-gray-500">
                                        {fileNames.map((name, index) => (
                                            <li key={index}>{name}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <>
                                        <p className="mb-2 text-sm text-gray-500">
                                            <span className="font-semibold">Click to upload</span> or
                                            drag and drop
                                        </p>
                                        <p className="text-xs text-gray-500">.json only</p>
                                    </>
                                )}
                            </div>
                            <input
                                id="dropzone-file"
                                type="file"
                                className="hidden"
                                multiple
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
