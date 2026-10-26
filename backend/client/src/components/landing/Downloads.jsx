import Reveal from './Reveal.jsx';
import Icon from '../Icon.jsx';

function PhoneIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

const PLATFORMS = [
  {
    id: 'android',
    title: 'Android',
    badge: 'Single APK · Do Not Zip',
    file: 'BCI_Campus_Tour-Android.apk',
    size: '2.12 GB (2,119,149,788 B)',
    why: 'Single self-contained file — content, OBB, and both shader libraries are already packaged inside it. Do not zip it (Android cannot install from inside an archive).',
    href: '/api/download/mobile',
    downloadAttr: 'BCI_Campus_Tour-Android.apk',
    icon: <PhoneIcon />,
    gradient: 'linear-gradient(135deg, #7759de, #a389f4)',
    glow: 'rgba(119, 89, 222, 0.35)',
    specs: [
      { label: 'OS & API Floor', value: 'Android 12L (API 32) or newer — hard floor (older devices refuse to install)' },
      { label: 'Hardware', value: 'arm64 CPU (no 32-bit devices) & Vulkan-capable GPU' },
      { label: 'Free Space Needed', value: '~4.3 GB total (2.12 GB download + ~2.12 GB during install) over Wi-Fi' },
      { label: 'App Drawer Label', value: 'BCI_Campus_Tour (not PRJ381)' },
    ],
    stepsTitle: 'Android — Step-by-Step Installation',
    steps: [
      'Check your phone qualifies: Android 12L (API 32)+, arm64 CPU, and a Vulkan-capable GPU.',
      'Free up ~4.3 GB of storage space and connect to Wi-Fi (not mobile data).',
      'Tap Download below. When Chrome shows "This type of file can harm your device. Do you want to keep BCI_Campus_Tour-Android.apk anyway?", tap Download anyway.',
      'Open the APK from Downloads. When prompted "For your security, your phone is not allowed to install unknown apps from this source", tap Settings → enable Allow from this source for Chrome/Files → go back → tap Install.',
      'Get past Play Protect: because this build is debug-signed, tap More details → Install anyway when "Unsafe app blocked" or "App scan recommended" appears.',
      'Wait for installation to finish, then tap Open or find BCI_Campus_Tour in your app drawer.',
      'On first launch, allow the permission prompts and wait (~6 seconds on Galaxy A33, longer on weaker hardware) while first-boot PSO shaders compile.',
    ],
    warningsTitle: 'Updating & Signing Notice (Debug Keystore)',
    warnings: [
      'Same-key requirement: Because there is no release Keystore configured, builds are signed with Unreal Engine\'s shared debug key. Installing a newer APK over an older one only works if both were built on the same machine/UE key. Otherwise Android fails with INSTALL_FAILED_UPDATE_INCOMPATIBLE and you must uninstall the existing app first (which wipes local data).',
      'Future release builds: Public downloads signed with a debug key cannot later be upgraded in-place to a release-signed build without uninstalling and reinstalling.',
    ],
  },
  {
    id: 'windows',
    title: 'Windows (PC / Desktop)',
    badge: 'Folder Archive · 71 Files',
    file: 'BCI_Campus_Tour-Windows.zip',
    size: '3.92 GB uncompressed (4,204,892,805 B, 71 files)',
    why: 'The Windows build is a multi-file folder structure, so it must be archived as a ZIP and extracted completely before launching.',
    href: '/api/download/desktop',
    downloadAttr: 'BCI_Campus_Tour-Windows.zip',
    icon: <Icon name="monitor" size={28} />,
    gradient: 'linear-gradient(135deg, #2ed8b6, #59e0c5)',
    glow: 'rgba(46, 216, 182, 0.35)',
    specs: [
      { label: 'OS & Graphics', value: 'Windows 10/11 (64-bit) · DirectX 12 with Shader Model 6 GPU (Lumen & Virtual Shadow Maps enabled)' },
      { label: 'Build Configuration', value: 'Development configuration (~4 GB including debug symbols)' },
      { label: 'Free Space Needed', value: '~7.8 GB total (3.92 GB ZIP archive + 3.92 GB extracted folder)' },
      { label: 'Required Archive Root', value: 'PRJ381.exe, Engine\\, PRJ381\\, NOTICES.txt' },
    ],
    stepsTitle: 'Windows — Step-by-Step Installation',
    steps: [
      'Ensure you have at least 7.8 GB of free disk space (users routinely run out of space when extracting next to the archive).',
      'Download BCI_Campus_Tour-Windows.zip.',
      'Extract it fully: right-click the downloaded ZIP → select Extract All. Do NOT double-click into the ZIP and run PRJ381.exe from inside the archive, or it will fail to find Engine\\ and PRJ381\\ and will not launch.',
      'Verify that PRJ381.exe, Engine\\, PRJ381\\, and NOTICES.txt sit together as siblings in the extracted folder (keep NOTICES.txt for third-party engine attributions).',
      'Double-click PRJ381.exe. When Windows SmartScreen displays "Windows protected your PC", click More info → Run anyway (expected for an unsigned executable).',
    ],
    archiveLayout: `PRJ381.exe\nEngine\\\nPRJ381\\\nNOTICES.txt`,
  },
];

export default function Downloads() {
  return (
    <section id="download" className="section downloads">
      <div className="section-head center">
        <Reveal className="section-label">
          <span>05</span> Download
        </Reveal>
        <Reveal as="h2" delay={80}>
          Start your <span className="text-gradient">virtual visit</span>
        </Reveal>
        <Reveal as="p" delay={160} className="section-sub">
          Choose your platform below. Review the storage requirements and installation steps before downloading.
        </Reveal>
      </div>

      <div className="download-grid download-grid-two">
        {PLATFORMS.map((p, i) => (
          <Reveal key={p.id} className="download-card download-card-detailed" delay={i * 120} style={{ '--glow': p.glow }}>
            <div className="download-card-header">
              <span className="download-icon" style={{ background: p.gradient }}>
                {p.icon}
              </span>
              <div className="download-title-group">
                <span className="download-badge">{p.badge}</span>
                <h3>{p.title}</h3>
              </div>
            </div>

            <div className="download-file-meta">
              <div className="download-meta-row">
                <span className="download-meta-label">File to host:</span>
                <code>{p.file}</code>
              </div>
              <div className="download-meta-row">
                <span className="download-meta-label">Size:</span>
                <strong>{p.size}</strong>
              </div>
            </div>

            <p className="download-why">{p.why}</p>

            <a href={p.href} download={p.downloadAttr} className="pill pill-white download-cta">
              Download {p.file}
              <Icon name="download" size={16} />
            </a>

            <dl className="download-specs">
              {p.specs.map((s) => (
                <div key={s.label} className="download-spec-item">
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>

            <details className="download-details" open>
              <summary>{p.stepsTitle}</summary>
              <div className="download-details-body">
                <ol className="download-steps">
                  {p.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
                {p.archiveLayout && (
                  <div className="download-layout-box">
                    <span className="download-layout-title">Required Archive Root Layout:</span>
                    <pre tabIndex={0}><code>{p.archiveLayout}</code></pre>
                  </div>
                )}
              </div>
            </details>

            {p.warnings && (
              <div className="download-warning-box" role="note">
                <strong>{p.warningsTitle}</strong>
                <ul>
                  {p.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  );
}
