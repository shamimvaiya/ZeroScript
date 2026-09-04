# Universal AI Software Agent

## প্রকল্পের মূল ধারণা

বর্তমান ZeroScript-এর সবচেয়ে শক্তিশালী ধারণা হলো: ব্যবহারকারী কোনো AI website-এ স্বাভাবিক ভাষায় কথা বলবেন, AI তার উত্তরে নির্দিষ্ট command লিখবে, browser extension সেই command ধরবে, এবং local bridge Roblox Studio-তে কাজটি সম্পন্ন করবে।

এই ধারণাকে বড় করে একটি **Universal AI-to-Software Control Platform** বানানো যায়। এর মাধ্যমে একই AI conversation থেকে শুধু Roblox Studio নয়, বরং Unity, Visual Studio, Visual Studio Code, Android Studio, Antigravity IDE এবং ভবিষ্যতে অন্য software-এও কাজ করানো যাবে।

সম্ভাব্য নাম:

- ZeroScript Universal
- ZeroPilot
- OpenStudio Agent
- AI Workspace Bridge
- Universal Creator Agent

এখানে নামটি পরে নির্ধারণ করা যাবে। গুরুত্বপূর্ণ হলো architecture এমন হওয়া, যাতে AI website, local model এবং target software একে অপরের সঙ্গে শক্তভাবে জোড়া না থাকে।

---

## ব্যবহারকারীর অভিজ্ঞতা কেমন হবে

ব্যবহারকারী প্রথমে একটি AI source নির্বাচন করবেন:

- ChatGPT
- DeepSeek
- Gemini
- Google AI Studio
- Claude বা অন্য browser-based AI
- Ollama-এর local model
- LM Studio-এর local model
- OpenAI-compatible যেকোনো local endpoint

তারপর একটি target software নির্বাচন করবেন:

- Roblox Studio
- Unity
- Visual Studio
- Visual Studio Code
- Android Studio
- Antigravity IDE
- Blender বা অন্য supported application

এরপর ব্যবহারকারী AI-কে বলবেন:

> Unity-তে একটি third-person controller তৈরি করো এবং প্রয়োজনীয় C# script project-এ বসিয়ে দাও।

AI পরিকল্পনা তৈরি করবে, প্রয়োজন হলে file বা object inspect করবে, তারপর platform-এর command protocol অনুযায়ী কাজের নির্দেশ দেবে। Local bridge ব্যবহারকারীর অনুমতি নিয়ে target software-এ সেই কাজ করবে।

ফলে AI শুধু উত্তর দেবে না; এটি ব্যবহারকারীর development environment-এর মধ্যে বাস্তব পরিবর্তন করতে পারবে।

---

## বর্তমান ZeroScript থেকে কী থাকবে

বর্তমান project-এর গুরুত্বপূর্ণ অংশগুলো পুনর্ব্যবহার করা যাবে:

1. **AI provider adapter system**
   - প্রতিটি website-এর DOM, composer, response এবং streaming আলাদা adapter-এর মধ্যে থাকবে।
   - core agent loop কোনো নির্দিষ্ট website সম্পর্কে জানবে না।

2. **Command parser**
   - AI-এর উত্তর থেকে নির্দিষ্ট command নিরাপদভাবে শনাক্ত করবে।
   - malformed JSON, অসম্পূর্ণ command এবং একাধিক command আলাদা করে ধরবে।

3. **Browser extension**
   - AI website-এ ZeroScript panel দেখাবে।
   - user message, AI response এবং command result-এর মধ্যে যোগাযোগ করাবে।

4. **Local bridge**
   - browser এবং local software connector-এর মধ্যে নিরাপদ local communication রাখবে।
   - বর্তমানে Roblox MCP bridge যে ভূমিকা পালন করছে, ভবিষ্যতে bridge সেটিই universal router হিসেবে করবে।

5. **Permission এবং status UI**
   - bridge online কিনা, কোন connector চালু আছে, কোন tool available এবং কোন session active তা দেখাবে।

বর্তমান Roblox connector যেন কাজ করতে থাকে, তাই প্রথম universal সংস্করণে Roblox connector-কে সরানো নয়, বরং একটি connector হিসেবে আলাদা করা উচিত।

---

## প্রস্তাবিত architecture

```text
AI Website / Local Model
          |
          v
AI Provider Adapter
          |
          v
Universal Command Protocol
          |
          v
Browser Extension
          |
          v
Local Bridge / Agent Router
          |
          +--> Roblox Studio Connector
          +--> Unity Connector
          +--> VS Code Connector
          +--> Visual Studio Connector
          +--> Android Studio Connector
          +--> Antigravity Connector
          +--> Future Connectors
```

### ১. AI Provider Layer

এই layer-এর কাজ শুধু AI-এর সঙ্গে যোগাযোগ করা:

- input box খুঁজে পাওয়া
- user বা system message পাঠানো
- AI response পড়া
- streaming বা stop state শনাক্ত করা
- command block আলাদা করে hide করা
- provider-specific error বা quota শনাক্ত করা

একটি website যোগ করতে provider layer-এই কাজ হবে। Roblox, Unity বা অন্য software-এর code এই layer-এ থাকা উচিত নয়।

### ২. Universal Command Protocol

AI যেন প্রতিটি software-এর জন্য একই ধরনের অস্পষ্ট text না লেখে, তার জন্য একটি common protocol দরকার। উদাহরণ:

```json
{
  "target": "unity",
  "action": "write_file",
  "params": {
    "path": "Assets/Scripts/PlayerController.cs",
    "content": "..."
  }
}
```

বাস্তবে protocol-এ আরও তথ্য থাকবে:

- target connector
- command name
- parameters
- preview বা confirmation প্রয়োজন কিনা
- destructive কিনা
- request id
- expected result

বর্তমান ZeroScript-এর Roblox command format সরাসরি ভেঙে না দিয়ে versioned protocol রাখা ভালো। যেমন `roblox.*` command পুরোনো system-এর জন্য থাকবে, আর নতুন universal command `workspace.*`, `unity.*`, `vscode.*` ইত্যাদি namespace ব্যবহার করতে পারে।

### ৩. Local Bridge / Agent Router

Bridge হবে পুরো system-এর কেন্দ্রীয় local service। এটি:

- extension থেকে command নেবে
- target connector খুঁজে বের করবে
- permission যাচাই করবে
- preview বা approval চাইবে
- command execute করবে
- result আবার AI conversation-এ পাঠাবে
- connector health এবং logs রাখবে

এখানে একটি command registry থাকবে। প্রতিটি connector তার supported command list, parameter schema, risk level এবং capability register করবে।

### ৪. Software Connector Layer

প্রতিটি software-এর জন্য আলাদা connector থাকবে। কোনো software-কে control করার পদ্ধতি একরকম নয়, তাই সবকিছুকে এক adapter দিয়ে চালানো উচিত নয়।

---

## সম্ভাব্য connector বাস্তবায়ন

### Roblox Studio

বর্তমান Roblox Studio MCP integration-কে প্রথম official connector হিসেবে রাখা যাবে। এটি করবে:

- script read এবং edit
- game tree inspect
- Luau execute
- instance create বা modify
- play-test control
- Creator Store operation

### Unity

সম্ভাব্য পথ:

- Unity Editor-এর ভিতরে একটি package বা Editor plugin
- local HTTP/WebSocket endpoint
- Unity project file এবং C# script operation
- scene, GameObject, component এবং asset operation
- Editor script দিয়ে safe command execution

Unity-এর ক্ষেত্রে সরাসরি arbitrary process control না করে Unity Editor plugin সবচেয়ে নির্ভরযোগ্য হবে।

### Visual Studio Code

সম্ভাব্য পথ:

- একটি VS Code extension
- workspace file read/write
- diagnostics এবং compiler output সংগ্রহ
- terminal command-এর জন্য explicit approval
- project tree এবং open document access

VS Code extension ব্যবহার করলে editor-এর official API পাওয়া যাবে, ফলে screen click বা fragile UI automation-এর উপর নির্ভরতা কমবে।

### Visual Studio

সম্ভাব্য পথ:

- Visual Studio extension বা local automation bridge
- solution/project inspection
- code document update
- build এবং diagnostic result
- test run

এখানে solution-level change এবং build command-এর আগে approval রাখা উচিত।

### Android Studio

সম্ভাব্য পথ:

- Android Studio plugin
- Gradle project inspection
- Kotlin/Java/XML file operation
- build এবং test result
- emulator operation-এর জন্য আলাদা permission

### Antigravity IDE বা অনুরূপ IDE

এক্ষেত্রে প্রথমে দেখতে হবে software-এর public plugin API, command API বা local protocol আছে কিনা। official API থাকলে সেটি ব্যবহার করতে হবে। API না থাকলে limited file/workspace connector দিয়ে শুরু করা যাবে; screen automation-কে শেষ বিকল্প হিসেবে রাখা উচিত।

---

## যেকোনো নতুন AI website যোগ করার automatic system

তোমার প্রস্তাবিত double-click installer বাস্তবায়ন করা যাবে, তবে শুধু website link দিলে সম্পূর্ণ নির্ভুল provider তৈরি করা সবসময় সম্ভব নয়। কারণ URL থেকে সাধারণত এগুলো জানা যায় না:

- input composer কোন element
- send button কোনটি
- response container কোনটি
- streaming শেষ হয়েছে কীভাবে বোঝা যাবে
- stop button কোথায়
- code block কীভাবে render হয়
- login বা captcha state কীভাবে চেনা যাবে
- virtualized message list আছে কিনা

তাই সবচেয়ে ভালো হবে **Provider Setup Wizard** তৈরি করা।

### Wizard-এর সম্ভাব্য workflow

1. ব্যবহারকারী `add-provider.bat` double-click করবেন।
2. একটি ছোট terminal wizard বা local browser UI খুলবে।
3. wizard website-এর নাম, URL এবং display name চাইবে।
4. ব্যবহারকারী browser-এ website খুলে login করবেন।
5. wizard একটি diagnostic helper চালাবে।
6. ব্যবহারকারী input box, send button এবং একটি AI response select বা confirm করবেন।
7. wizard selector এবং capability তথ্য সংগ্রহ করবে।
8. একটি provider template তৈরি করবে।
9. manifest, background routing, popup এবং site list-এ registration যোগ করবে।
10. syntax check এবং provider smoke test চালাবে।
11. extension reload করার নির্দেশ দেখাবে।

### Automatic generation-এর তিনটি level

#### Level ১: Manual-assisted provider

ব্যবহারকারী শুধু URL দেবেন, কিন্তু input, send এবং response element wizard-এ confirm করবেন। এটি সবচেয়ে বাস্তবসম্মত প্রথম version।

#### Level ২: Semi-automatic detection

wizard semantic clue দিয়ে selector খুঁজবে:

- `textarea`
- `contenteditable`
- `role=textbox`
- Send/Stop aria label
- message বা markdown container

তারপর সম্ভাব্য selector দেখিয়ে ব্যবহারকারীর confirmation নেবে।

#### Level ৩: AI-assisted provider builder

একটি analysis model page structure দেখে provider template প্রস্তাব করতে পারে। কিন্তু generated selector সরাসরি production-এ নেওয়া উচিত নয়। sandbox test, user confirmation এবং smoke test অবশ্যই লাগবে।

### গুরুত্বপূর্ণ সিদ্ধান্ত

শুধু URL paste করে শতভাগ automatic, নির্ভুল provider তৈরি করার প্রতিশ্রুতি দেওয়া ঠিক হবে না। Website UI dynamic হলে ভুল provider তৈরি হয়ে AI response পড়তে বা ভুল message পাঠাতে পারে। তাই wizard-এর লক্ষ্য হবে:

> যতটা সম্ভব automatic discovery, কিন্তু final selector ও capability user-confirmed এবং test-verified।

---

## Local AI model ব্যবহারের পরিকল্পনা

Local model-কে website provider হিসেবে দেখা উচিত নয়। Ollama, LM Studio এবং অনেক local inference server OpenAI-compatible API দেয়। তাই এগুলোর জন্য আলাদা **Local Model Provider** layer রাখা ভালো।

### সম্ভাব্য local sources

- Ollama: সাধারণত local HTTP API
- LM Studio: OpenAI-compatible local server
- LocalAI বা অন্য OpenAI-compatible server
- নিজস্ব Python বা Node inference service

### ব্যবহার পদ্ধতি

1. ব্যবহারকারী local model server চালাবেন।
2. ZeroScript settings-এ endpoint দেবেন, যেমন local address।
3. model list থেকে model নির্বাচন করবেন।
4. bridge বা local provider model-এর সঙ্গে request/response চালাবে।
5. model universal command protocol অনুযায়ী command পাঠাবে।
6. target connector command execute করে result ফিরিয়ে দেবে।

### Local model-এর জন্য দরকারি settings

- endpoint URL
- model name
- context size
- temperature বা reasoning setting
- request timeout
- streaming enabled কিনা
- tool/command format
- local server authentication থাকলে token

Local model-এর command parsing browser DOM-এর উপর নির্ভর করবে না। এটাই website-based provider-এর তুলনায় বড় সুবিধা।

### নিরাপত্তা

Local endpoint default হিসেবে শুধু `127.0.0.1` বা `localhost` গ্রহণ করা উচিত। বাইরের network address-এ connection দেওয়ার আগে স্পষ্ট warning দরকার। API key বা token plain text log-এ লেখা যাবে না।

---

## Security model অবশ্যই শুরু থেকেই রাখতে হবে

এই platform AI-কে user's computer-এ কাজ করার ক্ষমতা দেবে। তাই security optional feature নয়, মূল architecture-এর অংশ।

### Command risk levels

- **Read-only:** file read, tree inspect, diagnostics
- **Low risk:** নতুন file তৈরি, non-destructive edit
- **Medium risk:** build, package install, scene/project change
- **High risk:** delete, shell command, process control, publish/deploy

### Approval policy

- read-only command স্বয়ংক্রিয় হতে পারে
- low-risk command প্রথমবার preview দেখাতে পারে
- medium-risk command user confirmation চাইবে
- high-risk command প্রতিবার explicit confirmation চাইবে
- broad delete বা recursive cleanup কখনও silently করা যাবে না

### আরও প্রয়োজনীয় সুরক্ষা

- target allowlist
- project/workspace allowlist
- file path traversal protection
- command schema validation
- dry-run mode
- undo বা backup
- audit log
- emergency Stop All button
- per-connector enable/disable
- session expiry
- sensitive file exclusion, যেমন `.env`, private keys এবং credentials

---

## UI-এর প্রস্তাব

বর্তমান ছোট ZeroScript bar-এর পাশাপাশি একটি **Workspace Control Center** রাখা যেতে পারে। এতে থাকবে:

- AI source selector
- local model selector
- target software selector
- connected/disconnected status
- active project/workspace
- available capabilities
- command approval dialog
- recent action log
- Stop All button
- connector settings
- provider setup wizard

UI জটিল না করে তিনটি প্রধান status পরিষ্কারভাবে দেখানো উচিত:

1. কোন AI-এর সঙ্গে কথা হচ্ছে
2. কোন software target হিসেবে active
3. সর্বশেষ command সফল হয়েছে কিনা

---

## উন্নয়নের ধাপ

### Phase 1: Architecture foundation

- বর্তমান Roblox functionality অপরিবর্তিত রাখা
- connector interface নির্ধারণ
- universal command schema তৈরি
- bridge-এ connector registry যোগ
- existing Roblox path adapter হিসেবে isolate করা

### Phase 2: Local model support

- Ollama support
- LM Studio support
- OpenAI-compatible endpoint support
- model selection এবং endpoint settings
- local model smoke test

### Phase 3: Provider Wizard

- `add-provider.bat`
- setup UI বা guided terminal
- URL validation
- selector discovery
- provider template generation
- manifest registration
- validation ও backup

### Phase 4: VS Code connector

VS Code-এর official extension API সহজলভ্য হওয়ায় এটি প্রথম non-Roblox connector হিসেবে ভালো candidate।

### Phase 5: Unity connector

Unity Editor plugin এবং project-safe command set তৈরি করা।

### Phase 6: Visual Studio এবং Android Studio

প্রতিটি IDE-এর জন্য official extension/plugin বা documented local API ব্যবহার করা।

### Phase 7: Advanced orchestration

- এক conversation থেকে একাধিক target
- target switching
- multi-step plans
- task checkpoint
- rollback
- project memory
- connector health monitoring

---

## কী করা উচিত নয়

- শুধু URL দেখে provider ১০০% তৈরি হয়েছে বলা
- সব website-এর জন্য একই Gemini বা ChatGPT selector ব্যবহার করা
- AI-কে unrestricted shell access দেওয়া
- user confirmation ছাড়া delete বা publish করা
- UI automation-কে official API-এর বিকল্প হিসেবে সবসময় ব্যবহার করা
- provider failure হলে core agent loop-এ website-specific workaround ঢোকানো
- একসঙ্গে অনেক software support ঘোষণা করে test না করা

---

## সবচেয়ে বাস্তবসম্মত প্রথম লক্ষ্য

এই সম্পূর্ণ vision একবারে বাস্তবায়ন না করে প্রথমে একটি stable vertical slice তৈরি করা উচিত:

1. বর্তমান Roblox support অক্ষত রাখা
2. Ollama ও LM Studio local model support যোগ করা
3. universal connector interface তৈরি করা
4. VS Code connector তৈরি করা
5. একটি guided `add-provider.bat` wizard তৈরি করা
6. approval, dry-run এবং audit log যোগ করা

এই ছোট version সফল হলে একই architecture-এ Unity, Visual Studio এবং Android Studio যোগ করা অনেক সহজ হবে।

---

## শেষ কথা

এই project-এর unique value হবে শুধু “AI দিয়ে code লেখা” নয়। এর আসল পরিচয় হতে পারে:

> **যে AI-এর সঙ্গে তুমি কথা বলতে চাও, এবং যে software-এর মধ্যে কাজ করাতে চাও, দুটো স্বাধীনভাবে বেছে নিয়ে তাদের নিরাপদে সংযুক্ত করা।**

বর্তমান ZeroScript এই vision-এর একটি কার্যকর prototype। Roblox Studio হলো প্রথম target connector, browser AI provider হলো প্রথম AI channel, এবং local bridge হলো সেই সংযোগের ভিত্তি। পরবর্তী evolution হবে provider এবং connector দুটোকেই modular করা, যাতে নতুন website বা software যোগ করতে core system পুনরায় লিখতে না হয়।
