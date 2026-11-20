import os
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get("PORT", 3000))
SERVER_NODE_ID = os.environ.get("SERVER_NODE_ID", "Web01")
CACHE_TTL = 600

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

cache_store = {}

# Pre-seeded popular platforms for instant zero-latency loading
SEED_SERVICES = [
    {
        "id": "225",
        "name": "Spotify",
        "rating": {"human": "E", "letter": "E", "hex": "#dc3545"},
        "urls": ["spotify.com"],
        "is_comprehensively_reviewed": True,
        "summary": "Tracks users across apps and devices; shares data with dozens of advertising partners."
    },
    {
        "id": "274",
        "name": "YouTube",
        "rating": {"human": "E", "letter": "E", "hex": "#dc3545"},
        "urls": ["youtube.com"],
        "is_comprehensively_reviewed": True,
        "summary": "Holds perpetual worldwide license to uploaded content; extensive behavioral tracking."
    },
    {
        "id": "194",
        "name": "Reddit",
        "rating": {"human": "D", "letter": "D", "hex": "#f97316"},
        "urls": ["reddit.com"],
        "is_comprehensively_reviewed": True,
        "summary": "Licenses user posts for commercial AI training; requires forced arbitration for legal disputes."
    },
    {
        "id": "196",
        "name": "Discord",
        "rating": {"human": "D", "letter": "D", "hex": "#f97316"},
        "urls": ["discord.com"],
        "is_comprehensively_reviewed": True,
        "summary": "Can monitor user interactions; reserves authority to alter terms without direct email notice."
    },
    {
        "id": "218",
        "name": "Steam",
        "rating": {"human": "C", "letter": "C", "hex": "#eab308"},
        "urls": ["steampowered.com"],
        "is_comprehensively_reviewed": True,
        "summary": "Provides digital software subscription licenses; purchases are non-transferable."
    },
    {
        "id": "327",
        "name": "RiseUp.net",
        "rating": {"human": "B", "letter": "B", "hex": "#14b8a6"},
        "urls": ["riseup.net"],
        "is_comprehensively_reviewed": True,
        "summary": "Privacy-focused communication service; minimal logging policy and zero commercial profiling."
    },
    {
        "id": "246",
        "name": "DuckDuckGo",
        "rating": {"human": "A", "letter": "A", "hex": "#22c55e"},
        "urls": ["duckduckgo.com"],
        "is_comprehensively_reviewed": True,
        "summary": "Does not collect or share personal information; searches are completely untracked."
    },
    {
        "id": "202",
        "name": "Wikipedia",
        "rating": {"human": "A", "letter": "A", "hex": "#22c55e"},
        "urls": ["wikipedia.org"],
        "is_comprehensively_reviewed": True,
        "summary": "Operated by non-profit Wikimedia Foundation; zero commercial ad trackers or user data sales."
    },
    {
        "id": "319",
        "name": "Signal",
        "rating": {"human": "A", "letter": "A", "hex": "#22c55e"},
        "urls": ["signal.org"],
        "is_comprehensively_reviewed": True,
        "summary": "End-to-end encrypted messaging; keeps zero logs of contact lists, messages, or metadata."
    },
    {
        "id": "301",
        "name": "Netflix",
        "rating": {"human": "C", "letter": "C", "hex": "#eab308"},
        "urls": ["netflix.com"],
        "is_comprehensively_reviewed": True,
        "summary": "Tracks viewing habits to personalize content; standard commercial entertainment policy."
    },
    {
        "id": "226",
        "name": "Telegram",
        "rating": {"human": "D", "letter": "D", "hex": "#f97316"},
        "urls": ["telegram.org"],
        "is_comprehensively_reviewed": True,
        "summary": "Standard chats are cloud-synced and not end-to-end encrypted by default."
    },
    {
        "id": "1488",
        "name": "TikTok",
        "rating": {"human": "E", "letter": "E", "hex": "#dc3545"},
        "urls": ["tiktok.com"],
        "is_comprehensively_reviewed": True,
        "summary": "Broad device telemetry, keystroke pattern tracking, and extensive advertising data sharing."
    }
]

def fetch_upstream_json(url):
    now = time.time()
    if url in cache_store:
        cached_time, cached_data = cache_store[url]
        if now - cached_time < CACHE_TTL:
            return cached_data, True

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "LightPrint-Investigative/1.0 (Student Project)"}
    )
    with urllib.request.urlopen(req, timeout=8) as response:
        payload = response.read().decode("utf-8")
        parsed = json.loads(payload)
        cache_store[url] = (now, parsed)
        return parsed, False

class LightPrintHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header("X-Server-Node", SERVER_NODE_ID)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Connection", "close")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, status_code, body):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        # Health check endpoint for Lb01 load balancer probes
        if self.path == "/health":
            return self.send_json(200, {
                "status": "healthy",
                "node": SERVER_NODE_ID,
                "timestamp": time.time()
            })

        # Pre-seeded featured services for instant cold-start
        if self.path == "/api/featured":
            return self.send_json(200, {
                "source": "pre-seeded",
                "serverNode": SERVER_NODE_ID,
                "count": len(SEED_SERVICES),
                "services": SEED_SERVICES
            })

        # Proxy: Search services by keyword
        if self.path.startswith("/api/search"):
            parsed_url = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed_url.query)
            query = params.get("q", [""])[0].strip()

            if not query:
                return self.send_json(400, {"error": "Missing query parameter 'q'"})

            upstream_url = f"https://api.tosdr.org/search/v4/?query={urllib.parse.quote(query)}"
            try:
                data, was_cached = fetch_upstream_json(upstream_url)
                services = data.get("parameters", {}).get("services", [])
                return self.send_json(200, {
                    "source": "tosdr-search",
                    "cached": was_cached,
                    "serverNode": SERVER_NODE_ID,
                    "count": len(services),
                    "services": services
                })
            except urllib.error.HTTPError as err:
                status = 429 if err.code == 429 else 502
                return self.send_json(status, {
                    "error": f"Upstream API error: {err.code}",
                    "details": "Rate limit exceeded or service temporarily unavailable."
                })
            except Exception as e:
                return self.send_json(500, {"error": "Internal server error", "details": str(e)})

        # Proxy: Full service details by ID
        elif self.path.startswith("/api/service"):
            parsed_url = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed_url.query)
            service_id = params.get("id", [""])[0].strip()

            if not service_id:
                return self.send_json(400, {"error": "Missing parameter 'id'"})

            upstream_url = f"https://api.tosdr.org/service/v2/?id={urllib.parse.quote(service_id)}"
            try:
                data, was_cached = fetch_upstream_json(upstream_url)
                service_info = data.get("parameters", {})
                return self.send_json(200, {
                    "source": "tosdr-service",
                    "cached": was_cached,
                    "serverNode": SERVER_NODE_ID,
                    "service": service_info
                })
            except urllib.error.HTTPError as err:
                status = 429 if err.code == 429 else 502
                return self.send_json(status, {
                    "error": f"Upstream API error: {err.code}",
                    "details": "Failed to fetch service audit points."
                })
            except Exception as e:
                return self.send_json(500, {"error": "Internal server error", "details": str(e)})

        # Default: Serve static files from public/
        return super().do_GET()

def run_server():
    server_address = ("", PORT)
    httpd = ThreadingHTTPServer(server_address, LightPrintHandler)
    httpd.daemon_threads = True
    print(f"[{SERVER_NODE_ID}] LightPrint server listening on http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
