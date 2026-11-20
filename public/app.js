// ==========================================================================
// LightPrint — Client-Side Application Logic
// Architecture: Vanilla ES6 Modules / DOM Orchestration / Regex Scanner
// ==========================================================================

const state = {
  services: [],
  activeGrade: "ALL",
  sortMode: "worst-first",
  activeModalService: null,
  activeTab: "all",
  searchDebounceTimer: null
};

// Preset sample excerpts for the live clause scanner
const PRESET_SNIPPETS = {
  arbitration: "You and the Company agree that any dispute, claim, or controversy arising out of or relating to these Terms shall be settled by binding arbitration on an individual basis, and you waive any right to bring or participate in a class action lawsuit.",
  unilateral: "We reserve the right, at our sole discretion, to modify, replace, or update these Terms of Service at any time without prior notice to you. Your continued use of the platform constitutes acceptance of all revised terms.",
  copyright: "By submitting, posting, or displaying content on or through the Services, you grant us a worldwide, non-exclusive, perpetual, irrevocable, royalty-free license (with the right to sublicense) to use, copy, reproduce, process, adapt, modify, publish, transmit, display, and distribute such content in any and all media.",
  sharing: "We may share, transfer, or sell your personal information, including browsing history, IP address, device identifiers, and location data, to third-party advertising partners, data brokers, and affiliates for commercial profiling."
};

// DOM References
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");
const servicesGrid = document.getElementById("servicesGrid");
const resultsCount = document.getElementById("resultsCount");
const resultsTitle = document.getElementById("resultsTitle");
const statusBanner = document.getElementById("statusBanner");
const sortSelect = document.getElementById("sortSelect");
const filterButtons = document.querySelectorAll(".filter-btn");
const nodeNameEl = document.getElementById("nodeName");
const themeToggle = document.getElementById("themeToggle");
const themeLabel = document.getElementById("themeLabel");

// Modal References
const detailModal = document.getElementById("detailModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalServiceName = document.getElementById("modalServiceName");
const modalServiceUrls = document.getElementById("modalServiceUrls");
const modalGradeBadge = document.getElementById("modalGradeBadge");
const modalPointsList = document.getElementById("modalPointsList");
const modalTabs = document.querySelectorAll(".docket-tab");
const countAll = document.getElementById("countAll");
const countBad = document.getElementById("countBad");
const countNeutral = document.getElementById("countNeutral");
const countGood = document.getElementById("countGood");

// Scanner References
const scannerInput = document.getElementById("scannerInput");
const scanBtn = document.getElementById("scanBtn");
const clearScannerBtn = document.getElementById("clearScannerBtn");
const scannerResults = document.getElementById("scannerResults");
const presetButtons = document.querySelectorAll(".btn-sample");

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupEventListeners();
  loadInitialDossiers();
});

function setupEventListeners() {
  // Search box input handling
  searchInput.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    clearBtn.hidden = val.length === 0;
    clearTimeout(state.searchDebounceTimer);
    if (val.length >= 2) {
      state.searchDebounceTimer = setTimeout(() => performSearch(val), 300);
    } else if (val.length === 0) {
      loadInitialDossiers();
    }
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.hidden = true;
    searchInput.focus();
    loadInitialDossiers();
  });

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = searchInput.value.trim();
    if (val) performSearch(val);
  });

  // Quick reference tags
  document.querySelectorAll(".shortcut-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.query;
      searchInput.value = q;
      clearBtn.hidden = false;
      performSearch(q);
    });
  });

  // Grade filter buttons
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeGrade = btn.dataset.grade;
      renderServices();
    });
  });

  // Sorting
  sortSelect.addEventListener("change", (e) => {
    state.sortMode = e.target.value;
    renderServices();
  });

  // Theme toggle
  themeToggle.addEventListener("click", toggleTheme);

  // Modal interactions
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

  // Scanner actions
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
// API Queries
// --------------------------------------------------------------------------
async function performSearch(query) {
  showBanner(`QUERYING TOS;DR REGISTRY FOR "${query.toUpperCase()}"...`, "info");
  resultsCount.textContent = "QUERY IN PROGRESS...";

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    updateNodeBadge(res.headers.get("X-Server-Node"));

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server status ${res.status}`);
    }

    const data = await res.json();
    state.services = data.services || [];
    hideBanner();
    resultsTitle.textContent = `SEARCH RESULTS: "${query.toUpperCase()}"`;
    renderServices();
  } catch (err) {
    showBanner(`API ERROR: ${err.message}`, "error");
    resultsCount.textContent = "COMMUNICATION FAILURE";
  }
}

async function loadInitialDossiers() {
  resultsTitle.textContent = "INDEXED DOSSIERS";
  resultsCount.textContent = "SYNCHRONIZING WITH CLUSTER...";

  try {
    const res = await fetch("/api/featured");
    updateNodeBadge(res.headers.get("X-Server-Node"));

    if (res.ok) {
      const data = await res.json();
      state.services = data.services || [];
      renderServices();
      return;
    }
  } catch {
    // If backend fetch fails, fallback to local search
  }

  // Fallback direct search if /api/featured is unavailable
  performSearch("Spotify");
}

async function fetchServiceDetails(serviceId) {
  showBanner(`AUDITING DOSSIER #${serviceId}...`, "info");
  try {
    const res = await fetch(`/api/service?id=${encodeURIComponent(serviceId)}`);
    updateNodeBadge(res.headers.get("X-Server-Node"));

    if (!res.ok) {
      throw new Error(`Upstream rejected query (${res.status})`);
    }

    const data = await res.json();
    hideBanner();
    return data.service || null;
  } catch (err) {
    showBanner(`AUDIT FAILED: ${err.message}`, "error");
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
    list = list.filter((s) => extractGrade(s) === state.activeGrade);
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

  resultsCount.textContent = `${list.length} OF ${state.services.length} DOSSIERS ACTIVE`;

  if (list.length === 0) {
    servicesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; border: 1px dashed var(--border-ink);">
        <p style="font-family: var(--font-mono); font-size: 1rem; font-weight: 700;">// NO RECORDS FOUND MATCHING SPECIFIED CRITERIA</p>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.4rem;">Select [ ALL ] or enter a different company name.</p>
      </div>
    `;
    return;
  }

  servicesGrid.innerHTML = list.map((svc) => {
    const grade = extractGrade(svc);
    const domain = (svc.urls && svc.urls[0]) ? svc.urls[0] : "";
    const summary = svc.summary || (svc.is_comprehensively_reviewed ? "Subject to comprehensive legal audit by privacy researchers." : "Community monitored platform; baseline telemetry audited.");

    return `
      <article class="dossier-card" data-id="${svc.id}">
        <div>
          <div class="card-index-top">
            <div>
              <h4 class="service-title">${escapeHtml(svc.name)}</h4>
              ${domain ? `<a href="https://${escapeHtml(domain)}" target="_blank" rel="noopener" class="service-domain">${escapeHtml(domain)} ↗</a>` : ""}
            </div>
            <span class="grade-stamp grade-${grade.replace("/", "")}">
              GRADE [ ${grade} ]
            </span>
          </div>

          <p class="card-body-text">${escapeHtml(summary)}</p>
        </div>

        <div class="card-audit-footer">
          <span>REF: #${svc.id}</span>
          <button type="button" class="btn-open-dossier" onclick="inspectService('${svc.id}')">
            View Audit Dossier →
          </button>
        </div>
      </article>
    `;
  }).join("");
}

// --------------------------------------------------------------------------
// Modal Docket Logic
// --------------------------------------------------------------------------
window.inspectService = async function(serviceId) {
  const fullData = await fetchServiceDetails(serviceId);
  if (!fullData) return;

  state.activeModalService = fullData;
  state.activeTab = "all";

  const grade = extractGrade(fullData);
  modalServiceName.textContent = fullData.name || "LEGAL AUDIT DOSSIER";
  modalServiceUrls.textContent = `DOSSIER REF: #${fullData.id || serviceId} // ${fullData.urls ? fullData.urls.join(", ") : "NO DOMAIN RECORDED"}`;
  modalGradeBadge.textContent = `GRADE [ ${grade} ]`;
  modalGradeBadge.className = `grade-stamp grade-${grade.replace("/", "")}`;

  modalTabs.forEach(t => t.classList.toggle("active", t.dataset.tab === "all"));
  
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
    modalPointsList.innerHTML = `<p style="font-family: var(--font-mono); text-align: center; color: var(--text-muted); padding: 2.5rem 0;">// NO RECORDED CLAUSES IN THIS CATEGORY</p>`;
    return;
  }

  modalPointsList.innerHTML = filtered.map(pt => {
    const classification = pt.case?.classification || "neutral";
    const caseTitle = pt.case?.title || pt.title || "Contract clause";
    const caseDesc = pt.case?.description || pt.analysis || "";
    const quote = pt.quoteText || "";

    return `
      <div class="clause-item ${classification}">
        <div class="clause-header">
          <h5 class="clause-headline">${escapeHtml(caseTitle)}</h5>
          <span class="clause-stamp ${classification}">[ ${classification} ]</span>
        </div>
        ${caseDesc ? `<p class="clause-analysis">${escapeHtml(caseDesc)}</p>` : ""}
        ${quote ? `<p class="clause-verbatim">VERBATIM CONTRACT: “${escapeHtml(quote)}”</p>` : ""}
      </div>
    `;
  }).join("");
}

function closeModal() {
  detailModal.hidden = true;
  document.body.style.overflow = "";
}

// --------------------------------------------------------------------------
// Clause Scanner (Regex Engine)
// --------------------------------------------------------------------------
function runClauseScanner() {
  const text = scannerInput.value.trim();
  if (!text) {
    showBanner("INPUT REQUIRED: PLEASE PASTE A CONTRACT EXCERPT BEFORE EXECUTING AUDIT.", "error");
    return;
  }

  const rules = [
    {
      id: "arbitration",
      name: "FORCED ARBITRATION & CLASS ACTION WAIVER",
      severity: "danger",
      pattern: /\b(arbitration|class\s+action\s+waiver|waive\s+(any\s+)?right\s+to\s+bring\s+a\s+class|disputes?\s+settled\s+by\s+arbitration)\b/i,
      desc: "Forfeits constitutional access to civil court and prohibits collective class action litigation against the corporation."
    },
    {
      id: "unilateral",
      name: "UNILATERAL ALTERATION WITHOUT DIRECT NOTICE",
      severity: "warning",
      pattern: /\b(modify|change|alter|update|amend)\s+these\s+terms\s+(at\s+any\s+time|without\s+(prior\s+)?notice)\b/i,
      desc: "Grants the operator unilateral authority to alter contract stipulations without notifying users directly."
    },
    {
      id: "copyright",
      name: "PERPETUAL & IRREVOCABLE COPYRIGHT SEIZURE",
      severity: "danger",
      pattern: /\b(perpetual|irrevocable|worldwide|royalty[- ]free)\s+(license|right)\b/i,
      desc: "Grants permanent commercial licensing rights over user-created content, surviving account termination."
    },
    {
      id: "data-selling",
      name: "THIRD-PARTY ADVERTISING DATA BROKERAGE",
      severity: "danger",
      pattern: /\b(share|sell|transfer|disclose)\s+(your\s+)?(personal\s+)?data\s+to\s+third\s+parties\b/i,
      desc: "Authorizes distribution of telemetry, location, or user identifiers to commercial advertising exchanges."
    },
    {
      id: "as-is",
      name: "DISCLAIMER OF ALL OPERATIONAL LIABILITY ('AS-IS')",
      severity: "warning",
      pattern: /\b(as[- ]is\s+without\s+warranty|no\s+liability\s+for\s+damages|disclaim\s+all\s+warranties)\b/i,
      desc: "Total indemnity for system failures, data corruption, or unauthorized security breaches."
    }
  ];

  const matched = rules.filter(r => r.pattern.test(text));

  scannerResults.hidden = false;
  if (matched.length > 0) {
    const isDanger = matched.some(m => m.severity === "danger");
    scannerResults.className = `audit-verdict ${isDanger ? "danger" : "warning"}`;
    scannerResults.innerHTML = `
      <p style="font-weight: 800; font-size: 0.95rem; margin-bottom: 0.5rem; text-transform: uppercase;">
        ⚠ VERDICT: ${matched.length} PREDATORY LEGAL CLAUSE(S) IDENTIFIED
      </p>
      <div style="margin-bottom: 0.8rem;">
        ${matched.map(m => `<span class="redacted-tag">${m.name}</span>`).join("")}
      </div>
      <ul style="list-style-type: square; margin-left: 1.2rem; line-height: 1.6; color: var(--text-muted);">
        ${matched.map(m => `<li style="margin-bottom: 0.35rem;"><strong>${m.name}:</strong> ${m.desc}</li>`).join("")}
      </ul>
    `;
  } else {
    scannerResults.className = "audit-verdict clean";
    scannerResults.innerHTML = `
      <p style="font-weight: 800; color: var(--stamp-a); font-size: 0.95rem; text-transform: uppercase;">
        ✓ AUDIT PASSED: ZERO STANDARD TRAPS DETECTED
      </p>
      <p style="color: var(--text-muted); margin-top: 0.3rem;">
        The supplied excerpt contains no matching regex signatures for forced arbitration, copyright seizure, or unilateral alteration.
      </p>
    `;
  }
}

// --------------------------------------------------------------------------
// Utilities
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
    nodeNameEl.textContent = nodeId.toUpperCase();
  }
}

function showBanner(message, type = "info") {
  statusBanner.textContent = `// ${message}`;
  statusBanner.className = `audit-banner ${type}`;
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
  const saved = localStorage.getItem("lightprint_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeUi(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("lightprint_theme", next);
  updateThemeUi(next);
}

function updateThemeUi(theme) {
  if (theme === "dark") {
    themeLabel.textContent = "THEME: DARK";
  } else {
    themeLabel.textContent = "THEME: LIGHT";
  }
}
