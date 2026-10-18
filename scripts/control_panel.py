#!/usr/bin/env python3
"""Local, dependency-free cadence controls. This server never starts a crawl."""

from __future__ import annotations

import argparse
import hashlib
import hmac
from http import cookies
from http.server import BaseHTTPRequestHandler, HTTPServer
import html
import json
from pathlib import Path
import secrets
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import parse_qs, urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


PROJECT_ROOT = Path(__file__).resolve().parents[1]
COOKIE_NAME = "observatory_session"
SESSION_SECONDS = 12 * 60 * 60
MAX_BODY = 4096
MIN_INTERVAL_DAYS = Decimal(str(1 / 24))
MAX_INTERVAL_DAYS = Decimal("365")


def validate_interval(value: str) -> str:
    """Accept ordinary decimal days, never executable or non-finite values."""
    if not value or len(value) > 24 or any(c not in "0123456789." for c in value):
        raise ValueError("Enter an interval in days, for example 2 or 0.5.")
    try:
        days = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("Enter a valid number of days.") from exc
    if not days.is_finite() or days < MIN_INTERVAL_DAYS or days > MAX_INTERVAL_DAYS:
        raise ValueError("Choose an interval from 1 hour to 365 days.")
    return format(days.normalize(), "f")


def parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return result.astimezone(timezone.utc) if result.tzinfo else None
    except (ValueError, OverflowError):
        return None


def read_state(root: Path) -> tuple[dict, list, str | None]:
    """Read only. A missing run ledger means no completed scan is recorded."""
    try:
        config = json.loads((root / "config.json").read_text(encoding="utf-8"))
        if not isinstance(config, dict):
            raise ValueError("config.json must contain an object")
        hours = Decimal(str(config.get("intervalHours", 48)))
        if not hours.is_finite() or not 1 <= hours <= 8760:
            raise ValueError("intervalHours must be between 1 and 8760")
        if not isinstance(config.get("enabled", True), bool):
            raise ValueError("enabled must be true or false")
    except (OSError, ValueError, InvalidOperation) as exc:
        return {}, [], f"Could not read the local configuration: {exc}"
    try:
        path = root / "data" / "runs.json"
        runs = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        if not isinstance(runs, list):
            raise ValueError("runs.json must contain an array")
    except (OSError, ValueError) as exc:
        return config, [], f"Could not read scan history: {exc}"
    return config, runs, None


def schedule_summary(config: dict, runs: list, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    completed = [
        parsed for run in runs if isinstance(run, dict) and run.get("status") == "complete"
        if (parsed := parse_timestamp(run.get("finishedAt"))) is not None
    ]
    last = max(completed) if completed else None
    enabled = config.get("enabled", True)
    next_at = last + timedelta(hours=float(config.get("intervalHours", 48))) if last else None
    return {
        "last": last,
        "next": next_at if enabled else None,
        "paused": not enabled,
        "due": bool(enabled and (next_at is None or next_at <= now)),
    }


def safe_site_url(value: object) -> str | None:
    if not isinstance(value, str) or any(c.isspace() or ord(c) < 32 for c in value):
        return None
    try:
        parts = urlsplit(value)
        return value if parts.scheme == "https" and parts.hostname and not parts.username and not parts.password else None
    except ValueError:
        return None


def save_configuration(root: Path, days: str, paused: bool) -> None:
    """Use the project's sole configuration writer; never interpolate a shell."""
    command = [
        sys.executable, str(root / "scripts" / "observatory.py"),
        "configure", "--interval-days", validate_interval(days),
        "--enabled", "false" if paused else "true",
    ]
    result = subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=20, check=False)
    if result.returncode:
        detail = (result.stderr or result.stdout or "Configuration command failed.").strip()[:1200]
        raise ValueError(detail)


class ControlServer(HTTPServer):
    """Loopback-only server, with one per-process signing secret."""

    def __init__(self, root: Path = PROJECT_ROOT, port: int = 8893):
        self.root = root.resolve()
        self.secret = secrets.token_bytes(32)
        super().__init__(("127.0.0.1", port), ControlHandler)
        self.host = f"127.0.0.1:{self.server_port}"
        self.origin = f"http://{self.host}"

    def sign(self, purpose: str, value: str) -> str:
        return hmac.new(self.secret, f"{purpose}:{value}".encode(), hashlib.sha256).hexdigest()

    def new_session(self) -> str:
        nonce = f"{int(time.time())}.{secrets.token_urlsafe(24)}"
        return f"{nonce}.{self.sign('session', nonce)}"

    def valid_session(self, value: str | None) -> bool:
        if not value or len(value) > 200:
            return False
        try:
            nonce, signature = value.rsplit(".", 1)
            issued = int(nonce.split(".", 1)[0])
            age = time.time() - issued
            return 0 <= age < SESSION_SECONDS and hmac.compare_digest(signature, self.sign("session", nonce))
        except (ValueError, TypeError):
            return False


class ControlHandler(BaseHTTPRequestHandler):
    server: ControlServer
    server_version = "ObservatoryControls/1"
    sys_version = ""

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, format: str, *args: object) -> None:
        # Do not put request data, cookies or submitted values in terminal logs.
        pass

    def send_page(self, body: str, status: int = 200, session: str | None = None) -> None:
        payload = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        # A no-referrer policy makes some browsers send Origin: null for native
        # form POSTs. same-origin preserves local provenance without disclosing
        # this local URL when following a link to the public website.
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
        if session:
            self.send_header("Set-Cookie", f"{COOKIE_NAME}={session}; HttpOnly; SameSite=Strict; Path=/")
        self.end_headers()
        self.wfile.write(payload)

    def deny(self, message: str, status: int = 403) -> None:
        self.send_page(f"<!doctype html><html lang='en'><meta charset='utf-8'><title>Request refused</title><h1>Request refused</h1><p>{html.escape(message)}</p></html>", status)

    def valid_host(self) -> bool:
        hosts = self.headers.get_all("Host", [])
        return len(hosts) == 1 and hosts[0] == self.server.host

    def valid_request_origin(self) -> bool:
        origins = self.headers.get_all("Origin", [])
        if origins:
            # Never replace an explicit null, cross-site or duplicate Origin
            # with a more permissive referrer check.
            return origins == [self.server.origin]
        referrers = self.headers.get_all("Referer", [])
        if len(referrers) != 1 or any(c.isspace() for c in referrers[0]):
            return False
        try:
            referrer = urlsplit(referrers[0])
            return referrer.scheme == "http" and referrer.netloc == self.server.host
        except ValueError:
            return False

    def session_cookie(self) -> str | None:
        values = self.headers.get_all("Cookie", [])
        if len(values) != 1:
            return None
        try:
            jar = cookies.SimpleCookie()
            jar.load(values[0])
            item = jar.get(COOKIE_NAME)
            return item.value if item else None
        except cookies.CookieError:
            return None

    def do_GET(self) -> None:
        if not self.valid_host():
            return self.deny("Open the exact local URL printed in the terminal.")
        if self.path != "/":
            return self.deny("This local server only provides the controls page at /.", 404)
        session = self.session_cookie()
        if not self.server.valid_session(session):
            session = self.server.new_session()
        self.render(session)

    def do_POST(self) -> None:
        if not self.valid_host() or not self.valid_request_origin():
            return self.deny("The form must be submitted from this local controls page.")
        if self.path != "/":
            return self.deny("Unknown controls action.", 404)
        session = self.session_cookie()
        if not self.server.valid_session(session):
            return self.deny("Your local session expired. Reload the controls page and try again.")
        if self.headers.get("Transfer-Encoding"):
            return self.deny("Unsupported request body.", 400)
        if self.headers.get_content_type() != "application/x-www-form-urlencoded":
            return self.deny("Submit the controls form in your browser.", 415)
        lengths = self.headers.get_all("Content-Length", [])
        try:
            length = int(lengths[0]) if len(lengths) == 1 else -1
        except ValueError:
            length = -1
        if not 0 < length <= MAX_BODY:
            return self.deny("Invalid form size.", 400)
        try:
            form = parse_qs(self.rfile.read(length).decode("utf-8"), keep_blank_values=True, strict_parsing=True, max_num_fields=4)
            if any(len(value) != 1 for value in form.values()) or not {"csrf", "interval_days"} <= form.keys() or not form.keys() <= {"csrf", "interval_days", "paused"}:
                raise ValueError("Invalid controls form. Reload this page and try again.")
            if not hmac.compare_digest(form["csrf"][0].encode("utf-8"), self.server.sign("csrf", session).encode("ascii")):
                return self.deny("The form token is invalid. Reload the controls page and try again.")
            if "paused" in form and form["paused"] != ["1"]:
                raise ValueError("Invalid pause setting.")
            days = validate_interval(form["interval_days"][0])
            save_configuration(self.server.root, days, "paused" in form)
        except (ValueError, UnicodeDecodeError) as exc:
            return self.render(session, error=str(exc), status=400)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return self.render(session, error=f"Could not save the configuration: {exc}", status=500)
        self.render(session, message="Saved locally. The next Codex heartbeat will use these settings.")

    def render(self, session: str, message: str = "", error: str = "", status: int = 200) -> None:
        esc = html.escape
        config, runs, read_error = read_state(self.server.root)
        error = error or read_error or ""
        zone_name = str(config.get("timezone", "Europe/Berlin"))
        try:
            zone = ZoneInfo(zone_name)
        except (ZoneInfoNotFoundError, ValueError):
            zone, zone_name = timezone.utc, "UTC"
        state = schedule_summary(config, runs)
        def date_label(value: datetime | None) -> str:
            return value.astimezone(zone).strftime("%d %b %Y · %H:%M %Z") if value else "No completed scan recorded"
        last_label = date_label(state["last"])
        next_label = "Paused" if state["paused"] else "Due at the next available heartbeat" if state["due"] else date_label(state["next"])
        if read_error:
            last_label = next_label = "Unavailable — check the message below"
        days = str(float(config.get("intervalHours", 48)) / 24)
        site_url = safe_site_url(config.get("siteUrl"))
        site_link = f'<a class="site" href="{esc(site_url, quote=True)}" target="_blank" rel="noopener noreferrer">Open the public Observatory <span aria-hidden="true">↗</span></a>' if site_url else ""
        feedback = f'<p class="notice success" role="status">{esc(message)}</p>' if message else ""
        if error:
            feedback += f'<p class="notice error" role="alert">{esc(error)}</p>'
        checked = " checked" if state["paused"] else ""
        body = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Observatory · Local controls</title>
<style>
:root{{color-scheme:light;--paper:#f5f2e9;--ink:#172b2b;--muted:#526461;--line:#c8d0c7;--green:#174b3e}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 system-ui,-apple-system,sans-serif}}
main{{max-width:760px;margin:0 auto;padding:64px 28px 56px}}.eyebrow{{text-transform:uppercase;letter-spacing:.18em;font-size:12px;font-weight:700;color:var(--green)}}
h1{{font:500 clamp(36px,7vw,54px)/1.08 Georgia,serif;letter-spacing:-.035em;margin:15px 0 20px}}p{{margin:0 0 20px}}.lead{{font-size:19px;max-width:610px;color:var(--muted)}}
.status{{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:26px 0;margin:30px 0;border-block:1px solid var(--line)}}dt{{color:var(--muted);font-size:13px}}dd{{margin:6px 0 0;font-size:17px;font-weight:600}}
label{{display:block;font-weight:650}}input[type=number]{{display:block;width:190px;font:inherit;color:var(--ink);background:#fffdf7;border:1px solid #83948d;border-radius:4px;padding:12px 14px;margin:10px 0 8px}}
.hint{{font-size:14px;color:var(--muted);max-width:560px}}.pause{{display:flex;align-items:flex-start;gap:12px;margin:26px 0;font-size:16px;font-weight:500}}input[type=checkbox]{{width:20px;height:20px;margin:3px 0 0;accent-color:var(--green)}}
button{{background:var(--green);color:white;border:0;border-radius:4px;padding:13px 22px;font:650 16px/1.4 system-ui;cursor:pointer}}button:hover{{background:#103a30}}
a{{color:var(--green);text-underline-offset:4px}}:focus-visible{{outline:3px solid #aa6c06;outline-offset:4px}}.notice{{padding:14px 18px;border:1px solid var(--line);border-left:4px solid var(--green);background:#fffdf7;overflow-wrap:anywhere}}.error{{border-left-color:#a22e24;color:#78231c}}
.explain{{margin-top:38px;padding-top:24px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}}.site{{display:inline-block;margin-top:8px}}.local{{font-size:12px;margin-top:28px;color:var(--muted)}}
@media(max-width:520px){{main{{padding:36px 22px}}.status{{grid-template-columns:1fr;gap:18px}}button{{width:100%}}}}
</style></head><body><main>
<div class="eyebrow">AI Observatory · On this Mac</div><h1>Set the rhythm.</h1>
<p class="lead">Choose how often the Observatory becomes due for a new research scan.</p>
<dl class="status"><div><dt>Last completed scan</dt><dd>{esc(last_label)}</dd></div><div><dt>Next eligible scan</dt><dd>{esc(next_label)}</dd></div></dl>
{feedback}
<form method="post" action="/">
<input type="hidden" name="csrf" value="{esc(self.server.sign('csrf', session), quote=True)}">
<label for="interval-days">Days between completed scans</label>
<input id="interval-days" name="interval_days" type="number" min="0.041666666666666664" max="365" step="any" value="{esc(days, quote=True)}" required aria-describedby="interval-hint">
<p id="interval-hint" class="hint">For example, 2 means every two days. Fractions are welcome: 0.5 means every twelve hours. Minimum one hour, maximum 365 days.</p>
<label class="pause"><input type="checkbox" name="paused" value="1"{checked}><span>Pause future scans</span></label>
<button type="submit">Save scan settings</button></form>
<div class="explain"><p>The Codex heartbeat checks this configuration hourly. A due scan starts when that heartbeat can run; it may start later than the time shown. Codex and this Mac must be available. Saving settings does not start a scan, and pausing does not stop research already in progress.</p>
<p>These settings are saved in this project's local config.json. The public website's schedule updates with the next publication. You can close this page after saving. Stop this controls server with Control+C in its terminal.</p>{site_link}</div>
<p class="local">Local controls at {esc(self.server.origin)} · Times shown in {esc(zone_name)}</p>
</main></body></html>'''
        self.send_page(body, status, session)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8893, help="Local port (default: 8893).")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("port must be between 1 and 65535")
    try:
        server = ControlServer(port=args.port)
    except OSError as exc:
        parser.exit(1, f"Could not start local controls: {exc}\nIf already open, visit http://127.0.0.1:{args.port}/\n")
    print(f"Observatory controls: {server.origin}/", flush=True)
    print("Open that URL in your browser. This server does not start research scans.\nPress Control+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nLocal controls stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
