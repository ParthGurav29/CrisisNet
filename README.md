# CrisisNet 🆘
### Offline Communication Platform with Built-In Emergency Intelligence
> *Built for everyday. Ready for anything.*

**Works Without Internet** | **Runs On Your Phone** | **Powered by Gemma 4** | **Built for Everyone**

---

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Two Modes, One Platform](#two-modes-one-platform)
- [How It Works](#how-it-works)
- [Core Features](#core-features)
- [Why Everyday Use Matters](#why-everyday-use-matters)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Fine-Tuning Pipeline](#fine-tuning-pipeline)
- [Emergency Packet Structure](#emergency-packet-structure)
- [MVP Scope](#mvp-scope)
- [Roadmap](#roadmap)
- [Hackathon Tracks](#hackathon-tracks)
- [Contributing](#contributing)
- [License](#license)

---

## The Problem

### The Emergency Problem
When a disaster hits — earthquake, flood, cyclone, building collapse — the first thing that fails is the internet. Cell towers get overloaded or destroyed. Emergency services are overwhelmed. People are isolated, injured, and panicking.

Yet every person in that disaster zone is holding a powerful computer in their hand — their smartphone — sitting completely useless without a signal.

### The Bigger Problem Nobody Talks About
Disasters are not the only time internet fails.

```
Rural villages         →   No towers. No signal. Ever.
Underground metro      →   Zero connectivity daily
Remote schools         →   Students with no internet access
Farming communities    →   Isolated, no network infrastructure
Refugee camps          →   No communication infrastructure
Mountain treks         →   Cut off the moment you leave the city
Concert crowds         →   Towers overloaded. Nothing works.
Developing regions     →   Entire areas with no infrastructure
```

**4.2 billion people still lack reliable internet access.**
**Most emergency apps fail because nobody installs them before a disaster.**
**Most disaster deaths occur within the first 72 hours.**

The tools to prevent this already exist in people's pockets.
They just need to talk to each other.

---

## The Solution

CrisisNet is not just an emergency app.

**CrisisNet is an offline-first communication platform that people use every day — and that becomes an intelligent emergency network the moment disaster strikes.**

```
Everyday use    →   People install it for daily offline communication
                →   Mesh network grows passively across communities
                →   More devices = stronger, wider network

Emergency hits  →   Network already exists across thousands of phones
                →   People already know how to use the app
                →   Gemma 4 activates emergency intelligence
                →   Triage, survival guidance, coordination — instantly
```

Three layers work together at all times:

```
LAYER 1 — MESH COMMUNICATION (via Offline Protocol SDK)
Phones talk to each other over BLE and WiFi Direct.
No towers. No internet. Just proximity.
Every device becomes a relay node.
The more people — the stronger and wider the network.

LAYER 2 — ON-DEVICE AI (Gemma 4 E2B)
Fine-tuned Gemma runs entirely on your device.
Everyday: smart offline assistant.
Emergency: life-critical survival guidance.
Short. Directive. Accurate. Offline. Always.

LAYER 3 — COORDINATION
Everyday: community notices, group chats, file sharing.
Emergency: triage tags, rescuer matching, hazard reporting.
Data flows across the mesh automatically.
```

---

## Two Modes, One Platform

### Everyday Mode
```
What it does:
├── Offline group chat between nearby devices
├── Community notice board over mesh
├── File and photo sharing without internet
├── Low bandwidth voice notes
├── Works in metro, basement, rural areas, events
└── AI assistant for general offline queries

Who uses it daily:
├── Students in rural schools sharing notes
├── Farmers coordinating in low-signal areas
├── Commuters in underground metro
├── Trekkers and mountaineering groups
├── Event attendees when towers are overloaded
└── Communities in developing regions
```

### Emergency Mode
```
What activates it:
├── Manual "Emergency Mode" button
└── Auto-detection of emergency keywords in messages

What it adds:
├── Survival AI — fine-tuned Gemma guidance
├── Triage system — RED / YELLOW / GREEN classification
├── SOS broadcast across entire mesh
├── Rescuer to Survivor matching
├── Hazard reporting and mapping
└── Authority broadcast messages
```

---

## How It Works

### The Mesh

```
[Phone A]  ←→  [Phone B]  ←→  [Phone C]  ←→  [Phone D]
 survivor        relay          rescuer         medic

Built on Offline Protocol SDK:
├── BLE discovery and connection
├── WiFi Direct fallback for longer range
├── Automatic message relay and hopping
├── Delivery retries built in
└── Identity layer per device

Bluetooth range per hop: 10 to 30 meters
10 devices spread 20m apart = 200m total coverage
50 devices = nearly half a kilometer

No central server. No single point of failure.
If one node drops — mesh reroutes automatically.
More everyday users = stronger emergency network.
```

### The AI — Everyday Mode

```
User asks anything offline:
"What are symptoms of dehydration?"
"How do I purify water from a stream?"
"Best route during flooding?"

Gemma responds from on-device knowledge.
No internet needed. No API call. Instant.
```

### The AI — Emergency Mode

```
User types:
"Someone near me stopped breathing"

Fine-tuned Gemma responds instantly, on device:

CARDIAC ARREST — ACT NOW:
1. Call out for help loudly
2. Tilt head back, lift chin
3. Give 2 rescue breaths
4. Start 30 chest compressions — hard and fast
5. Repeat until help arrives
Do NOT stop until a medic takes over.
```

### The Triage System

```
Helper fills quick triage form:
→ Is the person breathing?
→ Is there severe bleeding?
→ Are they conscious?
→ Can they move?

Gemma classifies instantly:
RED    — Immediate. Life threatening. Medic needed NOW.
YELLOW — Urgent. Stable for now. Within 30 minutes.
GREEN  — Walking wounded. Can wait.
BLACK  — Beyond help. Focus resources elsewhere.

Tag broadcasts across entire mesh.
Medics see a live sorted priority list.
No more guessing. No more running blind.
```

---

## Core Features

### MVP Features (Current Build)
- **Offline Mesh Communication** — Device discovery, relay, and messaging via Offline Protocol SDK
- **Everyday Offline Chat** — Group messaging without internet across nearby devices
- **On-Device Survival AI** — Gemma E2B answering questions fully offline
- **Emergency Mode** — One tap activates triage, SOS, and survival guidance
- **Triage Classification** — RED / YELLOW / GREEN tagging via fine-tuned Gemma
- **Emergency Packet Broadcasting** — Structured SOS data hopping across mesh
- **Offline First Architecture** — Zero cloud dependency. Zero internet. Ever.

### Planned Features (Iterative)
- **Fine-Tuned Survival Model** — Gemma trained on WHO, Red Cross, FEMA verified protocols
- **Photo-Based Triage** — Photograph injury, Gemma assesses visually via multimodal
- **GPS Location Sharing** — Coordinates broadcast across mesh, building a live map
- **Community Notice Board** — Post and receive local announcements offline
- **File and Photo Sharing** — Share documents and images over mesh
- **Multilingual Support** — Hindi, Tamil, Arabic, Spanish, and more
- **Resource Reporting** — Mark water, shelter, road blocks on mesh map
- **Authority Broadcasts** — Push alerts across entire mesh from command center
- **Voice Notes** — Low bandwidth audio messages over mesh
- **Situation Reports** — Gemma auto-summarizes mesh data for incident commanders
- **Pre-Disaster Mode** — Community preparedness, offline map downloads, mesh testing

---

## Why Everyday Use Matters

This is the core insight that makes CrisisNet different from every other emergency app.

```
The Problem with Emergency-Only Apps:
→ Nobody installs an app they hope to never use
→ When disaster hits — app is not on most phones
→ Mesh has zero nodes — useless when needed most

CrisisNet's Flywheel:
→ People install for daily offline communication
→ Every install = one more mesh node
→ Community uses it for chats, notices, coordination
→ Mesh grows organically without any emergency
→ Disaster hits — network of thousands already exists
→ Emergency mode activates across a ready infrastructure
```

### Real World Example

```
Mumbai local train — underground, zero signal, 500 passengers
→ People use CrisisNet daily for offline chat during commute
→ Train derails underground
→ Emergency mode activates instantly
→ Mesh already formed across 500 phones
→ Triage data flows. Rescuers guided in.
→ Lives saved by a network that already existed
   because people used it to chat every morning.
```

**The everyday use case builds the emergency infrastructure automatically.**

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CrisisNet App                         │
│                                                              │
│  ┌──────────────┐   ┌───────────────┐   ┌────────────────┐  │
│  │   UI Layer   │   │   AI Layer    │   │  Mesh Layer    │  │
│  │(React Native)│   │ (Gemma E2B)   │   │(Offline Proto) │  │
│  └──────┬───────┘   └──────┬────────┘   └───────┬────────┘  │
│         │                  │                     │           │
│  ┌──────▼──────────────────▼─────────────────────▼───────┐  │
│  │                 Storage Layer (SQLite)                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

No network calls. No APIs. No cloud. Ever.
```

### AI Layer Detail
```
User Input (text or photo)
        ↓
Mode Detection (Everyday vs Emergency)
        ↓
Appropriate Prompt Template
        ↓
Fine-tuned Gemma E2B (on device, offline)
        ↓
Structured Response
        ↓
Displayed to user + optionally broadcast across mesh
```

### Mesh Layer Detail
```
App Launch
    ↓
Offline Protocol SDK initializes
    ↓
BLE + WiFi Direct scan → Discover nearby CrisisNet nodes
    ↓
Handshake → Establish mesh connection
    ↓
Structured packet sent → Relay hop → Relay hop → Destination
    ↓
Delivery confirmation returned
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React Native | Native Android, works with Offline Protocol SDK |
| Mesh Networking | Offline Protocol SDK | BLE + WiFi Direct mesh, proven and tested |
| On-Device AI | WebLLM / llama.cpp | Runs Gemma E2B locally, fully offline |
| AI Model | Gemma 4 E2B | Smallest Gemma, runs on mid-range Android phones |
| Fine-Tuning | Unsloth + Google Colab | Fast, memory-efficient fine-tuning on free GPU |
| Local Storage | SQLite | Offline message, triage, and chat storage |
| Navigation | React Navigation | Screen routing for React Native |

---

## Project Structure

```
CrisisNet/
│
├── android/                        → Android native build files
│
├── assets/
│   └── models/                     → Gemma E2B model files (on device)
│
├── src/
│   │
│   ├── ai/                         → Everything Gemma related
│   │   ├── gemma.js                → Model loading and inference
│   │   ├── prompts.js              → Everyday and emergency prompt templates
│   │   ├── triage.js              → Triage classification logic
│   │   └── modeDetector.js        → Detects everyday vs emergency context
│   │
│   ├── mesh/                       → Everything networking related
│   │   ├── offlineProtocol.js      → Offline Protocol SDK integration
│   │   ├── packets.js             → Emergency packet structure and parsing
│   │   └── relay.js               → Mesh message routing logic
│   │
│   ├── storage/                    → Offline data layer
│   │   ├── db.js                  → SQLite setup
│   │   ├── messages.js            → Chat message storage
│   │   ├── triage.js              → Triage records storage
│   │   └── notices.js             → Community notice board storage
│   │
│   ├── screens/                    → All UI screens
│   │   ├── Home.jsx               → Mesh status + mode switcher dashboard
│   │   ├── Chat.jsx               → Everyday offline group chat
│   │   ├── AskAI.jsx              → AI assistant screen
│   │   ├── Triage.jsx             → Emergency triage input and results
│   │   ├── Messages.jsx           → Mesh emergency message feed
│   │   ├── NoticeBoard.jsx        → Community offline notice board
│   │   └── Onboarding.jsx         → First launch and language selection
│   │
│   ├── components/                 → Reusable UI components
│   │   ├── MeshStatus.jsx         → Connected nodes indicator
│   │   ├── ModeToggle.jsx         → Everyday / Emergency mode switch
│   │   ├── TriageTag.jsx          → RED / YELLOW / GREEN badge
│   │   ├── MessageBubble.jsx      → Chat message display
│   │   └── AIResponse.jsx         → Formatted Gemma response card
│   │
│   ├── context/                    → Global app state
│   │   ├── MeshContext.jsx        → Mesh connection state across app
│   │   ├── AIContext.jsx          → AI model state across app
│   │   └── ModeContext.jsx        → Current app mode state
│   │
│   ├── hooks/                      → Custom React Native hooks
│   │   ├── useMesh.js             → Offline Protocol mesh operations
│   │   ├── useGemma.js            → AI inference hook
│   │   ├── useTriage.js           → Triage logic hook
│   │   └── useMode.js             → Mode detection and switching
│   │
│   ├── utils/
│   │   ├── language.js            → Multilingual utilities
│   │   └── format.js              → AI response formatting
│   │
│   ├── App.jsx                    → Root component and navigation
│   └── index.js                   → Entry point
│
├── fine-tuning/                    → Survival model fine-tuning pipeline
│   ├── dataset/
│   │   ├── medical.json           → First aid and medical emergencies
│   │   ├── disaster.json          → Earthquake, flood, fire protocols
│   │   └── survival.json          → Water, shelter, signaling
│   ├── train.py                   → Unsloth fine-tuning script
│   ├── export.py                  → Export to GGUF for on-device use
│   └── README.md                  → Fine-tuning instructions
│
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

```
Node.js v18 or higher
React Native CLI
Android Studio
Java Development Kit JDK 17
An Android device for testing
A second Android device for mesh testing
Google Colab account for fine-tuning
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/CrisisNet.git
cd CrisisNet

# Install dependencies
npm install

# Install Offline Protocol SDK
npm install @offline-protocol/mesh-sdk

# Link native modules
npx react-native link

# Run on Android device
npx react-native run-android
```

### Android Setup

```
1. Open Android Studio
2. Enable Developer Mode on your Android phone
   Settings → About Phone → Tap Build Number 7 times
3. Enable USB Debugging
   Settings → Developer Options → USB Debugging ON
4. Connect phone via USB
5. Run: npx react-native run-android
```

### Testing The Mesh

```
1. Install CrisisNet on Device A and Device B
2. Open app on both devices
3. Both show "Searching for nodes..."
4. Within 30 seconds both show "1 node connected"
5. Send a chat message from Device A
6. Confirm it appears on Device B without internet
7. Switch one device to Emergency Mode
8. Send a triage report and confirm it arrives on Device B
```

---

## Fine-Tuning Pipeline

The emergency AI is fine-tuned on verified protocols from WHO, Red Cross, FEMA, and peer-reviewed first aid literature. Responses are trained to be short, numbered, directive, and jargon-free.

### Dataset Format

```json
{
  "input": "What do I do if someone is choking?",
  "output": "CHOKING — ACT NOW:\n1. Ask: can you speak? If not — act immediately.\n2. Lean them forward, give 5 firm back blows.\n3. Give 5 abdominal thrusts — Heimlich maneuver.\n4. Alternate back blows and thrusts until clear.\n5. If unconscious — begin CPR.\nCall emergency services immediately."
}
```

### Running Fine-Tuning

```bash
# Open Google Colab with free T4 GPU
# Upload fine-tuning/train.py and dataset/

# Or run locally with GPU
cd fine-tuning
pip install unsloth
python train.py
```

### Deploying To Device

```bash
# Export quantized model for on-device use
python export.py --format gguf --quantize 4bit

# Move to assets folder
cp survival-gemma-e2b.gguf ../assets/models/
```

---

## Emergency Packet Structure

Every emergency message broadcast across the mesh follows this structure:

```json
{
  "type": "SOS | TRIAGE | HAZARD | RESOURCE | BROADCAST",
  "sender_id": "device-uuid",
  "timestamp": "unix-timestamp",
  "location": {
    "lat": 19.0760,
    "lng": 72.8777
  },
  "payload": {
    "triage_tag": "RED | YELLOW | GREEN | BLACK",
    "description": "chest pain, unconscious, not breathing",
    "ai_response": "Step 1: Begin CPR immediately...",
    "hazard_type": "blocked road | gas leak | fire | flood",
    "resource_type": "water | shelter | medical supplies"
  }
}
```

---

## MVP Scope

The minimum viable product demonstrates the complete core loop across both modes:

```
Everyday Mode:
✅ Offline mesh chat between 2 to 3 devices
✅ Messages hopping without internet
✅ Mesh status showing live node count

Emergency Mode:
✅ One-tap switch to Emergency Mode
✅ Gemma E2B answering survival questions offline
✅ Triage classification — RED / YELLOW / GREEN
✅ Emergency packet broadcast across mesh
✅ Full scenario working end to end
```

---

## Roadmap

### Phase 1 — MVP (Current)
- [x] Project structure and README
- [ ] React Native + Offline Protocol SDK setup
- [ ] Mesh working between 2 phones
- [ ] Gemma E2B loaded on device
- [ ] Everyday offline chat working
- [ ] Emergency mode with survival AI
- [ ] Triage classification end to end

### Phase 2 — AI Depth
- [ ] Full fine-tuned survival model via Unsloth
- [ ] Verified protocols from WHO, Red Cross, FEMA
- [ ] 4-bit quantized model for faster inference
- [ ] Multilingual — Hindi, Tamil, Arabic, Spanish

### Phase 3 — Mesh Robustness
- [ ] 10 plus device mesh support
- [ ] Dynamic rerouting on node drop
- [ ] Message delivery confirmation
- [ ] Mesh signal strength indicator per node

### Phase 4 — Everyday Features
- [ ] Community notice board
- [ ] File and photo sharing over mesh
- [ ] Low bandwidth voice notes
- [ ] Offline event coordination tools

### Phase 5 — Emergency Intelligence
- [ ] Photo-based injury triage via Gemma multimodal
- [ ] GPS location sharing and live survivor map
- [ ] Resource reporting — water, shelter, hazards
- [ ] Authority broadcast message system
- [ ] Auto situation report generation

### Phase 6 — Scale
- [ ] Pre-disaster community preparedness mode
- [ ] Offline city map download
- [ ] iOS support
- [ ] Wearable device support

---

## Hackathon Tracks

CrisisNet is submitted to the **Gemma 4 Good Hackathon** by Google DeepMind.

| Track | Prize | Why We Qualify |
|---|---|---|
| Main Track | $50,000 | Best overall — everyday + emergency platform |
| Global Resilience | $10,000 | Offline disaster response at scale |
| Health & Sciences | $10,000 | On-device medical triage AI |
| Digital Equity & Inclusivity | $10,000 | Works without internet, multilingual |
| LiteRT Special Prize | $10,000 | Gemma E2B deployed on-device |
| Unsloth Special Prize | $10,000 | Fine-tuned survival model |

**Total potential → $100,000**

---

## The Vision

> *A world where every phone is a lifeline — with or without the internet.*

The internet has connected billions of people.
But 4.2 billion still don't have reliable access.
And even the connected ones lose it the moment they need it most.

CrisisNet starts where the internet ends.

It gives communities a way to talk, share, and coordinate every day — and becomes an intelligent emergency network the moment everything else fails.

**Built for everyday. Ready for anything.**

---

## Contributing

Contributions are welcome. Please open an issue first.

Priority areas:
- Survival dataset curation and medical verification
- React Native BLE and mesh optimization
- Multilingual translations and localization
- UI/UX improvements for low-literacy users
- Testing across diverse Android devices and versions

---

## License

MIT License — free to use, build on, and distribute.

---

## Acknowledgements

- Google DeepMind — Gemma 4 open model family
- Offline Protocol — Mesh networking SDK
- WHO, Red Cross, FEMA — Verified survival and emergency protocols
- Unsloth — Efficient fine-tuning framework

---

*Built for the Gemma 4 Good Hackathon 2026*
*Tracks: Global Resilience · Health & Sciences · Digital Equity*
*"Built for everyday. Ready for anything."*