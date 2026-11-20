import os
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get("PORT", 3000))
SERVER_NODE_ID = os.environ.get("SERVER_NODE_ID", "Web01")
CACHE_TTL = 600  # 10 min cache to shield against ToS;DR 5 req/10s rate limit

cache_store = {}

def fetch_upstream_json(url):
    now = time.time()
    if url in cache_store:
        cached_time, cached_data = cache_store[url]
        if now - cached_time < CACHE_TTL:
            return cached_data, True

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "LightPrint-App/1.0 (Student Project)"}
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        payload = response.read().decode("utf-8")
        parsed = json.loads(payload)
        cache_store[url] = (now, parsed)
        return parsed, False

class LightPrintHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="public", **kwargs)

    def end_headers(self):
        # Attach load balancer proof header and CORS
        self.send_header("X-Server-Node", SERVER_NODE_ID)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
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

        # Default: Serve static frontend files from public/
        return super().do_GET()

def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, LightPrintHandler)
    print(f"[{SERVER_NODE_ID}] LightPrint server listening on http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
