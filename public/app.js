// ==========================================================================
// LightPrint — Frontend Dashboard Engine (Ref: Clean Modern Dashboard)
// Architecture: Vanilla ES6 Modules / Table Rendering / Heuristic Scanner
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
const globalSearchInput = document.getElementById("globalSearchInput");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");
const servicesTableBody = document.getElementById("servicesTableBody");
const resultsCount = document.getElementById("resultsCount");
const resultsTitle = document.getElementById("resultsTitle");
const statusBanner = document.getElementById("statusBanner");
const sortSelect = document.getElementById("sortSelect");
const gradeTabButtons = document.querySelectorAll(".grade-tab-btn");
const nodeNameEl = document.getElementById("nodeName");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeLabel = document.getElementById("themeLabel");

// Modal References
const detailModal = document.getElementById("detailModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalServiceName = document.getElementById("modalServiceName");
const modalServiceUrls = document.getElementById("modalServiceUrls");
const modalGradeBadge = document.getElementById("modalGradeBadge");
const modalPointsList = document.getElementById("modalPointsList");
const modalTabs = document.querySelectorAll(".modal-tab-pill");
const countAll = document.getElementById("countAll");
const countBad = document.getElementById("countBad");
const countNeutral = document.getElementById("countNeutral");
const countGood = document.getElementById("countGood");

// Scanner References
const scannerInput = document.getElementById("scannerInput");
const scanBtn = document.getElementById("scanBtn");
const clearScannerBtn = document.getElementById("clearScannerBtn");
const scannerResults = document.getElementById("scannerResults");
const presetButtons = document.querySelectorAll(".preset-tag-btn");

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Ensure modal is completely closed on initial boot
  closeModal();

  setupEventListeners();
  loadInitialServices();
});

function setupEventListeners() {
  // Global search input in topbar
  if (globalSearchInput) {
    globalSearchInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      if (searchInput) searchInput.value = val;
      clearTimeout(state.searchDebounceTimer);
      if (val.length >= 2) {
        state.searchDebounceTimer = setTimeout(() => performSearch(val), 300);
      } else if (val.length === 0) {
        loadInitialServices();
      }
    });
  }

  // Main banner search input
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      if (globalSearchInput) globalSearchInput.value = val;
      if (clearBtn) clearBtn.hidden = val.length === 0;
      clearTimeout(state.searchDebounceTimer);
      if (val.length >= 2) {
        state.searchDebounceTimer = setTimeout(() => performSearch(val), 300);
      } else if (val.length === 0) {
        loadInitialServices();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (globalSearchInput) globalSearchInput.value = "";
      clearBtn.hidden = true;
      loadInitialServices();
    });
  }

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = searchInput ? searchInput.value.trim() : "";
      if (val) performSearch(val);
    });
  }

  // Quick chips
  document.querySelectorAll(".chip-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.query;
      if (searchInput) searchInput.value = q;
      if (globalSearchInput) globalSearchInput.value = q;
      if (clearBtn) clearBtn.hidden = false;
      performSearch(q);
    });
  });

  // Grade filter tabs
  gradeTabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      gradeTabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeGrade = btn.dataset.grade;
      renderTable();
    });
  });

  // Sort selector
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      state.sortMode = e.target.value;
      renderTable();
    });
  }

  // Theme toggle
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  // Modal interactions
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }
  if (detailModal) {
    detailModal.addEventListener("click", (e) => {
      if (e.target === detailModal) closeModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && detailModal && !detailModal.hidden) {
      closeModal();
    }
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
  if (scanBtn) scanBtn.addEventListener("click", runClauseScanner);
  if (clearScannerBtn) {
    clearScannerBtn.addEventListener("click", () => {
      if (scannerInput) scannerInput.value = "";
      if (scannerResults) {
        scannerResults.hidden = true;
        scannerResults.innerHTML = "";
      }
    });
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const presetKey = btn.dataset.preset;
      if (PRESET_SNIPPETS[presetKey] && scannerInput) {
        scannerInput.value = PRESET_SNIPPETS[presetKey];
        runClauseScanner();
      }
    });
  });
}

// --------------------------------------------------------------------------
// API Client
// --------------------------------------------------------------------------
async function performSearch(query) {
  showToast(`Searching ToS;DR database for "${query}"...`, "info");
  if (resultsCount) resultsCount.textContent = "Querying...";

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    updateNodeBadge(res.headers.get("X-Server-Node"));

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned ${res.status}`);
    }

    const data = await res.json();
    state.services = data.services || [];
    hideToast();
    if (resultsTitle) resultsTitle.textContent = `Search Results: "${query}"`;
    renderTable();
  } catch (err) {
    showToast(`Search failed: ${err.message}`, "error");
    if (resultsCount) resultsCount.textContent = "Communication error";
  }
}

async function loadInitialServices() {
  if (resultsTitle) resultsTitle.textContent = "Platform Privacy Audits";
  if (resultsCount) resultsCount.textContent = "Loading...";

  try {
    const res = await fetch("/api/featured");
    updateNodeBadge(res.headers.get("X-Server-Node"));

    if (res.ok) {
      const data = await res.json();
      state.services = data.services || [];
      renderTable();
      return;
    }
  } catch {
    // If /api/featured is unavailable, fallback to search
  }

  performSearch("Spotify");
}

async function fetchServiceDetails(serviceId) {
  showToast(`Auditing platform details #${serviceId}...`, "info");
  try {
    const res = await fetch(`/api/service?id=${encodeURIComponent(serviceId)}`);
    updateNodeBadge(res.headers.get("X-Server-Node"));

    if (!res.ok) {
      throw new Error(`Upstream returned ${res.status}`);
    }

    const data = await res.json();
    hideToast();
    return data.service || null;
  } catch (err) {
    showToast(`Audit failed: ${err.message}`, "error");
    return null;
  }
}

// --------------------------------------------------------------------------
// Table Rendering
// --------------------------------------------------------------------------
function renderTable() {
  if (!servicesTableBody) return;
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

  if (resultsCount) {
    resultsCount.textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;
  }

  if (list.length === 0) {
    servicesTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <p style="font-weight: 600; font-size: 0.95rem;">No platforms match the selected filter</p>
          <p style="font-size: 0.82rem; color: var(--text-faint); margin-top: 0.25rem;">Try selecting "All" or entering a different search term.</p>
        </td>
      </tr>
    `;
    return;
  }

  servicesTableBody.innerHTML = list.map((svc) => {
    const grade = extractGrade(svc);
    const domain = (svc.urls && svc.urls[0]) ? svc.urls[0] : "";
    const summary = svc.summary || (svc.is_comprehensively_reviewed ? "Subject to comprehensive review by legal researchers." : "Community monitored platform; baseline terms indexed.");
    const initial = (svc.name && svc.name[0]) ? svc.name[0].toUpperCase() : "P";

    return `
      <tr>
        <td>
          <div class="service-cell">
            <div class="service-icon-box">${initial}</div>
            <div>
              <span class="service-name-text">${escapeHtml(svc.name)}</span>
              ${domain ? `<span class="service-domain-text">${escapeHtml(domain)}</span>` : ""}
            </div>
          </div>
        </td>
        <td>
          <span class="grade-pill-soft grade-${grade.replace("/", "")}">
            Grade ${grade}
          </span>
        </td>
        <td>
          <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 500;">
            ${svc.is_comprehensively_reviewed ? "✅ Reviewed" : "ℹ️ Monitored"}
          </span>
        </td>
        <td style="max-width: 380px;">
          <span style="font-size: 0.84rem; color: var(--text-muted); line-height: 1.4; display: block;">
            ${escapeHtml(summary)}
          </span>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn-table-action" onclick="inspectService('${svc.id}')">
            View Details →
          </button>
        </td>
      </tr>
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
  if (modalServiceName) modalServiceName.textContent = fullData.name || "Platform Details";
  if (modalServiceUrls) {
    modalServiceUrls.textContent = `DOSSIER #${fullData.id || serviceId} • ${(fullData.urls && fullData.urls.length) ? fullData.urls.join(", ") : "No domain"}`;
  }
  if (modalGradeBadge) {
    modalGradeBadge.textContent = `Grade ${grade}`;
    modalGradeBadge.className = `grade-pill-soft grade-${grade.replace("/", "")}`;
  }

  modalTabs.forEach(t => t.classList.toggle("active", t.dataset.tab === "all"));
  
  const points = fullData.points || [];
  const badCount = points.filter(p => ["bad", "blocker"].includes(p.case?.classification)).length;
  const neutralCount = points.filter(p => p.case?.classification === "neutral").length;
  const goodCount = points.filter(p => p.case?.classification === "good").length;

  if (countAll) countAll.textContent = points.length;
  if (countBad) countBad.textContent = badCount;
  if (countNeutral) countNeutral.textContent = neutralCount;
  if (countGood) countGood.textContent = goodCount;

  renderModalPoints();

  // Safely show modal
  if (detailModal) {
    detailModal.removeAttribute("hidden");
    detailModal.style.display = "flex";
  }
  document.body.style.overflow = "hidden";
};

function renderModalPoints() {
  if (!modalPointsList || !state.activeModalService) return;
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
    modalPointsList.innerHTML = `<p style="text-align: center; color: var(--text-faint); padding: 2.5rem 0; font-size: 0.9rem;">No recorded clauses under this tab.</p>`;
    return;
  }

  modalPointsList.innerHTML = filtered.map(pt => {
    const classification = pt.case?.classification || "neutral";
    const caseTitle = pt.case?.title || pt.title || "Contract clause";
    const caseDesc = pt.case?.description || pt.analysis || "";
    const quote = pt.quoteText || "";

    return `
      <div class="clause-card-mini ${classification}">
        <div class="clause-card-top">
          <h4>${escapeHtml(caseTitle)}</h4>
          <span class="grade-pill-soft grade-${classification === 'bad' || classification === 'blocker' ? 'E' : classification === 'good' ? 'A' : 'NA'}" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">
            ${classification}
          </span>
        </div>
        ${caseDesc ? `<p class="clause-card-desc">${escapeHtml(caseDesc)}</p>` : ""}
        ${quote ? `<p class="clause-card-quote">“${escapeHtml(quote)}”</p>` : ""}
      </div>
    `;
  }).join("");
}

function closeModal() {
  if (detailModal) {
    detailModal.setAttribute("hidden", "true");
    detailModal.style.display = "none";
  }
  document.body.style.overflow = "";
}

// --------------------------------------------------------------------------
// Clause Scanner (Regex Engine)
// --------------------------------------------------------------------------
function runClauseScanner() {
  if (!scannerInput || !scannerResults) return;
  const text = scannerInput.value.trim();
  if (!text) {
    showToast("Please paste contract terms into the box before scanning.", "error");
    return;
  }

  const rules = [
    {
      id: "arbitration",
      name: "Forced Arbitration & Class Action Waiver",
      severity: "danger",
      pattern: /\b(arbitration|class\s+action\s+waiver|waive\s+(any\s+)?right\s+to\s+bring\s+a\s+class|disputes?\s+settled\s+by\s+arbitration)\b/i,
      desc: "Forfeits constitutional rights to civil court and prohibits collective class action litigation against the corporation."
    },
    {
      id: "unilateral",
      name: "Unilateral Alteration Without Direct Notice",
      severity: "warning",
      pattern: /\b(modify|change|alter|update|amend)\s+these\s+terms\s+(at\s+any\s+time|without\s+(prior\s+)?notice)\b/i,
      desc: "Grants the operator authority to alter contract stipulations at any time without notifying users directly."
    },
    {
      id: "copyright",
      name: "Perpetual & Irrevocable Copyright Seizure",
      severity: "danger",
      pattern: /\b(perpetual|irrevocable|worldwide|royalty[- ]free)\s+(license|right)\b/i,
      desc: "Grants permanent commercial licensing rights over user content, surviving account termination."
    },
    {
      id: "data-selling",
      name: "Third-Party Advertising Data Brokerage",
      severity: "danger",
      pattern: /\b(share|sell|transfer|disclose)\s+(your\s+)?(personal\s+)?data\s+to\s+third\s+parties\b/i,
      desc: "Authorizes distribution of telemetry, location, or user identifiers to commercial advertising exchanges."
    },
    {
      id: "as-is",
      name: "Disclaimer of All Liability ('As-Is')",
      severity: "warning",
      pattern: /\b(as[- ]is\s+without\s+warranty|no\s+liability\s+for\s+damages|disclaim\s+all\s+warranties)\b/i,
      desc: "Total indemnity for system failures, data corruption, or unauthorized security breaches."
    }
  ];

  const matched = rules.filter(r => r.pattern.test(text));

  scannerResults.hidden = false;
  if (matched.length > 0) {
    const isDanger = matched.some(m => m.severity === "danger");
    scannerResults.className = `verdict-box ${isDanger ? "danger" : "warning"}`;
    scannerResults.innerHTML = `
      <p style="font-weight: 700; margin-bottom: 0.5rem; color: #991b1b;">
        ⚠️ ${matched.length} High-Risk Legal Traps Detected in Text:
      </p>
      <div style="margin-bottom: 0.75rem;">
        ${matched.map(m => `<span class="trap-pill-badge">${m.name}</span>`).join("")}
      </div>
      <ul style="list-style-type: disc; margin-left: 1.25rem; font-size: 0.85rem; color: #7f1d1d; line-height: 1.5;">
        ${matched.map(m => `<li style="margin-bottom: 0.3rem;"><strong>${m.name}:</strong> ${m.desc}</li>`).join("")}
      </ul>
    `;
  } else {
    scannerResults.className = "verdict-box clean";
    scannerResults.innerHTML = `
      <p style="font-weight: 700; color: #166534; margin-bottom: 0.25rem;">
        ✅ Clean Excerpt: No Standard Predatory Traps Found
      </p>
      <p style="color: #14532d; font-size: 0.85rem;">
        The supplied text contains no matching regex signatures for forced arbitration, copyright forfeiture, or unilateral change clauses.
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
    nodeNameEl.textContent = nodeId;
  }
}

function showToast(message, type = "info") {
  if (!statusBanner) return;
  statusBanner.textContent = message;
  statusBanner.className = `status-toast ${type}`;
  statusBanner.hidden = false;
}

function hideToast() {
  if (statusBanner) statusBanner.hidden = true;
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

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  if (themeLabel) themeLabel.textContent = next === "dark" ? "Light" : "Dark";
  if (themeIcon) themeIcon.textContent = next === "dark" ? "☀️" : "🌙";
}
