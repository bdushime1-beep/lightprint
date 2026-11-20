// ==========================================================================
// LightPrint - Frontend Logic
// Architecture: Vanilla ES6, Fetch API, DOM manipulation
// ==========================================================================

const state = {
  services: [],
  activeGrade: "ALL",
  sortMode: "worst-first",
  activeModalService: null,
  activeTab: "all",
  searchDebounceTimer: null
};

// Preset sample snippets for the live clause scanner
const PRESET_SNIPPETS = {
  arbitration: "You and the Company agree that any dispute, claim, or controversy arising out of or relating to these Terms shall be settled by binding arbitration on an individual basis, and you waive any right to bring or participate in a class action lawsuit.",
  unilateral: "We reserve the right, at our sole discretion, to modify, replace, or update these Terms of Service at any time without prior notice to you. Your continued use of the platform constitutes acceptance of all revised terms.",
  copyright: "By submitting, posting, or displaying content on or through the Services, you grant us a worldwide, non-exclusive, perpetual, irrevocable, royalty-free license (with the right to sublicense) to use, copy, reproduce, process, adapt, modify, publish, transmit, display, and distribute such content in any and all media.",
  sharing: "We may share, transfer, or sell your personal information, including browsing history, IP address, device identifiers, and location data, to third-party advertising partners, data brokers, and affiliates for commercial profiling."
};

// Initial featured services to seed the dashboard
const INITIAL_QUERIES = ["YouTube", "Spotify", "Reddit", "Steam", "Discord", "DuckDuckGo"];

// DOM Elements
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");
const servicesGrid = document.getElementById("servicesGrid");
const resultsCount = document.getElementById("resultsCount");
const resultsTitle = document.getElementById("resultsTitle");
const statusBanner = document.getElementById("statusBanner");
const sortSelect = document.getElementById("sortSelect");
const filterChips = document.querySelectorAll(".filter-chips .chip");
const nodeNameEl = document.getElementById("nodeName");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeLabel = document.getElementById("themeLabel");

// Modal Elements
const detailModal = document.getElementById("detailModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalServiceName = document.getElementById("modalServiceName");
const modalServiceUrls = document.getElementById("modalServiceUrls");
const modalGradeBadge = document.getElementById("modalGradeBadge");
const modalPointsList = document.getElementById("modalPointsList");
const modalTabs = document.querySelectorAll(".modal-tabs .tab-btn");
const countAll = document.getElementById("countAll");
const countBad = document.getElementById("countBad");
const countNeutral = document.getElementById("countNeutral");
const countGood = document.getElementById("countGood");

// Scanner Elements
const scannerInput = document.getElementById("scannerInput");
const scanBtn = document.getElementById("scanBtn");
const clearScannerBtn = document.getElementById("clearScannerBtn");
const scannerResults = document.getElementById("scannerResults");
const presetButtons = document.querySelectorAll(".preset-btn");

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupEventListeners();
  loadInitialServices();
});

function setupEventListeners() {
  // Search input events
  searchInput.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    clearBtn.hidden = val.length === 0;
    clearTimeout(state.searchDebounceTimer);
    if (val.length >= 2) {
      state.searchDebounceTimer = setTimeout(() => performSearch(val), 350);
    } else if (val.length === 0) {
      loadInitialServices();
    }
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.hidden = true;
    searchInput.focus();
    loadInitialServices();
  });

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = searchInput.value.trim();
    if (val) performSearch(val);
  });

  // Quick pills
  document.querySelectorAll(".pill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.query;
      searchInput.value = q;
      clearBtn.hidden = false;
      performSearch(q);
    });
  });

  // Filter chips
  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.activeGrade = chip.dataset.grade;
      renderServices();
    });
  });

  // Sort selector
  sortSelect.addEventListener("change", (e) => {
    state.sortMode = e.target.value;
    renderServices();
  });

  // Theme toggle
  themeToggle.addEventListener("click", toggleTheme);

  // Modal controls
  closeModalBtn.addEventListener("click", closeModal);
  detailModal.addEventListener("click", (e) => {
    if (e.target === detailModal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !detailModal.hidden) closeModal();
  });

  modalTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      modalTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.activeTab = tab.dataset.tab;
      renderModalPoints();
    });
  });

  // Scanner controls
  scanBtn.addEventListener("click", runClauseScanner);
  clearScannerBtn.addEventListener("click", () => {
    scannerInput.value = "";
    scannerResults.hidden = true;
    scannerResults.innerHTML = "";
  });

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const presetKey = btn.dataset.preset;
      if (PRESET_SNIPPETS[presetKey]) {
        scannerInput.value = PRESET_SNIPPETS[presetKey];
        runClauseScanner();
      }
    });
  });
}

// --------------------------------------------------------------------------
// API Client & Data Fetching
// --------------------------------------------------------------------------
async function performSearch(query) {
  showBanner("Searching ToS;DR database...", "info");
  resultsCount.textContent = "Fetching results...";

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    updateNodeBadge(res.headers.get("X-Server-Node"));

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${res.status}`);
    }

    const data = await res.json();
    state.services = data.services || [];
    hideBanner();
    resultsTitle.textContent = `Search Results for "${query}"`;
    renderServices();
  } catch (err) {
    showBanner(`Search failed: ${err.message}`, "error");
    resultsCount.textContent = "Error loading services";
  }
}

async function loadInitialServices() {
  resultsTitle.textContent = "Featured Platforms";
  resultsCount.textContent = "Loading seed platforms...";
  const collected = [];

  for (const name of INITIAL_QUERIES) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(name)}`);
      updateNodeBadge(res.headers.get("X-Server-Node"));
      if (res.ok) {
        const body = await res.json();
        if (body.services && body.services.length > 0) {
          // Grab the best matching item
          const match = body.services.find(s => s.name.toLowerCase() === name.toLowerCase()) || body.services[0];
          collected.push(match);
        }
      }
    } catch {
      // Continue fetching others if one fails
    }
  }

  state.services = collected;
  renderServices();
}

async function fetchServiceDetails(serviceId) {
  showBanner("Fetching comprehensive legal points...", "info");
  try {
    const res = await fetch(`/api/service?id=${encodeURIComponent(serviceId)}`);
    updateNodeBadge(res.headers.get("X-Server-Node"));

    if (!res.ok) {
      throw new Error(`Failed to load details (${res.status})`);
    }

    const data = await res.json();
    hideBanner();
    return data.service || null;
  } catch (err) {
    showBanner(`Could not load service details: ${err.message}`, "error");
    return null;
  }
}

// --------------------------------------------------------------------------
// Rendering Logic
// --------------------------------------------------------------------------
function renderServices() {
  let list = [...state.services];

  // 1. Grade filtering
  if (state.activeGrade !== "ALL") {
    list = list.filter((s) => {
      const grade = extractGrade(s);
      return grade === state.activeGrade;
    });
  }

  // 2. Sorting
  const gradeWeight = { E: 5, D: 4, C: 3, B: 2, A: 1, "N/A": 0 };
  if (state.sortMode === "worst-first") {
    list.sort((a, b) => (gradeWeight[extractGrade(b)] || 0) - (gradeWeight[extractGrade(a)] || 0));
  } else if (state.sortMode === "best-first") {
    list.sort((a, b) => (gradeWeight[extractGrade(a)] || 99) - (gradeWeight[extractGrade(b)] || 99));
  } else if (state.sortMode === "name-az") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  resultsCount.textContent = `Showing ${list.length} of ${state.services.length} services`;

  if (list.length === 0) {
    servicesGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
        <p style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">No services match your criteria</p>
        <p style="color: var(--text-muted);">Try selecting "All" grades or searching for a different service name.</p>
      </div>
    `;
    return;
  }

  servicesGrid.innerHTML = list.map((svc) => {
    const grade = extractGrade(svc);
    const domain = (svc.urls && svc.urls[0]) ? svc.urls[0] : "";
    return `
      <article class="service-card" data-id="${svc.id}">
        <div class="card-top">
          <div>
            <h4 class="card-title">${escapeHtml(svc.name)}</h4>
            ${domain ? `<a href="https://${escapeHtml(domain)}" target="_blank" rel="noopener" class="card-url">${escapeHtml(domain)} ↗</a>` : ""}
          </div>
          <span class="grade-pill grade-${grade.replace("/", "")}" title="Privacy Grade ${grade}">
            ${grade}
          </span>
        </div>

        <div class="card-meta">
          <p>Status: ${svc.is_comprehensively_reviewed ? "✅ Comprehensively Reviewed" : "ℹ️ Community Monitored"}</p>
        </div>

        <div class="card-actions">
          <span style="font-size: 0.8rem; color: var(--text-dim);">ID: #${svc.id}</span>
          <button type="button" class="btn-inspect" onclick="inspectService('${svc.id}')">
            Inspect Fine Print →
          </button>
        </div>
      </article>
    `;
  }).join("");
}

// --------------------------------------------------------------------------
// Modal & Clause Inspection
// --------------------------------------------------------------------------
window.inspectService = async function(serviceId) {
  const fullData = await fetchServiceDetails(serviceId);
  if (!fullData) return;

  state.activeModalService = fullData;
  state.activeTab = "all";

  const grade = extractGrade(fullData);
  modalServiceName.textContent = fullData.name || "Service Audit";
  modalServiceUrls.textContent = (fullData.urls && fullData.urls.length) ? fullData.urls.join(", ") : "No official domains listed";
  modalGradeBadge.textContent = `Grade ${grade}`;
  modalGradeBadge.className = `grade-pill grade-${grade.replace("/", "")}`;

  // Update tabs
  modalTabs.forEach(t => t.classList.toggle("active", t.dataset.tab === "all"));
  
  // Calculate point metrics
  const points = fullData.points || [];
  const badCount = points.filter(p => ["bad", "blocker"].includes(p.case?.classification)).length;
  const neutralCount = points.filter(p => p.case?.classification === "neutral").length;
  const goodCount = points.filter(p => p.case?.classification === "good").length;

  countAll.textContent = points.length;
  countBad.textContent = badCount;
  countNeutral.textContent = neutralCount;
  countGood.textContent = goodCount;

  renderModalPoints();
  detailModal.hidden = false;
  document.body.style.overflow = "hidden";
};

function renderModalPoints() {
  if (!state.activeModalService) return;
  const allPoints = state.activeModalService.points || [];
  let filtered = allPoints;

  if (state.activeTab === "bad") {
    filtered = allPoints.filter(p => ["bad", "blocker"].includes(p.case?.classification));
  } else if (state.activeTab === "neutral") {
    filtered = allPoints.filter(p => p.case?.classification === "neutral");
  } else if (state.activeTab === "good") {
    filtered = allPoints.filter(p => p.case?.classification === "good");
  }

  if (filtered.length === 0) {
    modalPointsList.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">No clauses found under this category.</p>`;
    return;
  }

  modalPointsList.innerHTML = filtered.map(pt => {
    const classification = pt.case?.classification || "neutral";
    const caseTitle = pt.case?.title || pt.title || "Contract clause";
    const caseDesc = pt.case?.description || pt.analysis || "";
    const quote = pt.quoteText || "";

    return `
      <div class="point-item point-${classification}">
        <div class="point-header">
          <h5 class="point-title">${escapeHtml(caseTitle)}</h5>
          <span class="badge-classification ${classification}">${classification}</span>
        </div>
        ${caseDesc ? `<p class="point-desc">${escapeHtml(caseDesc)}</p>` : ""}
        ${quote ? `<blockquote class="point-quote">“${escapeHtml(quote)}”</blockquote>` : ""}
      </div>
    `;
  }).join("");
}

function closeModal() {
  detailModal.hidden = true;
  document.body.style.overflow = "";
}

// --------------------------------------------------------------------------
// Quick Clause Scanner (Regex Trap Engine)
// --------------------------------------------------------------------------
function runClauseScanner() {
  const text = scannerInput.value.trim();
  if (!text) {
    showBanner("Please paste a fine print or contract excerpt first.", "error");
    return;
  }

  // Regex patterns detecting classic contract traps
  const rules = [
    {
      id: "arbitration",
      name: "Forced Arbitration & Class Action Waiver",
      severity: "danger",
      pattern: /\b(arbitration|class\s+action\s+waiver|waive\s+(any\s+)?right\s+to\s+bring\s+a\s+class|disputes?\s+settled\s+by\s+arbitration)\b/i,
      desc: "Forces disputes into private corporate arbitration and forfeits your constitutional right to sue in court or join a class action."
    },
    {
      id: "unilateral",
      name: "Unilateral Modification Without Notice",
      severity: "warning",
      pattern: /\b(modify|change|alter|update|amend)\s+these\s+terms\s+(at\s+any\s+time|without\s+(prior\s+)?notice)\b/i,
      desc: "Allows the company to change the rules at any moment without notifying you directly."
    },
    {
      id: "copyright",
      name: "Perpetual & Irrevocable License Grant",
      severity: "danger",
      pattern: /\b(perpetual|irrevocable|worldwide|royalty[- ]free)\s+(license|right)\b/i,
      desc: "Grants the platform perpetual rights to keep, monetize, or train systems on content you upload even if you delete your account."
    },
    {
      id: "data-selling",
      name: "Third-Party Data Sharing / Sale",
      severity: "danger",
      pattern: /\b(share|sell|transfer|disclose)\s+(your\s+)?(personal\s+)?data\s+to\s+third\s+parties\b/i,
      desc: "Permits transferring your personal browsing habits, device data, or identity to external brokers and advertisers."
    },
    {
      id: "as-is",
      name: "Total Liability Disclaimer & 'As-Is' Clause",
      severity: "warning",
      pattern: /\b(as[- ]is\s+without\s+warranty|no\s+liability\s+for\s+damages|disclaim\s+all\s+warranties)\b/i,
      desc: "Company takes zero responsibility if their software corrupts data, leaks accounts, or fails."
    }
  ];

  const matched = [];
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      matched.push(rule);
    }
  }

  scannerResults.hidden = false;
  if (matched.length > 0) {
    const isDanger = matched.some(m => m.severity === "danger");
    scannerResults.className = `scanner-results ${isDanger ? "danger" : "warning"}`;
    scannerResults.innerHTML = `
      <h4 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 0.5rem; color: var(--text-main);">
        🚨 ${matched.length} High-Risk Clause Pattern(s) Detected!
      </h4>
      <div style="margin-bottom: 0.8rem;">
        ${matched.map(m => `<span class="trap-tag">${m.name}</span>`).join("")}
      </div>
      <ul style="list-style-type: disc; margin-left: 1.4rem; font-size: 0.9rem; color: var(--text-muted);">
        ${matched.map(m => `<li style="margin-bottom: 0.4rem;"><strong>${m.name}:</strong> ${m.desc}</li>`).join("")}
      </ul>
    `;
  } else {
    scannerResults.className = "scanner-results clean";
    scannerResults.innerHTML = `
      <h4 style="font-size: 1.1rem; font-weight: 800; color: var(--grade-a); margin-bottom: 0.3rem;">
        ✅ No Common Predatory Traps Detected
      </h4>
      <p style="font-size: 0.9rem; color: var(--text-muted);">
        This excerpt did not match standard patterns for forced arbitration, copyright seizure, or unilateral change clauses.
      </p>
    `;
  }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function extractGrade(svc) {
  if (!svc) return "N/A";
  if (typeof svc.rating === "string") return svc.rating;
  if (svc.rating && svc.rating.letter) return svc.rating.letter;
  if (svc.rating && svc.rating.human) return svc.rating.human;
  return "N/A";
}

function updateNodeBadge(nodeId) {
  if (nodeId && nodeNameEl) {
    nodeNameEl.textContent = nodeId;
  }
}

function showBanner(message, type = "info") {
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}`;
  statusBanner.hidden = false;
}

function hideBanner() {
  statusBanner.hidden = true;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initTheme() {
  const saved = localStorage.getItem("lightprint_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeUi(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("lightprint_theme", next);
  updateThemeUi(next);
}

function updateThemeUi(theme) {
  if (theme === "dark") {
    themeIcon.textContent = "🌙";
    themeLabel.textContent = "Dark";
  } else {
    themeIcon.textContent = "☀️";
    themeLabel.textContent = "Light";
  }
}
