# Next.js Application Specifications

## Tech Stack
- **Framework**: Next.js 14.1.0
- **React**: 18
- **UI Framework**: Tailwind CSS 3.3.0
- **State Management**: Jotai 2.10.1
- **Visualization**: ReactFlow (@xyflow/react 12.3.0), D3.js 7.8.5
- **Components**: Radix UI (Slot, Tabs), Lucide React icons
- **TypeScript**: 22.5.5

## Page Structure

### 1. Home Page (`/`)
- **File**: `app/page.tsx`
- **Function**: YouTube graph display
- **Component**: `YoutubeGraph2`
- **Description**: Main landing page displaying YouTube video recommendation graph

### 2. Debate Detail Page (`/graph/[id]`)
- **File**: `app/graph/[id]/page.tsx`
- **Function**: Display detailed debate structure based on specific round ID
- **Component**: `DetailedStructure`
- **Dynamic Routing**: Identify target round from URL ID parameter
- **Function Details**: 
  - Extract round ID from URL
  - Display detailed debate flow graph

### 3. Audio Analysis Page (`/diarization`)
- **File**: `app/diarization/page.tsx`
- **Function**: Audio analysis and timeline display
- **Component**: `Timeline`
- **Description**: Speaker diarization and chronological display of audio data

### 4. Rebuttal Annotation Page (`/annotate-rebuttals`)
- **File**: `app/annotate-rebuttals/page.jsx`
- **Function**: Create debate rebuttal annotations
- **Main Components**:
  - `EditorPanel`: Markdown editor
  - `PreviewPanel`: Preview display
- **Function Details**:
  - Role-based editing for Government side (PM, DPM, GW, PMR) and Opposition side (LO, DLO, OW, LOR)
  - Real-time Markdown preview
  - Inter-cell highlighting function
  - Color-coded display (Government: red, Opposition: blue)

### 5. Data Registration Page (`/registration`)
- **File**: `app/registration/page.jsx`
- **Function**: Register debate data
- **API Integration**: Connection with FastAPI backend
- **Function Details**:
  - Motion (topic) input
  - Tag (classification) input
  - YouTube URL input (automatic Video ID extraction)
  - JSON file (speech transcription data) upload
  - Automatic debate analysis by GPT
  - Save to database

## Main Component Categories

### DebateGraph Series
- **DebateFlow.jsx**: Basic debate flow
- **DebateFlowMacro.jsx**: Macro-level debate structure
- **CustomNode.js / CustomNodeEditable.js**: Custom nodes
- **GovNode.js / OppNode.js**: Government/Opposition side nodes
- **MacroGovNode.js / MacroOppNode.js**: Macro-level nodes

### DetailedStructure Series
- **DetailedStructure.tsx**: Detailed structure display
- **CustomDetailedGraphComponents.tsx**: Detailed graph components

### Diarization Series
- **Timeline.tsx**: Main timeline
- **NodeAsr.tsx / NodeDiarization.tsx**: Speech recognition/speaker diarization nodes
- **SidebarTimeline.tsx**: Sidebar timeline
- **MenuDiarization.tsx**: Diarization menu

### MacroStructure Series
- **MacroStructure.tsx**: Macro structure display
- **MacroStructureWithExport.tsx**: Macro structure with export function
- **ModelDebate.ts**: Debate model definition

### VideoRecommendation Series
- **YoutubeGraph.tsx / YoutubeGraph2.tsx**: YouTube video recommendation graph

### Utils Series
- **foundation.ts**: Foundation settings (API Root etc.)
- **DiarizationColors.ts**: Speaker diarization color management
- **nodeIdToNumber.ts**: Node ID conversion
- **speechIdToPositionName.ts**: Speech ID to position name conversion

## State Management
- **Jotai**: User state management in `components/store/userAtom.ts`

## UI Components
- **Shadcn/ui**: Under `components/ui/`
  - `button.tsx`: Custom button
  - `tabs.tsx`: Tab component

## Distinctive Features
1. **ReactFlow Integration**: Visualization of debate structure
2. **Dynamic Routing**: Debate round-specific detail display
3. **Real-time Editing**: Synchronization of Markdown editor and preview
4. **Audio Analysis**: Speaker diarization and timeline display
5. **YouTube Integration**: Video metadata acquisition via API
6. **Image Export**: Chart export using html-to-image
7. **File Upload**: JSON format speech transcription data processing