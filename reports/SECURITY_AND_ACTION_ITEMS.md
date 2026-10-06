# 🛡️ Security Audit & Developer Handover Action Items

---

## 🔒 1. Penetration & Security Audit Summary

| Attack Vector | Attack Payload / Scenario | Defense Mechanism | Verdict |
| :--- | :--- | :--- | :---: |
| **NoSQL Injection** | `{"$ne": null}` injected into credentials & tickets | Express-validator strict type checking | **BLOCKED (400) ✅** |
| **DDE CSV Injection** | Excel formula triggers (`=cmd|' /C calc'!A0`, `+SUM`) | `csvCell()` prepends single quote `'` | **DEFUSED ✅** |
| **JWT "None" Attack** | Unsigned token with `alg: "none"` | `jwt.verify()` enforces HMAC-SHA256 signature | **REJECTED (401) ✅** |
| **Prototype Pollution** | `__proto__` and `constructor.prototype` tampering | Express body parser isolation | **IMMUNE ✅** |
| **Single-IP Flooding** | 100 rapid requests from single host | Rate limiter strictly halts burst at request #60 | **INTERCEPTED (429) ✅** |
| **Anti-Bot Spam** | Hidden `website` honeypot fields | Returns 201 to bot, writes 0 records to DB | **NEUTRALIZED ✅** |
| **Cross-Tenant Snoop** | Guessing support ticket references | SHA-256 visitor key verification required | **BLOCKED (404) ✅** |
| **DB Outage Crash** | MongoDB disconnection mid-runtime | `requireDb` immediate 503 + `Retry-After: 30` | **RESILIENT ✅** |

---

## 🚀 2. Developer-by-Developer Handover Action Items

### 👨‍💻 Backend Developers
1. **Fix Mobile Email Autocomplete Whitespace Trap (High Priority):**
   - Add `.isString().trim()` before `.isEmail()` on `backend/src/routes/leads.routes.js`, `tickets.routes.js`, and `feedback.routes.js`.
   - *Reason:* Mobile keyboards auto-append a space (`"student@bc.ac.za "`), which currently triggers a 400 validation error.
2. **Add Unique Compound Index on Telemetry (Medium Priority):**
   - In `backend/src/models/AnalyticsEvent.js`, add:
     ```js
     analyticsEventSchema.index({ sessionId: 1, seq: 1 }, { unique: true });
     ```
   - *Reason:* Prevents duplicate telemetry records when headsets reconnect and retry bulk batches.

### 🎨 3D Artists & Media Team
1. **Convert Landing Page PNGs to WebP (High Priority):**
   - 12 raw PNGs in `backend/client/public/assets/` consume 22 MB. Converting to `.webp` reduces total weight to **2.5 MB (88% reduction)**.
   - *Reason:* Mobile visitors on 4G cellular networks experience a 5-10s initial page freeze downloading raw PNGs.
2. **Clamp 4K Textures for Android & VR (High Priority):**
   - In Unreal Engine, set Maximum Texture Resolution to `2048` or `1024` on floor materials and MetaHuman clothing for Mobile/VR profiles.
   - *Reason:* Unclamped 4K textures cause Snapdragon Adreno GPUs to run out of VRAM and thermal throttle.

### 🎮 Unreal Engine & Packaging Lead
1. **Packaging Config Defect Fix (High Priority):**
   - In `Config/DefaultGame.ini`, add the two missing maps to `+MapsToCook`:
     ```ini
     +MapsToCook=(FilePath="/Game/Levels/Stellenbosch/LVL_Persistent")
     +MapsToCook=(FilePath="/Game/Levels/Stellenbosch/LVL_Library")
     ```
   - *Reason:* Currently, packaged builds omit the persistent world and library.
2. **Bake Secondary Dynamic Lighting in OuterCampus (High Priority):**
   - In `LVL_OuterCampus`, convert 4 secondary fill lights from Movable/Stationary to Static, or disable dynamic shadow casting on them.
   - *Reason:* Drops Quest 3 draw calls from **278 down to < 175**, eliminating VR headset stutter.
3. **Add Texture Streaming Directive to AndroidEngine.ini (Medium Priority):**
   - In `Config/Android/AndroidEngine.ini`:
     ```ini
     [/Script/Engine.RendererSettings]
     r.TextureStreaming=1
     r.Streaming.PoolSize=1000
     ```
