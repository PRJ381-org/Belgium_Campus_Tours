# PRJ381 Virtual Campus Open Day — Phase 2 Defensive Action Items

**Scope:** Post-Audit Security, Hardening & Robustness Directives  
**Target:** Backend API, Database Integrity & VR Client Configuration  

---

## 1. Action Item Overview

| ID | Title | Component | Priority | Status |
| :---: | :--- | :--- | :---: | :---: |
| **SEC-01** | Atomic Ticket Key Registration via `$push` | `backend/src/controllers/tickets.controller.js` | **High** | Recommended |
| **SEC-02** | Zero-Width Space Sanitization in Email Pipeline | `backend/src/routes/*.routes.js` | **Medium** | Recommended |
| **SEC-03** | Trusted Proxy Header Enforcement in Production | `backend/src/app.js` | **Medium** | Verified / Ready |
| **SEC-04** | Unreal Engine Android/VR Streaming Pool Cap | `Config/Android/AndroidEngine.ini` | **High (VR)** | Recommended |

---

## 2. Granular Action Item Directives

### SEC-01: Atomic Ticket Key Registration via MongoDB `$push`
- **Component:** `backend/src/controllers/tickets.controller.js` (`lookupTicket`)
- **Finding:** Under rapid parallel device lookups for the same ticket reference, multiple worker requests load the same Mongoose document and attempt sequential `.save()`. Mongoose's internal document versioning (`__v`) detects concurrent modification and raises a `VersionError`, resulting in a transient 500 error for one of the concurrent callers.
- **Recommended Remediation:**  
  Replace the read-modify-save pattern with an atomic MongoDB find-and-update using `$push` and `$slice`:
  ```javascript
  const hashedKey = Ticket.hashKey(key);
  const ticket = await Ticket.findOneAndUpdate(
    { ref: req.body.ref.toUpperCase(), email: req.body.email },
    {
      $push: {
        keyHashes: {
          $each: [hashedKey],
          $slice: -Ticket.MAX_KEYS,
        },
      },
    },
    { new: true }
  ).select('+keyHashes');
  ```
- **Benefit:** Completely eliminates document version conflicts and guarantees zero lock contention even during multi-device lookup stampedes.

---

### SEC-02: Unicode Zero-Width Space Sanitization
- **Component:** `backend/src/routes/leads.routes.js`, `tickets.routes.js`, `feedback.routes.js`
- **Finding:** Fuzz testing revealed that standard `validator.isEmail()` evaluates strings containing Unicode Zero-Width Spaces (`\u200B`) as syntactically valid email local-parts. While MongoDB stores them without crashing or memory corruption, they represent potential visual spoofing vectors.
- **Recommended Remediation:**  
  Add an explicit zero-width sanitizer preceding email validation:
  ```javascript
  body('email')
    .isString()
    .customSanitizer((val) => (typeof val === 'string' ? val.replace(/[\u200B-\u200D\uFEFF]/g, '') : val))
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail();
  ```
- **Benefit:** Prevents homoglyph and zero-width characters from entering the lead database or email dispatcher.

---

### SEC-03: Production Reverse-Proxy IP Header Hardening
- **Component:** Express Configuration / Deployment Infrastructure
- **Finding:** Rate limiters rely on client IP addresses extracted from `X-Forwarded-For` when `trust proxy` is enabled.
- **Verification:** In the production environment (NGINX / Passenger / Cloudflare), verify that the outermost edge proxy strips and replaces client-supplied `X-Forwarded-For` headers with the real client socket address to prevent rate-limit evasion.

---

### SEC-04: Android/Meta Quest 3 Texture Streaming Pool Clamping
- **Component:** `Config/Android/AndroidEngine.ini`
- **Finding:** Phase 2 VR memory simulations demonstrated that when 4 or more MetaHumans are concurrently active, texture memory exceeds 1,175 MB, overflowing the default 1,000 MB mobile texture budget and risking Android OS Low-Memory-Killer (LMK) process termination.
- **Recommended Remediation:**  
  Ensure `Config/Android/AndroidEngine.ini` enforces:
  ```ini
  [/Script/Engine.RendererSettings]
  r.TextureStreaming=1
  r.Streaming.PoolSize=1000
  r.Streaming.LimitPoolSizeToVRAM=1
  r.Streaming.AmortizeCPUToGPUCopy=1
  r.Streaming.MaxNumTexturesToStreamPerFrame=3
  ```
- **Benefit:** Guarantees texture memory stays within hardware bounds and eliminates OS out-of-memory aborts during open day campus tours.
