# CrisisNet 🆘
## Overview
CrisisNet is an **offline-first communication platform** designed to bridge the gap between everyday connectivity and emergency intelligence. It uses a **decentralized mesh network** (BLE/WiFi Direct) to allow smartphones to communicate without internet or cell towers.

The core philosophy is the "Everyday Flywheel": users install the app for daily offline chat in low-signal areas (metros, rural zones), which builds a passive infrastructure of relay nodes that becomes a life-saving intelligent network during disasters.

## Tech Stack
| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React Native (v0.85.2) | Cross-platform native performance |
| **Mesh Networking** | `@offline-protocol/mesh-sdk` | BLE-first decentralized mesh networking |
| **On-Device AI** | `llama.rn` (llama.cpp) | Local LLM inference engine |
| **AI Model** | **Gemma 4 E2B** | Small footprint, high intelligence for offline use |
| **Database** | SQLite (`react-native-sqlite-storage`) | Robust offline persistence |
| **AI Fine-Tuning** | Unsloth + PyTorch | Fast, memory-efficient survival training |

## Features Built So Far
- **Offline Mesh Transport:** Discovery, relay, and multi-hop messaging between devices without internet.
- **Local AI Inference:** Fully offline survival guidance and general assistance powered by Gemma.
- **Medical Triage System:** Automated form-based classification (RED/YELLOW/GREEN/BLACK) with AI-assisted logic.
- **Dual Mode UI:** Seamless switching between "Everyday" (Community) and "Emergency" (SOS) contexts.
- **SOS Broadcast:** One-tap emergency packet broadcasting across the entire discovered mesh.
- **Verification Pipeline:** Custom scripts for APK integrity and bundle verification to ensure field reliability.

## Folder Structure
```text
CrisisNet/
├── android/               # Native Android build files & Gradle config
├── ios/                   # Native iOS project files
├── src/
│   ├── ai/                # Gemma loading, llamaService, and triage logic
│   ├── mesh/              # meshService (SDK wrapper), Bluetooth, and Relays
│   ├── storage/           # SQLite schema and data access layers
│   ├── screens/           # UI Screens (Home, Chat, Triage, AskAI, etc.)
│   ├── components/        # Message bubbles, MeshStatus, TriageTags
│   ├── context/           # MeshContext, AIContext for global state
│   └── utils/             # Permissions, model storage, system coordinator
├── fine-tuning/           # Python pipeline for training survival models
├── scripts/               # APK verification and CI utilities
└── models/                # Local GGUF model storage (pushed via adb)
```

## API & Service Interfaces
As a decentralized mesh app, there are no traditional REST endpoints. Instead, the architecture relies on local service providers:

| Service | Method | Purpose |
|---|---|---|
| `meshService` | `sendMessage(payload)` | Broadcasts or unicasts data to the mesh network. |
| `meshService` | `on('message_received')` | Global event listener for incoming mesh packets. |
| `llamaService`| `ask(prompt)` | Asynchronous call for local LLM inference. |
| `sqlite`      | `initDB()` | Initializes local persistence for messages and triage data. |

## Database Schema
### `messages` Table
```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender TEXT,
  text TEXT,
  timestamp INTEGER,
  type TEXT,
  color TEXT,
  triage TEXT
)
```

### `triage` Table
```sql
CREATE TABLE IF NOT EXISTS triage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  breathing INTEGER,
  severe_bleeding INTEGER,
  conscious INTEGER,
  can_move INTEGER,
  description TEXT,
  tag TEXT,
  reason TEXT,
  timestamp INTEGER
)
```

## Environment Variables
Environment variables are managed via `react-native-dotenv`.
| Variable | Purpose |
|---|---|
| `HF_TOKEN` | Required for accessing/downloading Gemma models from HuggingFace. |

## Setup & Installation
1.  **System Prerequisites:**
    - Node.js v22+
    - JDK 17 (**Note:** Higher versions like JDK 21+ break the current Gradle 8.13 build).
    - Android Studio + SDK Platform 34.
2.  **Clone & Install:**
    ```bash
    git clone <repo-url>
    cd CrisisNet
    npm install
    ```
3.  **Model Setup:**
    - Download `gemma-4-E2B-it-Q4_K_M.gguf`.
    - Push to device: `./push_model.sh` (or manually move to `/sdcard/Download/CrisisNet/`).
4.  **Run:**
    ```bash
    npx react-native run-android
    ```

## Roadmap
- [ ] **Phase 1 (MVP):** Finalize SDK integration and multi-hop stability.
- [ ] **Phase 2 (Localization):** Multilingual support (Hindi, Tamil, Arabic, Spanish).
- [ ] **Phase 3 (Robustness):** WiFi Direct fallback for higher bandwidth (file sharing).
- [ ] **Phase 4 (Intelligence):** Multimodal injury assessment (Photo-based triage via Gemma).

## Known Issues
- **Gradle Conflict:** Building with JDK versions higher than 17 causes immediate failure.
- **BLE Discovery Lag:** Initial peer discovery can take up to 30 seconds depending on device environment.
- **RAM Constraints:** Loading the Gemma model requires ~1.2GB of free RAM; background apps should be closed on mid-range devices.

## Design Decisions & Notes
- **Decentralized Identity:** Device IDs are generated locally and persisted to ensure identity survives app restarts without a central registry.
- **Model Decoupling:** To keep APK sizes manageable for sideloading in disaster zones, the LLM model is stored in the device's shared storage rather than bundled as an asset.
- **Fan-out Broadcast:** Since the underlying SDK is recipient-based, `meshService` implements a fan-out pattern to all known neighbors to simulate a network broadcast.

---
*Generated by Gemini CLI Documentation Expert*
