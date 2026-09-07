/**
 * Client-side Download Center Controller.
 * Handles platform auto-detection, live metadata updates from /api/downloads/info,
 * and card highlighting for prospective students.
 */

/**
 * Detects the user's OS / platform from navigator.userAgent.
 * Returns: 'windows' | 'android' | 'quest' | 'unknown'
 */
export function detectUserPlatform() {
  const ua = navigator.userAgent || '';
  if (/OculusBrowser|Quest/i.test(ua)) {
    return 'quest';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  if (/Windows NT|Win64|Win32/i.test(ua)) {
    return 'windows';
  }
  return 'unknown';
}

/**
 * Fetches dynamic build info from the backend and updates card badges.
 */
export async function loadBuildInfo() {
  try {
    const res = await fetch('/api/downloads/info');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.builds) return;

    ['windows', 'android', 'quest'].forEach((platform) => {
      const build = data.builds[platform];
      if (!build) return;

      const versionEl = document.getElementById(`badge-version-${platform}`);
      const sizeEl = document.getElementById(`badge-size-${platform}`);

      if (versionEl && build.version) {
        versionEl.textContent = `v${build.version}`;
      }
      if (sizeEl && build.size) {
        sizeEl.textContent = build.size;
      }
    });
  } catch (err) {
    // Graceful fallback to static HTML defaults
    console.debug('Using fallback download metadata:', err.message);
  }
}

/**
 * Applies detected platform badges and highlight styling to the corresponding card.
 */
export function applyPlatformHighlight(platform) {
  const banner = document.getElementById('detected-device-banner');
  const bannerText = document.getElementById('detected-device-text');

  const platformNames = {
    windows: 'Windows PC (DirectX 12 / Vulkan)',
    android: 'Android Mobile Device',
    quest: 'Meta Quest Standalone VR',
  };

  if (platform && platformNames[platform]) {
    // Show detected banner
    if (banner && bannerText) {
      bannerText.textContent = `Recommended for your device: ${platformNames[platform]}`;
      banner.style.display = 'inline-flex';
    }

    // Highlight card & show recommended badge
    const targetCard = document.getElementById(`card-${platform}`);
    const recBadge = document.getElementById(`badge-rec-${platform}`);

    if (targetCard) {
      targetCard.classList.add('recommended-card');
    }
    if (recBadge) {
      recBadge.style.display = 'inline-block';
    }
  }
}

/**
 * Opens the Installation Guide modal focused on a specific platform tab.
 */
export function openGuideModal(platform = 'windows') {
  const modal = document.getElementById('guide-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  selectGuideTab(platform);
}

/**
 * Closes the Installation Guide modal.
 */
export function closeGuideModal() {
  const modal = document.getElementById('guide-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.classList.remove('modal-open');
}

/**
 * Switches the active platform tab inside the Installation Guide modal.
 */
export function selectGuideTab(platform) {
  const tabButtons = document.querySelectorAll('.modal-tab-btn');
  const panels = document.querySelectorAll('.guide-panel');

  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === platform);
  });

  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `guide-panel-${platform}`);
  });
}

/**
 * Binds event listeners for modal triggers, tabs, close button, and backdrop.
 */
export function initGuideModalListeners() {
  const triggers = document.querySelectorAll('[data-guide-trigger]');
  const closeBtn = document.getElementById('modal-close-btn');
  const modal = document.getElementById('guide-modal');
  const tabButtons = document.querySelectorAll('.modal-tab-btn');

  triggers.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const platform = btn.dataset.guideTrigger || 'windows';
      openGuideModal(platform);
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeGuideModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeGuideModal();
      }
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetPlatform = btn.dataset.tab;
      selectGuideTab(targetPlatform);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
      closeGuideModal();
    }
  });
}

// Initialise when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const detected = detectUserPlatform();
  applyPlatformHighlight(detected);
  loadBuildInfo();
  initGuideModalListeners();
});

