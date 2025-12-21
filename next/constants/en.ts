
export const en = {
    header: {
        title: "DebaTube Live",
        explore: "Explore",
        dashboard: "Dashboard",
        record: "Record",
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
    unifiedPlayer: {
        noAudio: "No audio files",
        play: "Play",
        pause: "Pause",
        prop: "Prop",
        opp: "Opp",
    },
    recordPage: {
        tabs: {
            audio: "Audio",
            visualization: "Visualization",
        },
        controls: {
            format: "Format",
            roundId: "Round ID",
            enterRoundId: "Enter Round ID...",
            searchRoundId: "Search Round ID...",
            generateGraph: "GENERATE GRAPH",
            processing: "PROCESSING...",
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
        registerNewRound: "Register New Round",
        stats: {
            totalRounds: "Total Rounds",
            totalPois: "Total POIs",
            totalRebuttals: "Total Rebuttals",
            argumentUnits: "Argument Units"
        },
        table: {
            title: "All Rounds",
            error: "Error loading rounds",
            noRounds: "No rounds found",
            headers: {
                title: "Title",
                motion: "Motion",
                pois: "POIs",
                rebuttals: "Rebuttals",
                speeches: "Speeches",
                arguments: "Arguments",
                tag: "Tag"
            }
        },
        modal: {
            title: "Register new round",
            labels: {
                title: "Title",
                youtubeUrl: "YouTube URL",
                audioFile: "Audio File",
                selectFile: "Click to select file",
                delete: "Delete"
            },
            placeholders: {
                title: "Enter title...",
                youtubeUrl: "https://www.youtube.com/watch?v=..."
            },
            buttons: {
                cancel: "Cancel",
                register: "Register",
                processing: "Processing..."
            },
            messages: {
                selectUrlOrFile: "Please select a YouTube URL or audio file",
                success: "Registration completed!",
                error: "An error occurred",
                failedCreate: "Failed to create round",
                failedProcess: "Failed to process audio",
                idNotFound: "Round ID not found in response"
            }
        }
    }
};

export type LocaleType = typeof en;
