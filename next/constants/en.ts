
export const en = {
    header: {
        title: "DebaTube Live",
        explore: "Explore",
        dashboard: "Dashboard", // keeping purely for backward compat if needed, or I can remove. I'll keep it for now.
        dashboardVideo: "Round Videos",
        record: "Record",
    },
    nav: {
        explore: "Explore",
        dashboard: "Dashboard",
        record: "Record",
        login: "Login",
    },
    timer: {
        overTime: "Over Time",
        recording: "Recording",
    },
    recordingCard: {
        recordings: "recordings",
        play: "Play",
        pause: "Pause",
        stop: "Stop",
        download: "Download",
        noRecording: "No recording",
        proposition: "Proposition",
        opposition: "Opposition",
    },
    explore: {
        tabs: {
            all: "All",
            criminalJustice: "Criminal Justice",
            gender: "Gender",
            economy: "Economy",
            politics: "Politics",
        },
        sort: {
            date: "Date Uploaded",
            distance: "Distance",
            interval: "Interval",
            order: "Order",
            rally: "Rally",
            dateDesc: "When uploaded on YouTube or DebaTube",
            distanceDesc: "Spatial separation between argument clusters",
            intervalDesc: "Time gaps between speech segments",
            orderDesc: "Sequential position in debate flow",
            rallyDesc: "Frequency of back-and-forth exchanges",
            largestFirst: "Largest First",
            smallestFirst: "Smallest First",
        },
        pinned: "{count} pinned",
    },
    unifiedPlayer: {
        noAudio: "No audio files",
        play: "Play",
        pause: "Pause",
        prop: "Prop",
        opp: "Opp",
    },
    recordPage: {
        tabs: {
            dashboard: "Dashboard",
            audio: "Audio",
            visualization: "Visualization",
        },
        controls: {
            format: "Format",
            roundId: "Round ID",
            enterRoundId: "Enter Round ID...",
            searchRoundId: "Search Round ID...",
            motion: "Motion",
            motionPlaceholder: "Enter motion (optional)",
            generationTabs: {
                auto: "Auto Generation",
                manual: "Manual Generation"
            },
            generateGraph: "GENERATE GRAPH",
            generateAuto: "GENERATE GRAPH (AUTO)",
            generateManual: "GENERATE GRAPH (MANUAL)",
            processing: "PROCESSING...",
            processingWithTime: "PROCESSING... ({seconds}s)",
        },
        advancedOptions: {
            title: "Advanced Options",
            show: "Show Advanced Options",
            hide: "Hide Advanced Options",
            processAllAtOnce: "ADU segmentation is performed for all speeches in a single unified prompt",
            useLatestTranscription: "Use existing transcription for the same Round ID if available (skip re-transcription)",
            aduModel: "ADU Segmentation Model",
            rebuttalModel: "Rebuttal Identification Model",
            transcriptionModel: "Transcription Model",
        },
        status: {
            processing: "Processing: {seconds}s",
            success: "Graph generated successfully! ({seconds}s)",
            error: "Error: {message}",
            transcribed: "- Transcribed: {files} files",
            adus: "- ADUs: {total}",
            rebuttalPairs: "- Rebuttal pairs: {total}",
            savedTo: "Results saved to: {path}",
        },
        messages: {
            enterRoundId: "Please enter round ID",
            allAudioRequired: "All audio files required",
            confirmGenerate: "Generate graph?\n\nThis may take several minutes to complete.",
            invalidTryCount: 'Invalid Try Count. The next valid Try Count is {{next}}. You cannot skip numbers.',
            matchNotFound: 'Data for version {count} does not exist.',
            matchNotFoundReverting: 'Round data not found. Reverting to valid Try Count: {{next}}.',
            invalidJson: "Invalid JSON format. Please ensure it contains 'speeches' and 'rebuttals' properties.",
            failedJson: "Failed to parse JSON file: {error}",
            micDenied: "Microphone access denied. Please check your browser settings.",
            failedSave: "Failed to save recording. Please try again.",
            noGraphData: "Graph data not available. Please generate graph in Home tab.",
        },
        toggles: {
            poiColor: "POI Color",
            nodeId: "Node ID",
        },
        formatOptions: {
            na: "NA (6 speeches)",
            asian: "ASIAN (8 speeches)",
            wsdc: "WSDC (8 speeches)",
            hpdu: "HPDU (8 speeches)",
            bp: "BP (8 speeches)",
            openingHalfBp: "Opening Half BP (4 speeches)",
        },
        speechNames: {
            Proposition_1st: "Proposition 1st",
            Opposition_1st: "Opposition 1st",
            Proposition_2nd: "Proposition 2nd",
            Opposition_2nd: "Opposition 2nd",
            Proposition_3rd: "Proposition 3rd",
            Opposition_3rd: "Opposition 3rd",
            Proposition_4th: "Proposition 4th",
            Opposition_4th: "Opposition 4th",
        },
        manualMode: {
            title: "Manual Mode",
            initialButton: "Create New Round Data & Transcribe (Manual)",
            processingAudio: "Processing Audio...",
            step1Title: "Step 1: Transcription",
            step2Title: "Step 2: ADU Segmentation",
            step3Title: "Step 3: Rebuttal Identification",
            tryCount: "Version {count}",
            tryCountPlaceholder: "Version Number",
            promptLabel: "Prompt for LLM",
            pasteLabel: "Paste JSON Result",
            placeholder: "Paste the JSON output from Gemini here...",
            submit: "Submit Data",
            completed: "Manual Generation Sequence Completed!",
            copy: "Copy",
            copied: "Copied",
            invalidJson: "Invalid JSON format",
            resume: "Resume",
            resumeLabel: "Version (for interrupted process)",
            versionLabel: "Version",
            resumeFailed: "Could not find data to resume for the specified Version count.",
            submitAdu: "Submit ADU JSON",
            submitRebuttal: "Submit Rebuttal JSON",
        }
    },
    landingPage: {
        hero: {
            titlePart1: "LLM Visualizes",
            titlePart2: "Parliamentary Debate",
            description: "Transform competitive debate analysis with cutting-edge LLM technology. Visualize argument flows, analyze rebuttals, and understand debate structures like never before.",
            getStarted: "Get Started",
            watchDemo: "Watch Demo",
        },
        features: {
            titlePart1: "Powerful Features for",
            titlePart2: "Debate Analysis",
            description: "Our advanced AI-powered platform provides comprehensive tools for analyzing and visualizing competitive debates.",
            items: {
                llmAnalysis: {
                    title: "LLM-Powered Analysis",
                    desc: "Advanced LLM technology analyzes debate arguments and rebuttals with precision"
                },
                visualization: {
                    title: "Real-time Visualization",
                    desc: "Dynamic flowcharts show argument structures and counter-arguments instantly"
                },
                structureMapping: {
                    title: "Debate Structure Mapping",
                    desc: "Comprehensive mapping of government and opposition positions"
                },
                endToEnd: {
                    title: "End-to-End Processing",
                    desc: "Automatic transcription and rebuttal identification from debate recordings"
                }
            }
        },
        benefits: {
            titlePart1: "Why Choose",
            titlePart2: "DebaTube?",
            description: "Experience the future of debate analysis with our comprehensive platform designed for coaches, students, and researchers.",
            items: {
                item1: "Instant argument structure visualization",
                item2: "AI-powered rebuttal detection",
                item3: "Multi-format export capabilities",
                item4: "Real-time collaborative editing",
                item5: "Comprehensive debate archives",
                item6: "Performance analytics"
            }
        },
        parliamentaryDebate: {
            titlePart1: "What is",
            titlePart2: "Parliamentary Debate?",
            description: "Parliamentary debate is a dynamic format where teams advocate for and against a motion, fostering critical thinking and persuasive communication skills.",
            keyFeaturesTitle: "Key Features of Parliamentary Debate",
            features: {
                govVsOpp: {
                    title: "Government vs Opposition",
                    desc: "Two teams debate a motion: the Government supports it while the Opposition challenges it, creating a structured adversarial format."
                },
                strategicArgs: {
                    title: "Strategic Argumentation",
                    desc: "Success requires not just strong individual arguments but understanding how arguments interact, clash, and build upon each other throughout the debate."
                }
            },
            visualizationTitle: "Why Visualization Matters",
            visualizations: {
                complexStructure: {
                    title: "Complex Argument Structures:",
                    desc: "Parliamentary debates create intricate webs of claims, evidence, and rebuttals that are difficult to track mentally."
                },
                realTime: {
                    title: "Real-time Analysis:",
                    desc: "Understanding how arguments clash and connect in real-time improves both debate performance and judging accuracy."
                },
                educational: {
                    title: "Educational Value:",
                    desc: "Visual representation helps students learn argumentation patterns and identify strategic opportunities."
                },
                postRound: {
                    title: "Post-Round Analysis:",
                    desc: "Comprehensive visual summaries enable detailed feedback and performance improvement."
                }
            }
        },
        cta: {
            title: "Ready to Transform Your Debate Analysis?",
            description: "Join thousands of debaters, judges and researchers who will leverage DebaTube to enhance their parliamentary debate skills.",
            button: "Get Started"
        },
        footer: {
            description: "Revolutionizing debate analysis through AI-powered visualization",
            privacy: "Privacy",
            terms: "Terms",
            support: "Support",
            copyright: "© 2024 DebaTube. All rights reserved."
        }
    },
    dashboard: {
        title: "Dashboard",
        description: "Overview of all debate rounds and their statistics",
        registerNewRound: "Register New Round Video",
        tabs: {
            youtube: "YouTube Videos",
            record: "Recordings"
        },
        stats: {
            totalRounds: "Total Rounds",
            totalPois: "Total POIs",
            totalRebuttals: "Total Rebuttals",
            argumentUnits: "ADUs"
        },
        table: {
            title: "All Rounds",
            error: "Error loading rounds",
            noRounds: "No rounds found",
            headers: {
                title: "Title",
                style: "Style",
                motion: "Motion",
                pois: "POIs",
                rebuttals: "Rebuttals",
                speeches: "Speeches",
                arguments: "ADUs",
                tag: "Tag"
            }
        },
        modal: {
            labels: {
                back: "Back to Dashboard",
                registerNewRound: "Register New Round Video",
                registerRound: "Register a Round",
                youtubeUrl: "YouTube URL",
                style: "Debate Style",
                motion: "Motion",
                cancel: "Cancel",
                register: "Register"
            },
            placeholders: {
                youtubeUrl: "https://www.youtube.com/watch?v=...",
                motion: "This house believes that..."
            },
            messages: {
                urlRequired: "Please enter a YouTube URL",
                idNotFound: "Failed to retrieve round ID",
                videoAlreadyRegistered: "This video is already registered",
                failedCreate: "Failed to create round",
                success: "Video registered successfully",
                error: "An error occurred",
                selectUrlOrFile: "Please select a file or enter a YouTube URL"
            },
            styleChange: {
                title: "Change Style?",
                warning: "Changing the style will cause data inconsistency with STEP 2 and beyond.",
                recommendation: "We recommend resetting from STEP 2 before making changes.",
                confirm: "Do you really want to change it?",
                cancel: "Cancel",
                change: "Change"
            }
        },
        steps: {
            title: "Processing Workflow",
            transcriptGeneration: "STEP 1: Transcript Generation",
            transcriptGenerationDesc: "Download audio and generate transcript",
            speakerDiarization: "STEP 2: Speaker Diarization",
            speakerDiarizationDesc: "Assign speakers to segments",
            aduSegmentation: "STEP 3: ADU Segmentation",
            aduSegmentationDesc: "Identify arguments and POIs",
            rebuttalDetection: "STEP 4: Rebuttal Detection",
            rebuttalDetectionDesc: "Identify rebuttal relationships",
            autoMode: "LLM Auto Mode",
            descriptions: {
                autoDiarization: "Automatically detect speakers using Gemini.",
                autoAdu: "Automatically segment speech into arguments.",
                autoRebuttal: "Automatically identify rebuttal structure."
            },
            subSteps: {
                downloadAudio: "Download Audio",
                transcribeWords: "Transcribe Audio",
                registerWords: "Register Words",
                groupSentences: "Group Words into Sentences"
            },
            status: {
                processing: "Processing...",
                completed: "Completed",
                pending: "Pending",
                error: "Error",
                loadingSentences: "Loading sentences...",
            },
            actions: {
                runStep: "Run Step",
                running: "Running...",
                reset: "Reset",
                resumeStep: "Resume from here",
                runAllSteps: "Run All Steps Automatically",
                runAllRemainingSteps: "Run All Remaining Steps",
                resumeAllSteps: "Resume All Steps",
                // Dialog messages
                resetDialogTitle: "Reset Progress?",
                resetDialogContent: "You are about to reset progress from {step} onwards. All data for this step and subsequent steps will be permanently deleted. Are you sure you want to continue?",
                resetDialogConfirm: "Yes, Reset Progress",
                resetDialogCancel: "Cancel",
                copyPrompt: "Copy Prompt",
                copied: "Copied",
                registerVerify: "Register & Verify",
                updateContinue: "Update & Continue",
                resetToLastSaved: "Reset to Last Saved",
            },
            subStep2A: {
                title: "Step 2-A: Initial AI Diarization",
                description: "Generate an initial proposal for speaker separation using LLM.",
            },
            subStep2B: {
                title: "Step 2-B: Visual Diarization Editor",
                description: "Drag the colored bars to adjust speaker ranges.",
            },
            labels: {
                transcriptPrompt: "Transcript Prompt (Auto-generated)",
                geminiResponse: "Gemini Response (Paste JSON here)",
                speakerTimeline: "Speaker Timeline",
            },
            errors: {
                videoNotFound: "Video ID not found",
            },
            timer: {
                processing: "Processing... ({minutes}m {seconds}s)"
            },
            messages: {
                fileUploadSuccess: "File uploaded successfully",
                fileUploadError: "File upload failed",
                transcriptionStarted: "Transcription started - check detailed status below",
                transcriptionError: "Failed to start transcription",
                audioDeleted: "Audio file deleted",
                audioDeleteError: "Failed to delete audio file",
                resetProgress: "Resetting progress from step {startStep}...",
                resetSuccess: "Progress reset successfully",
                resetError: "Reset failed: {message}",
                noVideoId: "Error: No video_id found in round data",
                downloadingAudio: "Step 1-A: Downloading audio...",
                audioDownloadFailed: "Audio download failed",
                downloadedAudio: "Step 1-A: Downloaded (${video_id})",
                backgroundAudioDownloadRegistered: "Step 1-A: Background audio download registered. Waiting for completion...",
                checkingTranscriptionStatus: "Step 1-B: Checking transcription status...",
                backgroundTranscriptionStartFailed: "Background transcription start failed",
                backgroundTranscriptionInProgress: "Step 1-B: Background transcription in progress. Please wait for completion.",
                retrievingResult: "Step 1-B: Retrieving result...",
                failedGetTranscriptionResult: "Failed to get transcription result",
                transcriptionCompleted: "Step 1-B: Completed",
                transcribing: "Step 1-B: Transcribing...",
                transcriptionFailed: "Transcription failed",
                extractingWords: "Step 1-C: Extracting words...",
                wordExtractionFailed: "Word extraction failed",
                wordExtractionCompleted: "Step 1-C: Completed",
                groupingSentences: "Step 1-D: Grouping sentences...",
                sentenceGroupingFailed: "Sentence generation failed",
                sentenceGroupingCompleted: "Step 1-D: ${count} sentences",
                step1Complete: "Step 1 All Complete!",
                resultSavedToDb: "Step 1-B: Result saved to DB",
                diarizationComplete: "Diarization Complete!",
                autoAduGenerationFailed: "Auto ADU Generation failed",
                aduGenerationComplete: "ADU Generation Complete!",
                autoRebuttalGenerationFailed: "Auto Rebuttal Generation failed",
                rebuttalGenerationComplete: "Rebuttal Generation Complete!",
                allStepsCompleted: "All Steps Completed Successfully!",
            }
        }
    }
};

export type LocaleType = typeof en;
