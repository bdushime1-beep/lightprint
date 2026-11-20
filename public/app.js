// ==========================================================================
// LightPrint — Fine Print & Terms of Service Reader
// Architecture: Vanilla ES6 / DOM Controller / Heuristic Engine / Offline-Ready
// ==========================================================================

const state = {
  services: [],
  activeGrade: "ALL",
  sortMode: "worst-first",
  activeModalService: null,
  activeTab: "all",
  searchDebounceTimer: null
};

// Preset sample excerpts for contract & lease scanner
const PRESET_SNIPPETS = {
  arbitration: "You and the Company agree that any dispute, claim, or controversy arising out of or relating to these Terms shall be settled by binding arbitration on an individual basis, and you waive any right to bring or participate in a class action lawsuit.",
  unilateral: "We reserve the right, at our sole discretion, to modify, replace, or update these Terms of Service at any time without prior notice to you. Your continued use of the platform constitutes acceptance of all revised terms.",
  copyright: "By submitting, posting, or displaying content on or through the Services, you grant us a worldwide, non-exclusive, perpetual, irrevocable, royalty-free license (with the right to sublicense) to use, copy, reproduce, process, adapt, modify, publish, transmit, display, and distribute such content in any and all media.",
  sharing: "We may share, transfer, or sell your personal information, including browsing history, IP address, device identifiers, and location data, to third-party advertising partners, data brokers, and affiliates for commercial profiling.",
  lease: "Tenant hereby expressly waives any and all claims against Landlord for property damage, personal injury, or disruption arising from any condition of the premises, including Landlord's active negligence. Landlord reserves the unconditional right to enter the leased unit at any hour without prior notice."
};

// DOM Elements
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");
const searchBtn = document.getElementById("searchBtn");
const resetAllBtn = document.getElementById("resetAllBtn");

const servicesTableBody = document.getElementById("servicesTableBody");
const resultsCount = document.getElementById("resultsCount");
const resultsTitle = document.getElementById("resultsTitle");
const statusBanner = document.getElementById("statusBanner");

const gradeFilterBtns = document.querySelectorAll(".grade-filter-btn");
const sortSelect = document.getElementById("sortSelect");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const nodeNameEl = document.getElementById("nodeName");

// Theme Switch
const btnThemeLight = document.getElementById("btnThemeLight");
const btnThemeDark = document.getElementById("btnThemeDark");

// Modal
const detailModal = document.getElementById("detailModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalServiceName = document.getElementById("modalServiceName");
const modalServiceUrls = document.getElementById("modalServiceUrls");
const modalGradeBadge = document.getElementById("modalGradeBadge");
const modalPointsList = document.getElementById("modalPointsList");
const modalTabs = document.querySelectorAll(".modal-filter-btn");
const countAll = document.getElementById("countAll");
const countBad = document.getElementById("countBad");
const countNeutral = document.getElementById("countNeutral");
const countGood = document.getElementById("countGood");

// Scanner
const scannerInput = document.getElementById("scannerInput");
const scanBtn = document.getElementById("scanBtn");
const clearScannerBtn = document.getElementById("clearScannerBtn");
const scannerResults = document.getElementById("scannerResults");
const presetButtons = document.querySelectorAll(".preset-pill");

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  closeModal();
  setupEventListeners();
  loadInitialServices();
});

function setupEventListeners() {
  // Real-time search with debounce
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      if (clearBtn) clearBtn.hidden = val.length === 0;
      clearTimeout(state.searchDebounceTimer);
      if (val.length >= 2) {
        state.searchDebounceTimer = setTimeout(() => performSearch(val), 260);
      } else if (val.length === 0) {
        loadInitialServices();
      }
    });
  }

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      clearBtn.hidden = true;
      loadInitialServices();
    });
  }

  // Search form submit
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = searchInput ? searchInput.value.trim() : "";
      if (val) performSearch(val);
    });
  }

  // Global "Reset All" button
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", resetAll);
  }

  // Quick chips
  document.querySelectorAll(".chip-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const query = btn.dataset.query;
      if (searchInput) searchInput.value = query;
      if (clearBtn) clearBtn.hidden = false;
      performSearch(query);
    });
  });

  // Grade filter buttons
  gradeFilterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      gradeFilterBtns.forEach((b) => b.classList.remove("active"));
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

  // Reset filters button
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", resetFilters);
  }

  // Theme switch listeners
  if (btnThemeLight) {
    btnThemeLight.addEventListener("click", () => setTheme("light"));
  }
  if (btnThemeDark) {
    btnThemeDark.addEventListener("click", () => setTheme("dark"));
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
    if (e.key === "Escape" && detailModal && detailModal.style.display !== "none") {
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
    clearScannerBtn.addEventListener("click", clearScanner);
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
// Reset Actions
// --------------------------------------------------------------------------
function resetAll() {
  if (searchInput) searchInput.value = "";
  if (clearBtn) clearBtn.hidden = true;
  state.activeGrade = "ALL";
  state.sortMode = "worst-first";

  gradeFilterBtns.forEach((b) => b.classList.toggle("active", b.dataset.grade === "ALL"));
  if (sortSelect) sortSelect.value = "worst-first";

  hideStatusBar();
  loadInitialServices();
}

function resetFilters() {
  state.activeGrade = "ALL";
  state.sortMode = "worst-first";

  gradeFilterBtns.forEach((b) => b.classList.toggle("active", b.dataset.grade === "ALL"));
  if (sortSelect) sortSelect.value = "worst-first";

  renderTable();
}

function clearScanner() {
  if (scannerInput) scannerInput.value = "";
  if (scannerResults) {
    scannerResults.hidden = true;
    scannerResults.innerHTML = "";
  }
}

// --------------------------------------------------------------------------
// Theme Manager
// --------------------------------------------------------------------------
function initTheme() {
  let saved = "light";
  try {
    saved = localStorage.getItem("lightprint_theme") || "light";
  } catch(e) {}
  setTheme(saved, false);
}

function setTheme(theme, persist = true) {
  const chosen = (theme === "dark") ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", chosen);
  
  if (persist) {
    try {
      localStorage.setItem("lightprint_theme", chosen);
    } catch(e) {}
  }

  if (btnThemeLight && btnThemeDark) {
    if (chosen === "light") {
      btnThemeLight.classList.add("active");
      btnThemeLight.setAttribute("aria-pressed", "true");
      btnThemeDark.classList.remove("active");
      btnThemeDark.setAttribute("aria-pressed", "false");
    } else {
      btnThemeDark.classList.add("active");
      btnThemeDark.setAttribute("aria-pressed", "true");
      btnThemeLight.classList.remove("active");
      btnThemeLight.setAttribute("aria-pressed", "false");
    }
  }
}

// --------------------------------------------------------------------------
// API Queries
// --------------------------------------------------------------------------
async function performSearch(query) {
  showStatusBar(`Searching legal terms database for "${query}"...`, "info");
  if (resultsCount) resultsCount.textContent = "Searching...";

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    updateNodeBadge(res.headers.get("X-Server-Node"));

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${res.status}`);
    }

    const data = await res.json();
    state.services = data.services || [];
    hideStatusBar();
    if (resultsTitle) resultsTitle.textContent = `Search Results: "${query}"`;
    renderTable();
  } catch (err) {
    showStatusBar(`Search failed: ${err.message}`, "error");
    if (resultsCount) resultsCount.textContent = "Error";
  }
}

async function loadInitialServices() {
  if (resultsTitle) resultsTitle.textContent = "Platform Privacy Ratings";
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
    // Fallback if network offline
  }

  performSearch("Spotify");
}

async function fetchServiceDetails(serviceId) {
  showStatusBar(`Loading full audit points for platform #${serviceId}...`, "info");
  try {
    const res = await fetch(`/api/service?id=${encodeURIComponent(serviceId)}`);
    updateNodeBadge(res.headers.get("X-Server-Node"));

    if (!res.ok) {
      throw new Error(`Upstream returned ${res.status}`);
    }

    const data = await res.json();
    hideStatusBar();
    return data.service || null;
  } catch (err) {
    showStatusBar(`Could not load details: ${err.message}`, "error");
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
    resultsCount.textContent = `${list.length} platform${list.length === 1 ? "" : "s"}`;
  }

  if (list.length === 0) {
    servicesTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
          No platforms found matching the selected filter. Try clicking <strong>Reset Filters</strong>.
        </td>
      </tr>
    `;
    return;
  }

  const gradeLabels = {
    A: "Grade A · Very Safe",
    B: "Grade B · Good",
    C: "Grade C · Average",
    D: "Grade D · Concerning",
    E: "Grade E · High Risk",
    "N/A": "Grade N/A"
  };

  servicesTableBody.innerHTML = list.map((svc) => {
    const grade = extractGrade(svc);
    const domain = (svc.urls && svc.urls[0]) ? svc.urls[0] : "";
    const summary = svc.summary || (svc.is_comprehensively_reviewed ? "Reviewed by privacy advocates and legal researchers." : "Basic community monitored terms indexed.");
    const initial = (svc.name && svc.name[0]) ? svc.name[0].toUpperCase() : "P";
    const gradeLabel = gradeLabels[grade] || `Grade ${grade}`;

    return `
      <tr>
        <td>
          <div class="cell-service-info">
            <div class="service-monogram">${initial}</div>
            <div>
              <span class="service-name">${escapeHtml(svc.name)}</span>
              ${domain ? `<span class="service-domain">${escapeHtml(domain)}</span>` : ""}
            </div>
          </div>
        </td>
        <td>
          <span class="grade-pill grade-${grade.replace("/", "")}">
            ${gradeLabel}
          </span>
        </td>
        <td>
          <span class="review-status-tag">
            ${svc.is_comprehensively_reviewed ? "Audited" : "Monitored"}
          </span>
        </td>
        <td style="max-width: 400px;">
          <span style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.45; display: block;">
            ${escapeHtml(summary)}
          </span>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn-view-details" onclick="inspectService('${svc.id}')">
            <span>View Details</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square">
              <path d="M7 17L17 7M17 7H7M17 7V17"/>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// --------------------------------------------------------------------------
// Modal Dialog (Platform Details)
// --------------------------------------------------------------------------
window.inspectService = async function(serviceId) {
  const fullData = await fetchServiceDetails(serviceId);
  if (!fullData) return;

  state.activeModalService = fullData;
  state.activeTab = "all";

  const grade = extractGrade(fullData);
  if (modalServiceName) modalServiceName.textContent = fullData.name || "Platform Details";
  if (modalServiceUrls) {
    modalServiceUrls.textContent = (fullData.urls && fullData.urls.length) ? fullData.urls.join(", ") : "Digital service agreement";
  }
  if (modalGradeBadge) {
    modalGradeBadge.textContent = `GRADE ${grade}`;
    modalGradeBadge.className = `grade-pill grade-${grade.replace("/", "")}`;
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
    modalPointsList.innerHTML = `<p style="font-size: 0.82rem; text-align: center; color: var(--text-faint); padding: 2rem 0;">No recorded clauses under this category.</p>`;
    return;
  }

  modalPointsList.innerHTML = filtered.map(pt => {
    const classification = pt.case?.classification || "neutral";
    const caseTitle = pt.case?.title || pt.title || "Terms Clause";
    const caseDesc = pt.case?.description || pt.analysis || "";
    const quote = pt.quoteText || "";

    const tagLabel = classification === "bad" || classification === "blocker" ? "Red Flag" : classification === "good" ? "Good Point" : "Neutral";

    return `
      <div class="clause-card ${classification}">
        <div class="clause-card-title">
          <span>${escapeHtml(caseTitle)}</span>
          <span class="grade-pill grade-${classification === 'bad' || classification === 'blocker' ? 'E' : classification === 'good' ? 'A' : 'NA'}" style="font-size: 0.68rem; padding: 0.12rem 0.4rem;">
            ${tagLabel}
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
window.closeModal = closeModal;

// --------------------------------------------------------------------------
// Heuristic Clause Scanner
// --------------------------------------------------------------------------
function runClauseScanner() {
  if (!scannerInput || !scannerResults) return;
  const text = scannerInput.value.trim();
  if (!text) {
    showStatusBar("Please paste contract terms into the box before scanning.", "error");
    return;
  }

  const rules = [
    {
      id: "arbitration",
      name: "Forced Arbitration & Class Action Waiver",
      severity: "danger",
      pattern: /\b(arbitration|class\s+action\s+waiver|waive\s+(any\s+)?right\s+to\s+bring\s+a\s+class|disputes?\s+settled\s+by\s+arbitration)\b/i,
      desc: "You forfeit your constitutional right to take the company to court or join a class action lawsuit."
    },
    {
      id: "unilateral",
      name: "Terms Modified Without Notice",
      severity: "warning",
      pattern: /\b(modify|change|alter|update|amend)\s+these\s+terms\s+(at\s+any\s+time|without\s+(prior\s+)?notice)\b/i,
      desc: "The company claims the right to change the rules at any time without emailing or alerting you directly."
    },
    {
      id: "copyright",
      name: "Perpetual License Over Your Content",
      severity: "danger",
      pattern: /\b(perpetual|irrevocable|worldwide|royalty[- ]free)\s+(license|right)\b/i,
      desc: "You grant them a permanent right to distribute, monetize, or use your uploaded content even if you delete your account."
    },
    {
      id: "data-selling",
      name: "Third-Party Data Selling & Brokerage",
      severity: "danger",
      pattern: /\b(share|sell|transfer|disclose)\s+(your\s+)?(personal\s+)?data\s+to\s+third\s+parties\b/i,
      desc: "They reserve the right to provide your personal information or browsing habits to external advertisers and data brokers."
    },
    {
      id: "lease",
      name: "Broad Landlord Indemnity & Waiver of Negligence",
      severity: "danger",
      pattern: /\b(waives?\s+(all\s+)?claims\s+against\s+landlord|landlord('s)?\s+(sole\s+)?negligence|enter\s+the\s+leased\s+premises\s+without\s+notice)\b/i,
      desc: "A predatory lease stipulation attempting to shield the landlord from legal responsibility for negligence or unannounced entry."
    },
    {
      id: "as-is",
      name: "Complete Liability Disclaimer ('As-Is')",
      severity: "warning",
      pattern: /\b(as[- ]is\s+without\s+warranty|no\s+liability\s+for\s+damages|disclaim\s+all\s+warranties)\b/i,
      desc: "They take zero legal responsibility if their service breaks, loses your files, or suffers a security breach."
    }
  ];

  const matched = rules.filter(r => r.pattern.test(text));

  scannerResults.hidden = false;
  if (matched.length > 0) {
    const isDanger = matched.some(m => m.severity === "danger");
    scannerResults.className = `verdict-container ${isDanger ? "danger" : "warning"}`;
    scannerResults.innerHTML = `
      <p style="font-weight: 800; font-size: 0.9rem; margin-bottom: 0.45rem;">
        Warning: ${matched.length} concerning legal clause${matched.length === 1 ? "" : "s"} detected in this excerpt:
      </p>
      <div style="margin-bottom: 0.6rem;">
        ${matched.map(m => `<span class="tag-clause-flag">${m.name}</span>`).join("")}
      </div>
      <ul style="list-style-type: square; margin-left: 1.25rem; font-size: 0.82rem; line-height: 1.55;">
        ${matched.map(m => `<li style="margin-bottom: 0.35rem;"><strong>${m.name}:</strong> ${m.desc}</li>`).join("")}
      </ul>
    `;
  } else {
    scannerResults.className = "verdict-container clean";
    scannerResults.innerHTML = `
      <p style="font-weight: 800; font-size: 0.9rem;">
        Clean: Zero common predatory traps detected.
      </p>
      <p style="font-size: 0.82rem; margin-top: 0.25rem;">
        The pasted text contains no common signatures for forced arbitration, copyright seizure, or unilateral alteration clauses.
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

function showStatusBar(message, type = "info") {
  if (!statusBanner) return;
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}`;
  statusBanner.hidden = false;
}

function hideStatusBar() {
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