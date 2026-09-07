# 🏛️ Virtual Campus Open Day (MVP)

An immersive, cross-platform 3D exploration application designed to bring the campus experience directly to prospective students. 

This project utilizes real-world photogrammetry and 3D building scans, heavily optimized for performance, to create a navigable virtual environment. Built in **Unreal Engine 5**, the application features a dynamic "Dual-Pawn" system that seamlessly supports both fully immersive standalone VR headsets and standard flat-screen devices (PC/Mobile) without requiring different builds.

## ✨ Key Features
* **True-to-Scale 3D Environments:** High-fidelity architectural scans processed through Blender for severe decimation and retopology to ensure smooth performance.
* **Hybrid Cross-Platform Support:** * **VR Mode:** Native teleportation locomotion and hand-tracking support for standalone headsets (e.g., Meta Quest).
* **Flat-Screen Mode:** Standard WASD/Mouse first-person controls and mobile virtual joysticks for users without VR hardware.
* **Optimized for Mobile Render Pipelines:** Forward shading and pre-baked lighting to maintain high framerates on mobile VR chips (Snapdragon XR2) and standard smartphones.

## 🛠️ Tech Stack & Tools
* **Game Engine:** Unreal Engine 5 (Mobile/Tablet Target Hardware)
* **3D Pipeline:** Photogrammetry generation & LiDAR -> Blender (Centering, Scaling, Decimation) -> `.fbx` export
* **Version Control:** Git & GitHub (with Git Large File Storage)
* **Methodology:** Agile (XP) aiming for a 6-month MVP delivery.

## 🤝 XP Collaboration & Version Control Rules

This project utilizes Extreme Programming (XP) and Trunk-Based Development. 

* **Single Source of Truth:** We push directly to `main` (or use < 24-hour temporary branches). Ensure your local `main` is pulled and up-to-date before starting any work.
* **Pair Programming Default:** Major architectural tasks, complex Blueprint logic, and difficult retopology workflows should be tackled in pairs to maintain code quality and prevent binary asset collisions.
* **Continuous Integration:** At the end of every development day, the `main` branch must compile successfully into a testable build. Do not push broken references or uncompiled Blueprints.
* **Test-Driven Development:** Utilize Unreal's Automation Framework for core mechanics. If you add a new interactive element, add a functional test for it.

---

## 🚀 Getting Started for Developers

**⚠️ IMPORTANT: You MUST have Git LFS installed before cloning this repository. If you clone without LFS, the massive binary `.uasset` and `.umap` files will corrupt.**

### 1. Initial Setup
1. Download and install [Git LFS](https://git-lfs.com/).
2. Open your git bash terminal and initialize LFS on your machine:
   ```bash
   git lfs install

## 📊 Project Progress

Automatically updated every Monday from our ClickUp board.
Reference images: **[Campus Reference Images](https://belgiumcampusacza.sharepoint.com/:f:/s/PRJ3812026-STE-BCOM-Group3/IgBQnndqW5BwQLvyJaraki-zAdYiY74ln2q9eea4nOrb1PQ?e=GDixEC)**

<!-- PROGRESS-REPORT:START -->
### Weekly Progress Report — 07 Sep 2026

_Reporting window: 31 Aug – 07 Sep 2026 · generated automatically from ClickUp_

| Metric | Count |
|---|---|
| Total tickets on board | 53 |
| ✅ Done (all time) | 23 |
| 🔄 In progress | 13 |
| 📋 To do | 17 |
| 🎉 Completed this week | 2 |
| 🆕 Created this week | 0 |

**🎉 Completed this week**

- **Staff dashboard — view engagement analytics** — Chris Fourie, Joshua Arnold · [open](https://app.clickup.com/t/86cb7ep6x)
- **OAuth2 staff/dev auth + analytics-writer role** — Joshua Arnold, Chris Fourie · [open](https://app.clickup.com/t/86cajkmh4)

**🔄 In progress**

- **Build lecturer MetaHumans in Unreal (MetaHuman plugin)** — Ethan Lindsay · [open](https://app.clickup.com/t/86cb94y08)
- **Scan lecturers for MetaHuman capture (9 staff)** — Robert Van Der Merwe · [open](https://app.clickup.com/t/86cb94xy3)
- **Offline lead cache + retry (Request-More-Info)** — Robert Van Der Merwe · [open](https://app.clickup.com/t/86cb7ep1t)
- **Techno Lab NPC Logic** — Louis Schonborn, Fourie · [open](https://app.clickup.com/t/86cb0u8hx)
- **Virtual Escape Room Game** — Louis Schonborn, liam dickson · [open](https://app.clickup.com/t/86cb0tym5)
- **Packaging the project and test functionality** — Shaun van der Bijl, Robert Van Der Merwe · [open](https://app.clickup.com/t/86cav821u)
- **Test VR functionality (bug-free, engaging)** — unassigned · [open](https://app.clickup.com/t/86cajkmqd)
- **Test assets for bugs & artifacts** — unassigned · [open](https://app.clickup.com/t/86cajkmq9)
- **Collect multimedia per area (photos/videos/text)** — Robert Van Der Merwe, Ethan Lindsay · [open](https://app.clickup.com/t/86cajkmq2)
- **Texture & optimise assets for 90fps target** — unassigned · [open](https://app.clickup.com/t/86cajkmpf)
- **UI + open-day / campus selection screen** — Ethan Lindsay, Chris Fourie, Joshua Arnold · [open](https://app.clickup.com/t/86cajkmgv)
- **Request-More-Info form + backend logging** — Robert Van Der Merwe · [open](https://app.clickup.com/t/86cajkmgg)
- **Interactive hotspots + multimedia overlays** — unassigned · [open](https://app.clickup.com/t/86cajkmfz)

**📅 Due in the next 7 days**

_Nothing due in the coming week._

**⚠️ Overdue**

- **Unreal client: send platform/buildId/appVersion + offline analytics queue** — Robert Van Der Merwe · [open](https://app.clickup.com/t/86cba4qfb)
- **POPIA consent + likeness release forms for staff scans** — unassigned · [open](https://app.clickup.com/t/86cb94y7u)
- **Optimise lecturer MetaHumans for 90fps VR + Android** — Ethan Lindsay, Shaun van der Bijl · [open](https://app.clickup.com/t/86cb94y5k)
- **Swap dummy NPCs for lecturer MetaHumans (1 per level)** — unassigned · [open](https://app.clickup.com/t/86cb94y2r)
- **Build lecturer MetaHumans in Unreal (MetaHuman plugin)** — Ethan Lindsay · [open](https://app.clickup.com/t/86cb94y08)
- **Scan lecturers for MetaHuman capture (9 staff)** — Robert Van Der Merwe · [open](https://app.clickup.com/t/86cb94xy3)
- **Firebase API-key restriction + secrets hardening (pre-ship)** — Robert Van Der Merwe · [open](https://app.clickup.com/t/86cb7epat)
- **Offline lead cache + retry (Request-More-Info)** — Robert Van Der Merwe · [open](https://app.clickup.com/t/86cb7ep1t)
- **Techno Lab NPC Logic** — Louis Schonborn, Fourie · [open](https://app.clickup.com/t/86cb0u8hx)
- **Virtual Escape Room Game** — Louis Schonborn, liam dickson · [open](https://app.clickup.com/t/86cb0tym5)
- **Packaging the project and test functionality** — Shaun van der Bijl, Robert Van Der Merwe · [open](https://app.clickup.com/t/86cav821u)
- **Final testing before deployment** — unassigned · [open](https://app.clickup.com/t/86cajkmre)
- **Full application test (bug-free experience)** — unassigned · [open](https://app.clickup.com/t/86cajkmr6)
- **Usability testing (SUS)** — unassigned · [open](https://app.clickup.com/t/86cajkmqz)
- **Performance benchmarking (Unreal Insights, 90fps)** — unassigned · [open](https://app.clickup.com/t/86cajkmqv)
- **Test UI limitations (bug-free interface)** — unassigned · [open](https://app.clickup.com/t/86cajkmqm)
- **Test VR functionality (bug-free, engaging)** — unassigned · [open](https://app.clickup.com/t/86cajkmqd)
- **Test assets for bugs & artifacts** — unassigned · [open](https://app.clickup.com/t/86cajkmq9)
- **Optional audio narration** — unassigned · [open](https://app.clickup.com/t/86cajkmq6)
- **Collect multimedia per area (photos/videos/text)** — Robert Van Der Merwe, Ethan Lindsay · [open](https://app.clickup.com/t/86cajkmq2)
- **Texture & optimise assets for 90fps target** — unassigned · [open](https://app.clickup.com/t/86cajkmpf)
- **Final polish of program** — unassigned · [open](https://app.clickup.com/t/86cajkmka)
- **Easter eggs / additional functionality** — unassigned · [open](https://app.clickup.com/t/86cajkmjr)
- **UI + open-day / campus selection screen** — Ethan Lindsay, Chris Fourie, Joshua Arnold · [open](https://app.clickup.com/t/86cajkmgv)
- **Request-More-Info form + backend logging** — Robert Van Der Merwe · [open](https://app.clickup.com/t/86cajkmgg)
- **Interactive hotspots + multimedia overlays** — unassigned · [open](https://app.clickup.com/t/86cajkmfz)
- **Final report + final polish of docs** — unassigned · [open](https://app.clickup.com/t/86cajkmeh)
- **Testing documentation (cases, logs, results)** — unassigned · [open](https://app.clickup.com/t/86cajkmda)
- **User guide** — Ethan Lindsay, Chris Fourie · [open](https://app.clickup.com/t/86cajkmc2)
- **Technical documentation (setup, build, structure)** — Robert Van Der Merwe · [open](https://app.clickup.com/t/86cajkmbt)

<!-- PROGRESS-REPORT:END -->