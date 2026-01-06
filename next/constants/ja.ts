
import { LocaleType } from './en';

export const ja: LocaleType = {
    header: {
        title: "DebaTube Live",
        explore: "試合をさがす",
        dashboard: "試合リストをみる",
        dashboardVideo: "試合動画リスト",
        dashboardRecord: "録音データ",
        record: "試合を録音する",
    },
    nav: {
        explore: "探す",
        dashboard: "ダッシュボード",
        record: "記録",
        login: "ログイン",
    },
    timer: {
        overTime: "時間超過中",
        recording: "録音中",
    },
    recordingCard: {
        recordings: "録音",
        play: "再生",
        pause: "一時停止",
        stop: "停止",
        download: "ダウンロード",
        noRecording: "録音なし",
        proposition: "肯定側",
        opposition: "否定側",
    },
    explore: {
        tabs: {
            all: "すべて",
            criminalJustice: "刑事司法",
            gender: "ジェンダー",
            economy: "経済",
            politics: "政治",
        },
        sort: {
            date: "日付順",
            distance: "距離",
            interval: "間隔",
            order: "順序",
            rally: "ラリー",
            dateDesc: "YouTubeまたはDebaTubeにアップロードされた日時",
            distanceDesc: "議論クラスター間の空間的距離",
            intervalDesc: "スピーチセグメント間の時間的間隔",
            orderDesc: "ディベートの流れにおける順序的位置",
            rallyDesc: "やり取りの頻度",
            largestFirst: "降順",
            smallestFirst: "昇順",
        },
        pinned: "{count} 件ピン留め",
    },
    unifiedPlayer: {
        noAudio: "音声ファイルがありません",
        play: "再生",
        pause: "一時停止",
        prop: "肯定側",
        opp: "否定側",
    },
    recordPage: {
        tabs: {
            dashboard: "ダッシュボード",
            audio: "音声",
            visualization: "可視化",
        },
        controls: {
            format: "フォーマット",
            roundId: "試合ID",
            enterRoundId: "試合IDを入力...",
            searchRoundId: "試合IDを検索...",
            motion: "論題",
            motionPlaceholder: "論題を入力...",
            generationTabs: {
                auto: "自動生成",
                manual: "マニュアル"
            },
            generateGraph: "グラフ作成",
            generateAuto: "LLMでグラフを生成",
            generateManual: "文字起こし",
            processing: "処理中...",
            processingWithTime: "処理中... ({seconds}秒)",
        },
        advancedOptions: {
            title: "詳細設定",
            show: "詳細設定を表示",
            hide: "詳細設定を隠す",
            processAllAtOnce: "全スピーチでのADUセグメンテーションを1つのプロンプトで一括して行う",
            useLatestTranscription: "同じRound IDの文字起こしデータが既に存在する場合はそれを使用する（再文字起こしをスキップ）",
            aduModel: "ADUセグメンテーションモデル",
            rebuttalModel: "反論判定モデル",
            transcriptionModel: "文字起こしモデル",
        },
        status: {
            processing: "処理中: {seconds}秒",
            success: "グラフ生成完了! ({seconds}秒)",
            error: "エラー: {message}",
            transcribed: "- 文字起こし: {files} ファイル",
            adus: "- ADU数: {total}",
            rebuttalPairs: "- 反論ペア数: {total}",
            savedTo: "保存先: {path}",
        },
        messages: {
            enterRoundId: "試合IDを入力してください",
            allAudioRequired: "全ての音声ファイルが必要です",
            invalidTryCount: 'バージョン番号が無効です。次の有効なバージョン番号は {next} です。番号を飛ばすことはできません。',
            matchNotFound: '指定された試合では、v{count} のデータは存在しません。',
            matchNotFoundReverting: '指定された試合データは存在しません。有効な値 {next} に戻します。',
            confirmGenerate: "グラフを生成しますか？\n\nこれには数分かかる場合があります。",
            invalidJson: "無効なJSON形式です。「speeches」と「rebuttals」が含まれているか確認してください。",
            failedJson: "JSONの解析に失敗しました: {error}",
            micDenied: "マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。",
            failedSave: "録音の保存に失敗しました。もう一度お試しください。",
            noGraphData: "グラフデータがありません。ホームタブで生成してください。",
        },
        toggles: {
            poiColor: "POIカラー",
            nodeId: "ノードID",
        },
        formatOptions: {
            na: "NA (6スピーチ)",
            asian: "ASIAN (8スピーチ)",
            bp: "BP (8スピーチ)",
            openingHalfBp: "Opening Half BP (4スピーチ)",
        },
        speechNames: {
            Proposition_1st: "肯定側1人目",
            Opposition_1st: "否定側1人目",
            Proposition_2nd: "肯定側2人目",
            Opposition_2nd: "否定側2人目",
            Proposition_3rd: "肯定側3人目",
            Opposition_3rd: "否定側3人目",
            Proposition_4th: "肯定側4人目",
            Opposition_4th: "否定側4人目",
        },
        manualMode: {
            title: "マニュアルモード",
            initialButton: "試合データの新規作成 & 文字起こし開始 (マニュアル)",
            processingAudio: "音声処理中...",
            step1Title: "STEP 1: 文字起こし（新規試合データ作成～文字起こしの文単位の分割）",
            step2Title: "STEP 2: ADU セグメンテーション",
            step3Title: "STEP 3: 反論判定",
            tryCount: "バージョン番号: {count}",
            tryCountPlaceholder: "バージョン番号",
            promptLabel: "LLMへのプロンプト",
            pasteLabel: "JSON結果を貼り付け",
            placeholder: "GeminiからのJSON出力をここに貼り付けてください...",
            submit: "データを送信",
            completed: "マニュアルモードのグラフ作成完了！",
            copy: "コピー",
            copied: "コピー完了",
            invalidJson: "無効なJSON形式です",
            resume: "再開",
            resumeLabel: "バージョン (中断した処理を再開する場合入力)",
            versionLabel: "バージョン",
            resumeFailed: "指定されたバージョン番号での再開データが見つかりませんでした。",
            submitAdu: "ADUデータを送信",
            submitRebuttal: "反論データを送信",
        }
    },
    landingPage: {
        hero: {
            titlePart1: "LLMが可視化する",
            titlePart2: "パーラメンタリーディベート",
            description: "最新のLLM技術で競技ディベートの分析を変革します。議論の流れを可視化し、反論を分析し、かつてないほど深くディベート構造を理解しましょう。",
            getStarted: "はじめる",
            watchDemo: "デモを見る",
        },
        features: {
            titlePart1: "ディベート分析のための",
            titlePart2: "強力な機能",
            description: "最先端のAIプラットフォームが、競技ディベートの分析と可視化のための包括的なツールを提供します。",
            items: {
                llmAnalysis: {
                    title: "LLMによる分析",
                    desc: "高度なLLM技術が、ディベートの論点と反論を精密に分析します"
                },
                visualization: {
                    title: "リアルタイム可視化",
                    desc: "動的なフローチャートで、議論の構造と反論関係を瞬時に表示します"
                },
                structureMapping: {
                    title: "ディベート構造マッピング",
                    desc: "肯定側と否定側の立論位置を包括的にマッピングします"
                },
                endToEnd: {
                    title: "エンドツーエンド処理",
                    desc: "ディベートの録音から自動で文字起こしと反論判定を行います"
                }
            }
        },
        benefits: {
            titlePart1: "なぜ",
            titlePart2: "DebaTubeなのか？",
            description: "コーチ、学生、研究者向けに設計された包括的なプラットフォームで、ディベート分析の未来を体験してください。",
            items: {
                item1: "議論構造の即時可視化",
                item2: "AIによる反論検出",
                item3: "マルチフォーマット出力",
                item4: "リアルタイム共同編集",
                item5: "包括的なディベートアーカイブ",
                item6: "パフォーマンス分析"
            }
        },
        parliamentaryDebate: {
            titlePart1: "パーラメンタリーディベート",
            titlePart2: "とは？",
            description: "パーラメンタリーディベートは、チームが論題に対して賛成・反対の立場から主張を行い、批判的思考力と説得力のあるコミュニケーションスキルを養う動的なフォーマットです。",
            keyFeaturesTitle: "パーラメンタリーディベートの主な特徴",
            features: {
                govVsOpp: {
                    title: "肯定側 vs 否定側",
                    desc: "肯定側（Government）は論題を支持し、否定側（Opposition）はそれに挑戦するという、構造化された対立形式で議論します。"
                },
                strategicArgs: {
                    title: "戦略的な議論",
                    desc: "成功には、個々の議論の強さだけでなく、ディベート全体を通して議論がどのように相互作用し、衝突し、積み重なっていくかを理解することが求められます。"
                }
            },
            visualizationTitle: "なぜ可視化が重要なのか",
            visualizations: {
                complexStructure: {
                    title: "複雑な議論構造:",
                    desc: "パーラメンタリーディベートは、主張、根拠、反論が複雑に絡み合うため、頭の中だけで追うのは困難です。"
                },
                realTime: {
                    title: "リアルタイム分析:",
                    desc: "リアルタイムで議論の衝突とつながりを理解することで、ディベートのパフォーマンスとジャッジの精度が向上します。"
                },
                educational: {
                    title: "教育的価値:",
                    desc: "視覚的な表現は、学生が議論のパターンを学び、戦略的な機会を特定するのに役立ちます。"
                },
                postRound: {
                    title: "試合後の分析:",
                    desc: "包括的な視覚的サマリーにより、詳細なフィードバックとパフォーマンスの改善が可能になります。"
                }
            }
        },
        cta: {
            title: "パラダイムシフトを受け入れる準備はできましたか？",
            description: "何千ものディベーター、ジャッジ、研究者がDebaTubeを活用してパーラメンタリーディベートのスキルを向上させています。あなたも今すぐ参加しましょう。",
            button: "はじめる"
        },
        footer: {
            description: "AIによる可視化でディベートに革命を",
            privacy: "プライバシー",
            terms: "利用規約",
            support: "サポート",
            copyright: "© 2024 DebaTube. All rights reserved."
        }
    },
    dashboard: {
        title: "ダッシュボード",
        description: "全ディベート試合の概要と統計",
        registerNewRound: "新しい試合動画を登録",
        tabs: {
            youtube: "YouTube動画",
            record: "録音データ"
        },
        stats: {
            totalRounds: "総試合数",
            totalPois: "総POI数",
            totalRebuttals: "総反論数",
            argumentUnits: "ADU数"
        },
        table: {
            title: "全試合",
            error: "試合の読み込みエラー",
            noRounds: "試合が見つかりません",
            headers: {
                title: "タイトル",
                style: "形式",
                motion: "論題",
                pois: "POI",
                rebuttals: "反論",
                speeches: "スピーチ",
                arguments: "ADU",
                tag: "タグ"
            }
        },
        modal: {
            labels: {
                back: "ダッシュボードに戻る",
                registerNewRound: "試合動画を登録",
                youtubeUrl: "YouTube URL",
                style: "ディベートスタイル",
                motion: "論題 (Motion)",
                cancel: "キャンセル",
                register: "登録する"
            },
            placeholders: {
                youtubeUrl: "https://www.youtube.com/watch?v=...",
                motion: "This house believes that..."
            },
            messages: {
                urlRequired: "YouTubeのURLを入力してください",
                idNotFound: "ラウンドIDの取得に失敗しました",
                videoAlreadyRegistered: "この動画はすでに登録されています",
                failedCreate: "登録に失敗しました",
                success: "登録が完了しました",
                error: "エラーが発生しました",
                selectUrlOrFile: "ファイルを選択するかURLを入力してください"
            }
        }
    }
};
