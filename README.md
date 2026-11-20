# LightPrint — Terms of Service Unmasked

> **"Stop blindly clicking 'I Agree'."**  
> An accessible, distributed web application that unmasks predatory legal clauses, tracking traps, and forced arbitration hidden inside 50-page Terms of Service agreements.

* **Live Load Balancer URL:** [https://www.bdushime.tech](https://www.bdushime.tech) (and [https://bdushime.tech](https://bdushime.tech))  
* **Web01 Direct Node:** `http://web-01.bdushime.tech` (`13.135.166.102:80`)  
* **Web02 Direct Node:** `http://web-02.bdushime.tech` (`35.179.145.213:80`)  
* **Demo Video Walkthrough (<= 2 min):** [Watch on YouTube](https://youtu.be/placeholder-demo)  
* **GitHub Repository:** [https://github.com/bdushime1-beep/lightprint](https://github.com/bdushime1-beep/lightprint)  
* **Author:** B. Dushime (`b.dushime1@alustudent.com`)

---

## 1. Project Overview & Practical Purpose

The biggest collective lie in the digital world is: *"I have read and agree to the Terms of Service."* Modern digital contracts are intentionally drafted by corporate legal teams to be 40 to 60 pages long, discouraging user review while burying critical clauses such as:
1. **Forced Arbitration & Class Action Waivers**: Forfeiting your constitutional right to take a company to court.
2. **Perpetual Content Licensing**: Granting companies irrevocable, royalty-free rights to use and monetize your uploaded content.
3. **Third-Party Data Brokerage**: Legally allowing companies to sell your location and browsing logs to advertising syndicates.
4. **Unilateral Contract Alteration**: Permitting companies to change terms at any time with zero direct notice.

**LightPrint** solves this problem by pulling structured, audited legal intelligence from the public **ToS;DR (Terms of Service; Didn't Read) REST API** and coupling it with a **client-side regex contract scanner**. Users can evaluate over 10,000+ indexed services or paste their own unlisted contracts to immediately expose predatory traps.

---

## 2. System Architecture

To ensure high availability, low latency, and zero-downtime scalability, LightPrint is architected across a **three-tier server topology**:

```
                          [ Client Browser ]
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │   Lb01 : Load Balancer      │
                   │   (Nginx Round-Robin Proxy) │
                   └──────────────┬──────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
       ┌─────────────────────┐         ┌─────────────────────┐
       │   Web01 App Node    │         │   Web02 App Node    │
       │   (Python / :3000)  │         │   (Python / :3000)  │
       │   In-Memory Cache   │         │   In-Memory Cache   │
       │   X-Node: Web01     │         │   X-Node: Web02     │
       └──────────┬──────────┘         └──────────┬──────────┘
                  │                               │
                  └───────────────┬───────────────┘
                                  ▼
                   ┌─────────────────────────────┐
                   │   ToS;DR External REST API  │
                   │   (api.tosdr.org)           │
                   └─────────────────────────────┘
```

* **Client Layer**: Semantic HTML5, modern responsive CSS (dark/light theme), and vanilla JavaScript.
* **Load Balancer (Lb01)**: Nginx reverse proxy distributing HTTP traffic across `Web01` and `Web02` using a weighted round-robin strategy with active health checks.
* **Application Servers (Web01 & Web02)**: Lightweight Python servers running on port 3000, serving the static frontend, proxying API queries, shielding against rate limits using an in-memory TTL cache, and attaching node identifier headers (`X-Server-Node`).
* **Data Source**: Official ToS;DR REST API (`api.tosdr.org`).

---

## 3. Features & User Interactions

1. **Service Search & Lookup**:
   * Search across thousands of web platforms, mobile apps, and developer tools.
   * Debounced real-time input with keyboard shortcuts and instant quick-search pills (YouTube, Spotify, Reddit, Discord, Steam, TikTok).
2. **Privacy Grade System**:
   * Color-coded privacy grade rankings:
     * **Grade A**: Excellent, user-respecting terms.
     * **Grade B**: Fair, minor concerns.
     * **Grade C**: Questionable, noticeable trade-offs.
     * **Grade D**: Significant privacy invasions.
     * **Grade E**: Predatory terms with extensive tracking and rights forfeiture.
3. **Data Filtering & Sorting**:
   * Filter by individual privacy grades (`All`, `Grade A`, `Grade B`, `Grade C`, `Grade D`, `Grade E`).
   * Sort by **Worst Privacy First (E → A)**, **Best Privacy First (A → E)**, or **Alphabetical (A-Z)**.
4. **Detailed Clause Inspector (Modal Drawer)**:
   * View all audited clauses categorized into **Red Flags (Blocker / Bad)**, **Neutral**, and **Good**.
   * Inspect direct verbatim quotes from the legal agreement and community analysis.
5. **Live Clause Scanner (Regex Engine)**:
   * Paste any custom contract, terms, or campus lease excerpt to run heuristic regex detection for:
     * Forced Arbitration (`/\b(arbitration|class\s+action\s+waiver)\b/i`)
     * Unilateral Change Without Notice (`/\b(modify|change|update)\s+these\s+terms\s+at\s+any\s+time\b/i`)
     * Perpetual License Seizure (`/\b(perpetual|irrevocable|royalty-free)\s+license\b/i`)
     * Third-Party Data Transfer (`/\b(share|sell|transfer)\s+data\s+to\s+third\s+parties\b/i`)
     * Total Disclaimer of Liability (`/\b(as[- ]is\s+without\s+warranty|disclaim\s+all\s+warranties)\b/i`)
6. **Server Identifier Badge**:
   * Real-time header inspection (`X-Server-Node`) dynamically displays which server backend (`Web01` or `Web02`) served the request.

---

## 4. Local Installation & Running Instructions

### Prerequisites
* Python 3.8+ (no `pip install` required; uses Python standard library).
* Modern web browser.

### Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/bdushime1-beep/lightprint.git
   cd lightprint
   ```

2. **Run the local application server:**
   ```bash
   # On Windows:
   python server.py

   # On Linux / macOS:
   python3 server.py
   ```

3. **Open in your browser:**
   Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## 5. Multi-Server Deployment Guide (Web01 & Web02)

To deploy the application on the provided Ubuntu web servers:

### Step 1: Clone and Configure on Web01
SSH into **Web01**:
```bash
ssh user@<WEB01_IP>
git clone https://github.com/bdushime1-beep/lightprint.git /opt/lightprint
cd /opt/lightprint
```

Create a systemd service file `/etc/systemd/system/lightprint.service`:
```ini
[Unit]
Description=LightPrint Application Server (Web01)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/lightprint
Environment=PORT=3000
Environment=SERVER_NODE_ID=Web01
ExecStart=/usr/bin/python3 /opt/lightprint/server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable lightprint
sudo systemctl start lightprint
sudo systemctl status lightprint
```

### Step 2: Clone and Configure on Web02
Repeat the same steps on **Web02**, setting `SERVER_NODE_ID=Web02` in `/etc/systemd/system/lightprint.service`:
```ini
Environment=PORT=3000
Environment=SERVER_NODE_ID=Web02
```
Enable and start the service on Web02:
```bash
sudo systemctl daemon-reload
sudo systemctl enable lightprint
sudo systemctl start lightprint
```

---

## 6. Load Balancer Configuration (Lb01)

SSH into **Lb01** and configure Nginx as a reverse proxy load balancer:

1. **Install Nginx:**
   ```bash
   sudo apt update && sudo apt install -y nginx
   ```

2. **Configure `/etc/nginx/sites-available/lightprint`:**
   ```nginx
   upstream lightprint_cluster {
       # Distribute traffic evenly across Web01 and Web02
       server <WEB01_PRIVATE_IP>:3000 max_fails=3 fail_timeout=10s;
       server <WEB02_PRIVATE_IP>:3000 max_fails=3 fail_timeout=10s;
   }

   server {
       listen 80;
       server_name _;

       # Proxy all requests to the upstream backend cluster
       location / {
           proxy_pass http://lightprint_cluster;
           proxy_http_version 1.1;

           # Forward client headers
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;

           # Pass through server identifier header for verification
           proxy_pass_header X-Server-Node;

           # Connection timeouts
           proxy_connect_timeout 5s;
           proxy_read_timeout 15s;
       }

       # Health check proxy
       location /health {
           proxy_pass http://lightprint_cluster/health;
           access_log off;
       }
   }
   ```

3. **Enable configuration and restart Nginx:**
   ```bash
   sudo ln -sf /etc/nginx/sites-available/lightprint /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **Verify Load Balancing:**
   Run multiple curl requests against Lb01 to observe traffic alternating between nodes:
   ```bash
   for i in {1..4}; do curl -sI http://<LB01_IP>/health | grep -i "X-Server-Node"; done
   ```
   *Expected Output:*
   ```
   X-Server-Node: Web01
   X-Server-Node: Web02
   X-Server-Node: Web01
   X-Server-Node: Web02
   ```

---

## 7. API Documentation & Attributions

* **External API**: **ToS;DR API (Terms of Service; Didn't Read)**
  * **Documentation**: [https://api.tosdr.org](https://api.tosdr.org)
  * **Search Endpoint**: `GET https://api.tosdr.org/search/v4/?query={query}`
  * **Service Details Endpoint**: `GET https://api.tosdr.org/service/v2/?id={service_id}`
  * **Credits**: Full credit to the open-source contributors, legal researchers, and maintainers of the ToS;DR project for providing open public legal audits.

---

## 8. Engineering Challenges & Solutions

| Challenge | Solution |
| :--- | :--- |
| **Upstream Rate Limiting (5 req / 10s)** | Implemented an in-memory TTL cache (`CACHE_TTL = 600s`) inside `server.py`. Repeated lookups for popular platforms are served in sub-5ms without triggering HTTP 429 rate limit exceptions. |
| **Multi-Tier Node Visibility** | Attached a custom response header `X-Server-Node: Web01 / Web02` to all HTTP responses, allowing the frontend client to display real-time verification of which backend node handled the request. |
| **Safe Legal Text Analysis** | Developed a client-side regex parsing engine with sanitization (`escapeHtml`) to prevent cross-site scripting (XSS) while highlighting detected predatory contractual patterns. |

---

## 9. 2-Minute Demo Video Walkthrough Outline

* **0:00 - 0:25**: Introduction to LightPrint, problem statement, and running the application locally on `http://localhost:3000`.
* **0:25 - 0:55**: Interactive features walkthrough: searching YouTube and Spotify, filtering by Grade E, and inspecting the clause breakdown modal with direct legal quotes.
* **0:55 - 1:20**: Demonstrating the Live Clause Scanner: pasting custom fine print and seeing regex catch forced arbitration and data-sharing clauses.
* **1:20 - 2:00**: Deployment verification: accessing the app via the **Load Balancer (Lb01)**, refreshing to show requests alternating between **Web01** and **Web02** via the `X-Server-Node` header.
