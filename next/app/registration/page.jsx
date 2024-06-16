'use client'
import toast from 'react-hot-toast';
import Head from 'next/head'
import { useState } from 'react'

export default function Home() {
    // API Input
    const [motion, setMotion] = useState('');
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');

    const [fileNames, setFileNames] = useState([])
    const [transcripts, setTranscripts] = useState([]) // filesをtranscriptsに変更
    const [error, setError] = useState('')
    const fileNums = [1, 4, 6, 8];
    const [jsonNum, setJsonNum] = useState(0);

    const handleFileChange = async (event) => {
        const selectedFiles = Array.from(event.target.files);
        if (!fileNums.includes(selectedFiles.length)) {
            setError(`You can only upload ${fileNums} files.`);
        } else {
            setError('');
            setJsonNum(selectedFiles.length);
            setFileNames(selectedFiles.map(file => file.name));

            try {
                const readers = selectedFiles.map(file => {
                    const reader = new FileReader();
                    reader.readAsText(file);
                    return new Promise((resolve, reject) => {
                        reader.onload = () => {
                            try {
                                resolve(JSON.parse(reader.result)); // JSONオブジェクトにパース
                            } catch (error) {
                                reject(error);
                            }
                        };
                        reader.onerror = () => reject(new Error('Failed to read file'));
                    });
                });

                const contents = await Promise.all(readers);
                const filteredContents = contents.map(content => content.segments.map(segment => ({
                    text: segment.text,
                    start: segment.start,
                    end: segment.end
                })));
                setTranscripts(filteredContents);
            } catch (error) {
                handleCancel();
                toast.error('Error reading files: ' + error.message);
            }
        }
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        try {
            const req_body = {
                "motion": motion,
                "source": {
                    "title": title,
                    "url": null
                },
                "POIs": [],
                "rebuttals": [],
                // "speeches": [
                //     {
                //         "ADUs": [],
                //         "start_time": 120.121
                //     },
                //     {
                //         "ADUs": [],
                //         "start_time": 120.121
                //     }
                // ] //どういう仕組みでこのふざけたreq_bodyで動いてるんだ・・・？ 毎回speechIdが奇数になる理由はこれだ。ここで毎回必ず2個のspeechが作られるから。
                "speeches": Array.from({length: jsonNum}, () => ({ "ADUs": [], "start_time": 120.121 }))
            }

            const response = await fetch('http://localhost:8080/rounds', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(req_body),
            })

            if (!response.ok) {
                throw new Error('Round files failed to upload');
            }

            const data = await response.json();
            const speechIds = data.speeches.map(speech => speech.id);
            console.log(speechIds);

            for (let i = 0; i < transcripts.length; i++) {
                console.log(i, transcripts[i]);
                const response2 = await fetch(`http://localhost:8080/speech/${speechIds[i]}/asr`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(transcripts[i]),
                })

                if (!response2.ok) {
                    throw new Error('Failed to upload speech file[' + i + "], whose speech id=" + speechIds[i]);
                }
            }

            toast.success(`Successfully uploaded!`);
        } catch (error) {
            console.error('Error processing files:', error)
            toast.error(`Error: ` + error.message);
        }
    }

    const handleCancel = () => {
        document.getElementById('dropzone-file').value = "";
        setFileNames([]);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <Head>
                <title>Registration Page</title>
            </Head>

            <div className="bg-white p-8 rounded shadow-md w-full">

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
                        <label className="block text-gray-700 mb-2" htmlFor="source">
                            URL <span className="text-red-500">(*Optional)</span>
                        </label>
                        <input
                            type="text"
                            id="url"
                            placeholder="https://www.youtube.com/watch?v=4HUFM3JZaLQ"
                            className="mt-1 p-2 border w-full rounded"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
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
                                    switch (fileNames.length) {
                                        case 0:
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
                                        case 1:
                                            return (
                                                <>
                                                    <div className="mb-2 text-sm text-gray-500">
                                                        {fileNames[0]}
                                                    </div>
                                                    <button onClick={handleCancel} className="text-blue-500 underline">Cancel</button>
                                                </>
                                            );
                                        default:
                                            return (
                                                <>
                                                    <ul className="mb-2 text-sm text-gray-500 grid grid-cols-2 gap-4">
                                                        {fileNames.map((name, index) => (
                                                            <li key={index} className="break-words">{index + 1}: {name}</li>
                                                        ))}
                                                    </ul>
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
                                multiple
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
