#!/usr/bin/env python3
"""Finite acquisition and fail-closed publication for the AI Observatory.

Python standard library only. Acquisition is deterministic; all interpretation,
source-backed reporting, and Astra review happen in the Codex maintenance run.
"""
import argparse
import contextlib
import datetime as dt
import email.utils
import fcntl
import hashlib
import html
from html.parser import HTMLParser
import http.client
import ipaddress
import json
import math
import os
from pathlib import Path
import queue
import re
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
import uuid
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
UTC = dt.timezone.utc
DIMENSIONS = ("usefulness", "impact", "novelty", "maturity", "openness")
CATEGORIES = {"Tools", "Models", "Open source", "Research", "Creative workflows", "Industry"}
ALLOWED_TAGS = {"p", "h3", "ul", "ol", "li", "strong", "em", "a", "code", "pre", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "br"}
TRACKING_KEYS = {"fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid"}
MAX_BYTES = 2 * 1024 * 1024
FETCH_TIMEOUT = 10
SYSTEM_CA_BUNDLES = (Path("/etc/ssl/cert.pem"), Path("/etc/ssl/certs/ca-certificates.crt"))
RUBRIC_VERSION = "1.0"


def read_json(path, default=None):
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value):
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


RUBRIC_HASH = digest(read_json(ROOT / "data/rubric.json", {}))


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=str(path.parent), encoding="utf-8", delete=False) as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    os.replace(str(temporary), str(path))


def now_utc():
    return dt.datetime.now(UTC)


def timestamp(value=None):
    return (value or now_utc()).astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_date(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)
    except ValueError:
        try:
            parsed = email.utils.parsedate_to_datetime(value)
            return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)
        except (ValueError, TypeError, OverflowError):
            return None


def canonical_url(url):
    """Normalize a public HTTP URL; fetching separately validates resolved IPs."""
    if not isinstance(url, str) or not url or re.search(r"[\x00-\x20\\]", url):
        raise ValueError("URL is empty or contains whitespace/control characters")
    parsed = urlsplit(url)
    if parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError("URL must use HTTP or HTTPS")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("URL credentials are forbidden")
    hostname = (parsed.hostname or "").rstrip(".").lower()
    if not hostname or hostname == "localhost" or hostname.endswith((".localhost", ".local", ".internal")):
        raise ValueError("Local URL host is forbidden")
    try:
        address = ipaddress.ip_address(hostname)
        if not address.is_global:
            raise ValueError("Nonpublic IP address is forbidden")
    except ValueError as exc:
        if "Nonpublic" in str(exc):
            raise
        if "." not in hostname and ":" not in hostname:
            raise ValueError("Public domain name required")
        if not re.fullmatch(r"[a-z0-9.-]+", hostname):
            raise ValueError("Invalid URL hostname")
        # Numeric variants can resolve as loopback despite looking like names.
        if re.fullmatch(r"[0-9.]+", hostname):
            raise ValueError("Ambiguous numeric URL host")
    port = parsed.port
    if port is not None and port not in {80, 443}:
        raise ValueError("Only standard HTTP(S) ports are allowed")
    scheme = parsed.scheme.lower()
    netloc = "[" + hostname + "]" if ":" in hostname else hostname
    if port and not ((scheme == "https" and port == 443) or (scheme == "http" and port == 80)):
        netloc += ":" + str(port)
    query = [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True)
             if not key.lower().startswith("utm_") and key.lower() not in TRACKING_KEYS]
    return urlunsplit((scheme, netloc, parsed.path or "/", urlencode(sorted(query)), ""))


def public_addresses(hostname, port, timeout=FETCH_TIMEOUT):
    # DNS lookup has no stdlib timeout knob. A daemon resolver keeps acquisition
    # bounded even when the system resolver stalls; it cannot write project data.
    resolved = queue.Queue(maxsize=1)
    def resolve():
        try:
            resolved.put((True, socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)))
        except OSError as exc:
            resolved.put((False, exc))
    worker = threading.Thread(target=resolve, daemon=True)
    worker.start()
    try:
        success, results = resolved.get(timeout=max(0.01, timeout))
    except queue.Empty:
        raise TimeoutError("DNS resolution deadline exceeded")
    if not success:
        raise results
    addresses = list(dict.fromkeys(item[4][0] for item in results))
    if not addresses or any(not ipaddress.ip_address(item).is_global for item in addresses):
        raise ValueError("Host resolves to a nonpublic network address")
    return addresses


def verified_ssl_context():
    """Use Python's trust store, or a trusted OS bundle when it is absent.

    Python.org's macOS installer can leave its optional CA-install step undone.
    Do not weaken certificate/hostname validation or replace configured roots.
    """
    context = ssl.create_default_context()
    if context.cert_store_stats().get("x509_ca", 0) > 0:
        return context
    paths = ssl.get_default_verify_paths()
    # OpenSSL loads a hashed CA directory lazily during verification. An empty
    # in-memory count alone is not proof that the configured directory is empty.
    if paths.capath and Path(paths.capath).is_dir():
        return context
    if os.environ.get(paths.openssl_cafile_env) or os.environ.get(paths.openssl_capath_env):
        return context
    for bundle in SYSTEM_CA_BUNDLES:
        try:
            if not bundle.is_file():
                continue
            info = bundle.stat()
            if info.st_uid != 0 or info.st_mode & 0o022:
                continue
            context.load_verify_locations(cafile=str(bundle))
            if context.cert_store_stats().get("x509_ca", 0) > 0:
                return context
        except (OSError, ssl.SSLError):
            continue
    raise ValueError("Python's TLS trust store is empty and no trusted OS CA bundle was available. Install Python CA certificates or configure SSL_CERT_FILE; certificate verification remains required.")


def safe_fetch(url, timeout=FETCH_TIMEOUT, max_bytes=MAX_BYTES):
    """Fetch public content with pinned checked IP, TLS verification and bounded redirects."""
    current = canonical_url(url)
    deadline = time.monotonic() + timeout
    for _ in range(4):
        parsed = urlsplit(current)
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        addresses = public_addresses(parsed.hostname, port, deadline - time.monotonic())
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Fetch deadline exceeded")
        connection = http.client.HTTPConnection(parsed.hostname, port, timeout=remaining)
        sock = socket.create_connection((addresses[0], port), timeout=remaining)
        expired = threading.Event()
        active_socket = [sock]
        def interrupt_at_deadline(connection_socket=active_socket, timeout_expired=expired):
            # Socket timeouts measure inactivity; a peer trickling bytes can
            # otherwise keep HTTPResponse's buffered header/body reads alive.
            timeout_expired.set()
            try:
                connection_socket[0].shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            connection_socket[0].close()
        watchdog = threading.Timer(max(0, deadline - time.monotonic()), interrupt_at_deadline)
        watchdog.daemon = True
        watchdog.start()
        try:
            if parsed.scheme == "https":
                sock = verified_ssl_context().wrap_socket(sock, server_hostname=parsed.hostname, do_handshake_on_connect=False)
                active_socket[0] = sock
                if expired.is_set():
                    raise TimeoutError("Fetch deadline exceeded")
                sock.do_handshake()
            connection.sock = sock
            path = urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
            connection.request("GET", path, headers={"User-Agent": "AI-Observatory/1.0 (bounded public feed discovery)", "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.5", "Accept-Encoding": "identity", "Host": parsed.netloc})
            response = connection.getresponse()
            if response.status in {301, 302, 303, 307, 308}:
                location = response.getheader("Location")
                if not location:
                    raise ValueError("Redirect has no Location")
                current = canonical_url(urljoin(current, location))
                continue
            if response.status != 200:
                raise ValueError("HTTP " + str(response.status))
            length = response.getheader("Content-Length")
            if length and int(length) > max_bytes:
                raise ValueError("Response exceeds byte limit")
            if response.getheader("Content-Encoding", "identity") != "identity":
                raise ValueError("Compressed response not accepted")
            payload = bytearray()
            while len(payload) <= max_bytes:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError("Fetch deadline exceeded")
                sock.settimeout(remaining)
                chunk = response.read(min(65536, max_bytes + 1 - len(payload)))
                if not chunk:
                    break
                payload.extend(chunk)
            if len(payload) > max_bytes:
                raise ValueError("Response exceeds byte limit")
            if expired.is_set() or time.monotonic() >= deadline:
                raise TimeoutError("Fetch deadline exceeded")
            return bytes(payload), current, response.getheader("Content-Type", "")
        except (OSError, ValueError, http.client.HTTPException):
            if expired.is_set() or time.monotonic() >= deadline:
                raise TimeoutError("Fetch deadline exceeded") from None
            raise
        finally:
            watchdog.cancel()
            connection.close()
            active_socket[0].close()
    raise ValueError("Redirect limit exceeded")


class SafeMarkup(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.errors = []
        self.text = []
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag not in ALLOWED_TAGS:
            self.errors.append("unsafe HTML tag: " + tag)
        if len({key for key, _ in attrs}) != len(attrs):
            self.errors.append("duplicate HTML attributes")
        for key, value in attrs:
            if tag != "a" or key not in {"href", "title"}:
                self.errors.append("unsafe HTML attribute: " + key)
            elif key == "href":
                try:
                    canonical_url(value)
                except (ValueError, TypeError):
                    self.errors.append("unsafe link URL")
        if tag != "br":
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag != "br":
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "br":
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append("unbalanced HTML tag: " + tag)
        else:
            self.stack.pop()

    def handle_data(self, value):
        self.text.append(value)

    def handle_decl(self, decl):
        self.errors.append("HTML declarations are forbidden")

    def handle_pi(self, data):
        self.errors.append("HTML processing instructions are forbidden")

    def handle_comment(self, data):
        self.errors.append("HTML comments are forbidden")

    def unknown_decl(self, data):
        self.errors.append("Unknown HTML declarations are forbidden")


def markup_check(value):
    if not isinstance(value, str):
        return ["HTML body must be a string"], 0
    parser = SafeMarkup()
    # Browsers and HTMLParser disagree on malformed comments (for example
    # <!--><img ...>-->). Reject the lexical opening tokens as well as parser
    # callbacks, including unclosed comments that never produce a callback.
    if "<!" in value or "<?" in value:
        parser.errors.append("HTML comments and declarations are forbidden")
    try:
        parser.feed(value)
        parser.close()
    except Exception:
        parser.errors.append("Malformed HTML")
    if parser.stack:
        parser.errors.append("unclosed HTML tags")
    count = len(re.findall(r"\b[\w]+(?:[’'-][\w]+)*\b", " ".join(parser.text)))
    return parser.errors, count


def word_count(report):
    return sum(markup_check(section.get("html", ""))[1] for section in report.get("sections", []) if isinstance(section, dict))


def report_hash(report):
    return digest(report)


def evidence_hash(report, evidence):
    sources = report.get("sources", [])
    ids = {source.get("id") for source in sources if isinstance(source, dict) and isinstance(source.get("id"), str)}
    claims = [claim for claim in evidence if isinstance(claim, dict) and isinstance(claim.get("source_ids"), list) and any(isinstance(source_id, str) and source_id in ids for source_id in claim["source_ids"])]
    return digest({"sources": sources, "claims": claims})


def target_words(impact):
    return 1000 if impact < 5 else 2000 if impact <= 7 else 3000


def validate_report(report, evidence, reviews):
    errors = []
    if not isinstance(report, dict):
        return ["Report must be an object"]
    for key in ("id", "title", "entity", "category", "summary", "discoveredAt", "updatedAt", "officialUrl", "judgment", "researchNote"):
        if not isinstance(report.get(key), str) or not report[key].strip():
            errors.append("Missing report field: " + key)
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,99}", str(report.get("id", ""))):
        errors.append("Report ID must be a safe lowercase slug")
    if report.get("category") not in CATEGORIES:
        errors.append("Unknown report category")
    if report.get("changeType") not in {"baseline", "new", "update"}:
        errors.append("Invalid changeType")
    for key in ("discoveredAt", "updatedAt"):
        if not parse_date(report.get(key)):
            errors.append("Invalid report date: " + key)
    if report.get("publishedAt") is not None and not parse_date(report.get("publishedAt")):
        errors.append("Invalid publishedAt")
    urls = [("officialUrl", report.get("officialUrl"))]
    sections = report.get("sections")
    if not isinstance(sections, list) or not sections:
        errors.append("Report sections are required")
        sections = []
    section_ids = []
    for section in sections:
        if not isinstance(section, dict):
            errors.append("Invalid report section")
            continue
        if not isinstance(section.get("title"), str) or not section.get("title"):
            errors.append("Section title is required")
        section_id = section.get("id", "")
        if not isinstance(section_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", section_id):
            errors.append("Invalid section ID")
        section_ids.append(str(section_id))
        errors.extend(markup_check(section.get("html"))[0])
    if len(set(section_ids)) != len(section_ids):
        errors.append("Duplicate section IDs")
    sources = report.get("sources")
    if not isinstance(sources, list) or not sources:
        errors.append("At least one cited source is required")
        sources = []
    source_ids = []
    for source in sources:
        if not isinstance(source, dict):
            errors.append("Invalid source record")
            continue
        source_ids.append(str(source.get("id")))
        for key in ("id", "title", "url", "locator", "supports"):
            if not source.get(key):
                errors.append("Source missing " + key)
        if not parse_date(source.get("accessedAt")):
            errors.append("Source missing valid accessedAt")
        urls.append(("source", source.get("url")))
    if len(set(source_ids)) != len(source_ids):
        errors.append("Duplicate source IDs")
    images = report.get("images", [])
    if not isinstance(images, list) or len(images) > 3:
        errors.append("Images must be a list with at most three entries")
        images = []
    for image in images:
        if not isinstance(image, dict) or not image.get("alt") or not image.get("caption"):
            errors.append("Image requires alt and caption")
            continue
        urls.extend([("image", image.get("src")), ("image credit", image.get("sourceUrl"))])
    for label, url in urls:
        try:
            canonical_url(url)
        except (TypeError, ValueError):
            errors.append("Unsafe or invalid " + label + " URL")
    if not isinstance(reviews, list) or len(reviews) != 2 or not all(isinstance(review, dict) for review in reviews):
        errors.append("Exactly two Astra reviews are required")
        return errors
    if not reviews[0].get("reviewerId") or reviews[0].get("reviewerId") == reviews[1].get("reviewerId") or not reviews[1].get("reviewerId"):
        errors.append("Two distinct reviewer IDs are required")
    valid_scores = True
    for review in reviews:
        if review.get("reportId") != report.get("id"):
            errors.append("Review reportId mismatch")
        if review.get("model") != "gpt-6-astra" or review.get("effort") != "high":
            errors.append("Review must use exact gpt-6-astra model at high effort")
        if review.get("verdict") != "approve":
            errors.append("Both reviews must approve")
        if review.get("reportHash") != report_hash(report):
            errors.append("Stale report hash")
        if review.get("evidenceHash") != evidence_hash(report, evidence):
            errors.append("Stale evidence hash")
        if review.get("rubricVersion") != RUBRIC_VERSION or review.get("rubricHash") != RUBRIC_HASH:
            errors.append("Stale or missing rubric hash/version")
        if not parse_date(review.get("reviewedAt")):
            errors.append("Review requires valid reviewedAt")
        if review.get("confidence") not in {"high", "medium", "low"}:
            errors.append("Review confidence is invalid")
        if not isinstance(review.get("concerns"), list):
            errors.append("Review concerns must be an array")
        scores = review.get("scores", {})
        rationale = review.get("rationale", {})
        for dimension in DIMENSIONS:
            score = scores.get(dimension) if isinstance(scores, dict) else None
            if type(score) is not int or not 1 <= score <= 10:
                errors.append("Invalid integer score: " + dimension)
                valid_scores = False
            if not isinstance(rationale, dict) or not isinstance(rationale.get(dimension), str) or not rationale[dimension].strip():
                errors.append("Missing score rationale: " + dimension)
    if valid_scores:
        for dimension in DIMENSIONS:
            if abs(reviews[0]["scores"][dimension] - reviews[1]["scores"][dimension]) > 2:
                errors.append("Rating disagreement exceeds two points: " + dimension)
        impact = sum(review["scores"]["impact"] for review in reviews) / 2
        target = target_words(impact)
        count = word_count(report)
        if not target * 0.9 <= count <= target * 1.1:
            errors.append("Report body has %d words; mean impact %.1f requires %d ±10%%" % (count, impact, target))
    return list(dict.fromkeys(errors))


def enrich_report(report, reviews):
    result = dict(report)
    result["scores"] = {dimension: round(sum(review["scores"][dimension] for review in reviews) / 2, 1) for dimension in DIMENSIONS}
    result["score"] = round(sum(result["scores"].values()) / len(DIMENSIONS), 1)
    result["wordCount"] = word_count(report)
    result["readMinutes"] = max(1, math.ceil(result["wordCount"] / 220))
    result["reviews"] = reviews
    return result


def completed_runs(runs):
    return sorted([run for run in runs if isinstance(run, dict) and run.get("status") == "complete" and parse_date(run.get("finishedAt"))], key=lambda run: parse_date(run["finishedAt"]))


def is_due(config, runs, now=None):
    if config.get("enabled", True) is not True:
        return False
    completed = completed_runs(runs)
    return not completed or (now or now_utc()) >= parse_date(completed[-1]["finishedAt"]) + dt.timedelta(hours=float(config.get("intervalHours", 48)))


@contextlib.contextmanager
def project_lock(root):
    root.mkdir(parents=True, exist_ok=True)
    with (root / ".observatory.lock").open("a+") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("Another Observatory operation holds the project lock")
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def config_for(root):
    config = read_json(root / "config.json", {})
    hours = config.get("intervalHours", 48)
    if isinstance(hours, bool) or not isinstance(hours, (int, float)) or not math.isfinite(hours) or not 1 <= hours <= 8760:
        raise ValueError("intervalHours must be between 1 and 8760")
    if type(config.get("enabled", True)) is not bool:
        raise ValueError("enabled must be a boolean")
    for key, default, maximum in (("maxCandidatesPerRun", 40, 10000), ("bootstrapLookbackDays", 30, 3650), ("overlapHours", 72, 87600)):
        value = config.get(key, default)
        if type(value) is not int or not 1 <= value <= maximum:
            raise ValueError(key + " must be a positive integer no greater than " + str(maximum))
    return config


def load_reviews(root, report_id):
    return [review for suffix in ("a", "b") for review in [read_json(root / "data/reviews" / (report_id + "." + suffix + ".json"))] if review is not None]


def reports_with_validation(root):
    evidence = read_json(root / "data/evidence.json", [])
    accepted, rejected = [], {}
    for path in sorted((root / "data/reports").glob("*.json")):
        try:
            report = read_json(path)
            reviews = load_reviews(root, path.stem)
            errors = validate_report(report, evidence, reviews)
            if report.get("id") != path.stem:
                errors.append("Filename and report ID differ")
            if errors:
                rejected[path.stem] = errors
            else:
                accepted.append(enrich_report(report, reviews))
        except (ValueError, TypeError, KeyError, AttributeError) as exc:
            rejected[path.stem] = ["Invalid report data: " + str(exc)]
    return accepted, rejected


def public_sources(sources):
    keys = {"id", "name", "url", "kind", "topics", "status", "discoveredAt", "discoveredFrom", "lastCheckedAt", "lastSuccessAt", "lastCoverageAt", "monitor", "feedUrl", "notes"}
    result = []
    for source in sources:
        if not isinstance(source, dict):
            continue
        try:
            canonical_url(source.get("url"))
            if source.get("feedUrl"):
                canonical_url(source["feedUrl"])
        except ValueError:
            continue
        result.append({key: value for key, value in source.items() if key in keys})
    return result


def load_publication_baseline(root, required=False):
    baseline = read_json(root / "data/publication-baseline.json")
    if baseline is None:
        if required:
            raise ValueError("Publication baseline missing; run baseline --include-approved and commit it before publishing")
        return {"schemaVersion": 1, "approvedReportIds": [], "withdrawals": []}
    if not isinstance(baseline, dict) or baseline.get("schemaVersion") != 1:
        raise ValueError("Invalid publication baseline schema")
    ids = baseline.get("approvedReportIds")
    if not isinstance(ids, list) or any(not isinstance(item, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,99}", item) for item in ids) or len(set(ids)) != len(ids):
        raise ValueError("Invalid or duplicate publication baseline report IDs")
    withdrawals = baseline.get("withdrawals")
    if not isinstance(withdrawals, list):
        raise ValueError("Invalid publication withdrawal audit")
    for item in withdrawals:
        if not isinstance(item, dict) or not isinstance(item.get("reportId"), str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,99}", item["reportId"]) or not isinstance(item.get("reason"), str) or not item["reason"].strip() or not parse_date(item.get("withdrawnAt")):
            raise ValueError("Invalid publication withdrawal record")
        if item.get("restoredAt") is not None and not parse_date(item["restoredAt"]):
            raise ValueError("Invalid publication restoration date")
        if item.get("restoredAt") is None and item["reportId"] in ids:
            raise ValueError("Withdrawn report cannot remain in the active publication baseline")
    return baseline


def publication_baseline(root, args):
    baseline = load_publication_baseline(root)
    entries, _ = reports_with_validation(root)
    approved = {entry["id"] for entry in entries}
    active_withdrawals = {item["reportId"] for item in baseline["withdrawals"] if not item.get("restoredAt")}
    if args.include_approved:
        baseline["approvedReportIds"] = sorted(set(baseline["approvedReportIds"]) | (approved - active_withdrawals))
    elif args.withdraw:
        if not args.reason or not args.reason.strip():
            raise ValueError("Intentional withdrawal requires --reason")
        if args.withdraw not in baseline["approvedReportIds"]:
            raise ValueError("Withdrawal must name an active publication baseline report")
        baseline["approvedReportIds"].remove(args.withdraw)
        baseline["withdrawals"].append({"reportId": args.withdraw, "reason": args.reason.strip(), "withdrawnAt": timestamp()})
    elif args.restore:
        if args.restore not in active_withdrawals:
            raise ValueError("Restoration must name an intentionally withdrawn report")
        if args.restore not in approved:
            raise ValueError("Restoration requires two current approvals")
        for item in baseline["withdrawals"]:
            if item["reportId"] == args.restore and not item.get("restoredAt"):
                item["restoredAt"] = timestamp()
        baseline["approvedReportIds"] = sorted(set(baseline["approvedReportIds"]) | {args.restore})
    else:
        return baseline
    save_json(root / "data/publication-baseline.json", baseline)
    return baseline


def build(root, strict=False):
    config = config_for(root)
    entries, rejected = reports_with_validation(root)
    baseline = load_publication_baseline(root, required=strict)
    withdrawn_ids = {item["reportId"] for item in baseline["withdrawals"] if not item.get("restoredAt")}
    entries = [entry for entry in entries if entry["id"] not in withdrawn_ids]
    if strict:
        approved_ids = {entry["id"] for entry in entries}
        baseline_ids = set(baseline["approvedReportIds"])
        missing = baseline_ids - approved_ids
        if missing:
            raise ValueError("Publication would remove previously approved reports: " + ", ".join(sorted(missing)) + ". Finish their independent reviews, or explicitly withdraw with a recorded reason.")
        untracked = approved_ids - baseline_ids
        if untracked:
            raise ValueError("Approved reports missing from publication baseline: " + ", ".join(sorted(untracked)) + ". Run baseline --include-approved and commit the baseline.")
    if strict and not entries:
        raise ValueError("Publication refused: there are no fully approved, current reports")
    for filename in ("index.html", "styles.css", "app.js"):
        if not (root / "src" / filename).is_file():
            raise ValueError("Frontend file is missing: src/" + filename)
    sources = public_sources(read_json(root / "data/sources.json", []))
    runs = read_json(root / "data/runs.json", [])
    complete = completed_runs(runs)
    last = complete[-1] if complete else None
    last_scan = last["finishedAt"] if last else None
    next_scan = timestamp(parse_date(last_scan) + dt.timedelta(hours=config.get("intervalHours", 48))) if last_scan and config.get("enabled", True) else None
    allowed_run_keys = {"id", "startedAt", "finishedAt", "status", "windowStart", "windowEnd", "sourcesChecked", "sourcesFailed", "candidatesFound", "publishedCount", "coverageNote", "limitations"}
    payload = {"metadata": {"title": "AI Observatory", "generatedAt": timestamp(), "lastScanAt": last_scan, "nextScanAt": next_scan, "intervalHours": config.get("intervalHours", 48), "enabled": config.get("enabled", True), "timezone": config.get("timezone", "Europe/Berlin"), "coverageNote": (last or {}).get("coverageNote", "Initial research is in progress. Coverage is bounded; no claim of internet-wide completeness."), "repository": config.get("repository"), "siteUrl": config.get("siteUrl"), "rubricVersion": RUBRIC_VERSION, "rubricHash": RUBRIC_HASH, "sourceCount": len(sources), "monitoringSourceCount": sum(source.get("monitor", True) is not False and source.get("status") != "retired" for source in sources), "reportCount": len(entries), "pendingReportCount": len(rejected)}, "entries": sorted(entries, key=lambda item: item.get("discoveredAt", ""), reverse=True), "sources": sources, "runs": [{key: value for key, value in run.items() if key in allowed_run_keys} for run in runs]}
    staging = Path(tempfile.mkdtemp(prefix=".dist-stage-", dir=str(root)))
    backup = root / (".dist-backup-" + uuid.uuid4().hex)
    try:
        # Explicit source allowlist: never copy reports, evidence, browser traces or prompts.
        for filename in ("index.html", "styles.css", "app.js"):
            shutil.copy2(str(root / "src" / filename), str(staging / filename))
        assets = root / "src/assets"
        if assets.exists():
            for source in assets.rglob("*"):
                if source.is_symlink():
                    raise ValueError("Symlinks are forbidden in public assets")
                if source.is_file() and source.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".woff", ".woff2"}:
                    destination = staging / source.relative_to(root / "src")
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(str(source), str(destination))
        save_json(staging / "data.json", payload)
        save_json(staging / "manifest.json", {"schemaVersion": 1, "generatedAt": payload["metadata"]["generatedAt"], "reports": [{"id": entry["id"], "updatedAt": entry["updatedAt"], "reportHash": report_hash({key: value for key, value in entry.items() if key not in {"scores", "score", "wordCount", "readMinutes", "reviews"}})} for entry in entries]})
        feed = ET.Element("rss", version="2.0")
        channel = ET.SubElement(feed, "channel")
        for name, value in (("title", "AI Observatory"), ("link", config.get("siteUrl", "")), ("description", "Source-backed AI discoveries, independently reviewed by two Astra agents.")):
            ET.SubElement(channel, name).text = value
        ET.SubElement(channel, "lastBuildDate").text = email.utils.format_datetime(now_utc())
        for entry in sorted(entries, key=lambda item: item.get("updatedAt", ""), reverse=True):
            item = ET.SubElement(channel, "item")
            ET.SubElement(item, "title").text = entry["title"]
            ET.SubElement(item, "link").text = config.get("siteUrl", "").rstrip("/") + "/#report/" + entry["id"]
            ET.SubElement(item, "guid", isPermaLink="false").text = "ai-observatory:" + entry["id"]
            ET.SubElement(item, "description").text = entry["summary"]
            ET.SubElement(item, "pubDate").text = email.utils.format_datetime(parse_date(entry["updatedAt"]))
        ET.ElementTree(feed).write(str(staging / "feed.xml"), encoding="utf-8", xml_declaration=True)
        (staging / ".nojekyll").write_text("", encoding="utf-8")
        destination = root / "dist"
        if destination.exists():
            os.replace(str(destination), str(backup))
        try:
            os.replace(str(staging), str(destination))
        except Exception:
            if backup.exists():
                os.replace(str(backup), str(destination))
            raise
        if backup.exists():
            shutil.rmtree(str(backup))
    finally:
        if staging.exists():
            shutil.rmtree(str(staging))
    return {"publishedReports": len(entries), "excludedReports": rejected, "intentionallyWithdrawnReports": sorted(withdrawn_ids), "output": str(root / "dist")}


class FeedLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and "alternate" in attrs.get("rel", "").split() and attrs.get("type", "").lower() in {"application/rss+xml", "application/atom+xml"} and attrs.get("href"):
            self.links.append(attrs["href"])


def local_name(tag):
    return tag.rsplit("}", 1)[-1].lower()


def plain_text(value):
    parser = SafeMarkup()
    parser.feed(value or "")
    return " ".join(" ".join(parser.text).split())


def parse_feed(payload, base_url):
    if b"<!DOCTYPE" in payload.upper() or b"<!ENTITY" in payload.upper():
        raise ValueError("XML entities and DTDs are forbidden")
    document = ET.fromstring(payload)
    if local_name(document.tag) not in {"rss", "feed", "rdf"}:
        raise ValueError("Response is not RSS or Atom")
    entries = []
    seen_urls = set()
    for item in document.iter():
        if local_name(item.tag) not in {"item", "entry"}:
            continue
        title, link, published_date, updated_date = "", None, None, None
        summaries = []
        for child in item:
            name = local_name(child.tag)
            if name == "title":
                title = plain_text("".join(child.itertext()))[:500]
            elif name == "link":
                if child.attrib.get("rel", "alternate") == "alternate":
                    link = child.attrib.get("href") or child.text or link
            elif name in {"pubdate", "published", "date"}:
                published_date = parse_date(child.text)
            elif name == "updated":
                updated_date = parse_date(child.text)
            elif name in {"description", "summary", "content", "encoded"}:
                summaries.append(plain_text("".join(child.itertext())))
        if link and title:
            try:
                url = canonical_url(urljoin(base_url, link.strip()))
                if url not in seen_urls:
                    published_at = timestamp(published_date) if published_date else None
                    updated_at = timestamp(updated_date) if updated_date else None
                    fingerprint = digest({"title": title, "publishedAt": published_at, "updatedAt": updated_at, "summary": " ".join(summaries)})
                    entries.append({"title": title, "url": url, "publishedAt": published_at, "feedUpdatedAt": updated_at, "feedFingerprint": fingerprint})
                    seen_urls.add(url)
            except ValueError:
                continue
    return entries


def source_id(url):
    return "source-" + hashlib.sha256(canonical_url(url).encode()).hexdigest()[:16]


def candidate_id(url):
    return "candidate-" + hashlib.sha256(canonical_url(url).encode()).hexdigest()[:16]


def collect(root, force=False, max_seconds=180):
    config = config_for(root)
    runs = read_json(root / "data/runs.json", [])
    if not force and not is_due(config, runs):
        return {"status": "not_due", "candidatesAdded": 0}
    active = [run for run in runs if run.get("status") in {"collecting", "acquisition_complete"}]
    if active and not force:
        return {"status": "resume_required", "runId": active[-1]["id"], "message": "Finish or explicitly abandon the existing run before starting another."}
    sources = read_json(root / "data/sources.json", [])
    candidates = read_json(root / "data/candidates.json", [])
    def known_urls(records):
        result = set()
        for record in records:
            try:
                result.add(canonical_url(record.get("url")))
            except ValueError:
                continue
        return result
    source_urls = known_urls(sources)
    source_ids_by_url = {}
    for source in sources:
        try:
            source_ids_by_url[canonical_url(source.get("url"))] = source["id"]
        except ValueError:
            continue
    monitored_origins = {urlsplit(url).netloc for url in known_urls([source for source in sources if source.get("monitor", True) is not False])}
    latest_by_url, latest_by_feed = {}, {}
    for candidate in candidates:
        try:
            url = canonical_url(candidate.get("url"))
        except ValueError:
            continue
        latest_by_url[url] = candidate
        latest_by_feed[(url, candidate.get("publisherSourceId"))] = candidate
    complete = completed_runs(runs)
    start_time = now_utc()
    window_start = (parse_date(complete[-1].get("windowEnd")) or parse_date(complete[-1]["finishedAt"])) - dt.timedelta(hours=config.get("overlapHours", 72)) if complete else start_time - dt.timedelta(days=config.get("bootstrapLookbackDays", 30))
    selected_sources = [source for source in sources if source.get("status") in {"active", "blocked", "unverified"} and source.get("monitor", True) is not False]
    run = {"id": "scan-" + start_time.strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:6], "startedAt": timestamp(start_time), "finishedAt": None, "status": "collecting", "windowStart": timestamp(window_start), "windowEnd": timestamp(start_time), "sourcesChecked": 0, "sourcesFailed": 0, "candidatesFound": 0, "publishedCount": 0, "coverageNote": "Acquisition in progress; Chrome research and independent reviews are pending.", "limitations": [], "sourceIdsExpected": [source["id"] for source in selected_sources], "sourceResults": []}
    runs.append(run)
    save_json(root / "data/runs.json", runs)
    deadline = time.monotonic() + max_seconds
    additions = 0
    for source in selected_sources:
        prior_coverage = parse_date(source.get("lastCoverageAt"))
        initial_window = (parse_date(source.get("discoveredAt")) or start_time) - dt.timedelta(days=config.get("bootstrapLookbackDays", 30))
        source_window = min(window_start, prior_coverage - dt.timedelta(hours=config.get("overlapHours", 72)) if prior_coverage else initial_window)
        result = {"sourceId": source["id"], "status": "manual_required", "checkedAt": None, "windowStart": timestamp(source_window), "note": "Requires a Codex Chrome visit and source-backed research."}
        run["sourceResults"].append(result)
        if time.monotonic() >= deadline:
            result["note"] = "Collection time budget exhausted; source remains pending, not skipped."
            continue
        if not source.get("feedUrl"):
            continue
        source["lastCheckedAt"] = timestamp()
        result["checkedAt"] = source["lastCheckedAt"]
        try:
            payload, final_url, content_type = safe_fetch(source["feedUrl"], timeout=min(FETCH_TIMEOUT, max(0.1, deadline - time.monotonic())))
            entries = parse_feed(payload, final_url)
            result.update(status="success", note="RSS/Atom acquired; article claims still require semantic verification.")
            source["lastSuccessAt"] = timestamp()
            source["lastCoverageAt"] = run["windowEnd"]
            source["status"] = "active"
            for entry in entries:
                url = entry["url"]
                prior_feed_candidate = latest_by_feed.get((url, source["id"]))
                changed_known_entry = prior_feed_candidate and prior_feed_candidate.get("feedFingerprint") != entry["feedFingerprint"]
                dates = [date for date in (parse_date(entry["publishedAt"]), parse_date(entry.get("feedUpdatedAt"))) if date]
                latest_date = max(dates) if dates else None
                if latest_date and ((latest_date < source_window and not changed_known_entry) or latest_date > start_time + dt.timedelta(hours=24)):
                    continue
                story_source_id = source_ids_by_url.get(url, source_id(url))
                if url not in source_urls:
                    sources.append({"id": story_source_id, "name": entry["title"], "url": url, "kind": source.get("kind", "news"), "topics": source.get("topics", []), "status": "unverified", "monitor": False, "discoveredAt": timestamp(), "discoveredFrom": source["id"], "lastCheckedAt": None, "lastSuccessAt": None, "feedUrl": None, "notes": "Individual story discovered from a feed; not yet independently inspected."})
                    source_urls.add(url)
                    source_ids_by_url[url] = story_source_id
                parsed_url = urlsplit(url)
                publisher_url = urlunsplit((parsed_url.scheme, parsed_url.netloc, "/", "", ""))
                if parsed_url.netloc not in monitored_origins and publisher_url not in source_urls:
                    sources.append({"id": source_id(publisher_url), "name": parsed_url.hostname, "url": publisher_url, "kind": "news", "topics": [], "status": "unverified", "monitor": True, "discoveredAt": timestamp(), "discoveredFrom": story_source_id, "lastCheckedAt": None, "lastSuccessAt": None, "feedUrl": None, "notes": "New publisher origin discovered from a real story URL; inspect and classify before trusting it."})
                    source_urls.add(publisher_url)
                    source_ids_by_url[publisher_url] = source_id(publisher_url)
                    monitored_origins.add(parsed_url.netloc)
                if prior_feed_candidate and prior_feed_candidate.get("feedFingerprint") == entry["feedFingerprint"]:
                    continue
                # Retain all discoveries; maxCandidates controls per-run research priority, not evidence deletion.
                previous = prior_feed_candidate or latest_by_url.get(url)
                new_id = candidate_id(url)
                if previous:
                    new_id += "-" + digest({"fingerprint": entry["feedFingerprint"], "publisherSourceId": source["id"], "previousId": previous["id"]})[:12]
                candidate = {"id": new_id, "title": entry["title"], "url": url, "sourceId": story_source_id, "publisherSourceId": source["id"], "publishedAt": entry["publishedAt"], "feedUpdatedAt": entry.get("feedUpdatedAt"), "feedFingerprint": entry["feedFingerprint"], "discoveredAt": timestamp(), "runId": run["id"], "status": "pending", "researchPriority": "current" if additions < config.get("maxCandidatesPerRun", 40) else "backlog", "discoveryMethod": "rss_atom"}
                if previous:
                    candidate["revisionOf"] = previous["id"]
                    candidate["changeReason"] = "Feed title, date or summary changed; verify the underlying source." if prior_feed_candidate and prior_feed_candidate.get("feedFingerprint") else "First fingerprinted observation from this feed; a URL match alone does not establish unchanged content."
                    if previous.get("reportId"):
                        candidate["reportId"] = previous["reportId"]
                candidates.append(candidate)
                latest_by_url[url] = candidate
                latest_by_feed[(url, source["id"])] = candidate
                additions += 1
        except (ValueError, OSError, ET.ParseError, http.client.HTTPException) as exc:
            result.update(status="failed", note=str(exc)[:400])
            run["limitations"].append(source["id"] + ": " + result["note"])
        finally:
            run["sourcesChecked"] = sum(item["status"] == "success" for item in run["sourceResults"])
            run["sourcesFailed"] = sum(item["status"] == "failed" for item in run["sourceResults"])
            run["candidatesFound"] = additions
            # Discoveries must be durable before advancing a source watermark.
            # If this save fails, its previous coverage window remains intact.
            # If a later save fails, replay is safe because candidates dedupe.
            save_json(root / "data/candidates.json", candidates)
            save_json(root / "data/sources.json", sources)
            save_json(root / "data/runs.json", runs)
    run["status"] = "acquisition_complete"
    run["coverageNote"] = "Feed acquisition finished. Manual sources and candidate decisions must be accounted for before this becomes a complete scan."
    save_json(root / "data/runs.json", runs)
    return {"status": run["status"], "runId": run["id"], "candidatesAdded": additions, "sourcesSucceeded": run["sourcesChecked"], "sourcesFailed": run["sourcesFailed"], "manualSourcesPending": sum(item["status"] == "manual_required" for item in run["sourceResults"])}


def find_run(root, run_id):
    runs = read_json(root / "data/runs.json", [])
    matches = [run for run in runs if run.get("id") == run_id]
    if len(matches) != 1:
        raise ValueError("Run ID not found or duplicated")
    return runs, matches[0]


def record_source(root, args):
    partial = getattr(args, "partial", False)
    if partial and args.status != "success":
        raise ValueError("--partial requires --status success")
    runs, run = find_run(root, args.run_id)
    if run.get("status") == "complete":
        raise ValueError("Completed runs are immutable; create a new scan")
    sources = read_json(root / "data/sources.json", [])
    matching = [source for source in sources if source.get("id") == args.source_id]
    if len(matching) != 1:
        raise ValueError("Source ID not found or duplicated")
    source = matching[0]
    result = next((item for item in run.setdefault("sourceResults", []) if item.get("sourceId") == args.source_id), None)
    if result is None:
        result = {"sourceId": args.source_id}
        run["sourceResults"].append(result)
    result.update(status=args.status, checkedAt=timestamp(), note=args.note, coverageComplete=args.status == "success" and not partial)
    source["lastCheckedAt"] = result["checkedAt"]
    if args.status == "success":
        source["lastSuccessAt"] = result["checkedAt"]
        if not partial:
            source["lastCoverageAt"] = run["windowEnd"]
        source["status"] = "active"
    if partial:
        run.setdefault("limitations", []).append(args.source_id + ": Partial coverage at " + result["checkedAt"] + "; outstanding history was not fully checked at this visit. " + args.note)
    elif args.status == "failed":
        run.setdefault("limitations", []).append(args.source_id + ": " + args.note)
    run["sourcesChecked"] = sum(item["status"] == "success" for item in run["sourceResults"])
    run["sourcesFailed"] = sum(item["status"] == "failed" for item in run["sourceResults"])
    save_json(root / "data/sources.json", sources)
    save_json(root / "data/runs.json", runs)
    return result


def complete_run(root, args):
    runs, run = find_run(root, args.run_id)
    if run.get("status") == "complete":
        return {"status": "already_complete", "runId": args.run_id}
    results = {item["sourceId"]: item for item in run.get("sourceResults", [])}
    missing = [source_id for source_id in run.get("sourceIdsExpected", []) if results.get(source_id, {}).get("status") not in {"success", "failed"}]
    if missing:
        raise ValueError("Sources still need a recorded Chrome outcome: " + ", ".join(missing))
    decisions = read_json(root / "data/decisions.json", [])
    decided = {item.get("candidateId") or item.get("candidate_id") or item.get("id") for item in decisions if item.get("decision", item.get("status")) in {"included", "excluded", "needs_review", "unresolved"} and item.get("reason")}
    pending = [candidate["id"] for candidate in read_json(root / "data/candidates.json", []) if candidate.get("runId") == args.run_id and candidate["id"] not in decided]
    if pending:
        raise ValueError("Candidate dispositions are missing: " + ", ".join(pending))
    entries, excluded = reports_with_validation(root)
    run.update(status="complete", finishedAt=timestamp(), publishedCount=len(entries), coverageNote=args.coverage_note)
    if args.limitation:
        run.setdefault("limitations", []).extend(args.limitation)
    save_json(root / "data/runs.json", runs)
    return {"status": "complete", "runId": args.run_id, "publishableReports": len(entries), "pendingReports": len(excluded)}


def discover_feed(root, args):
    sources = read_json(root / "data/sources.json", [])
    source = next((source for source in sources if source.get("id") == args.source_id), None)
    if source is None:
        raise ValueError("Source ID not found")
    payload, url, content_type = safe_fetch(source["url"])
    parser = FeedLinks()
    parser.feed(payload.decode("utf-8", errors="replace"))
    found = []
    for link in parser.links:
        try:
            found.append(canonical_url(urljoin(url, link)))
        except ValueError:
            pass
    if found:
        source["feedUrl"] = found[0]
        save_json(root / "data/sources.json", sources)
    return {"sourceId": args.source_id, "feedLinks": list(dict.fromkeys(found)), "savedFeedUrl": source.get("feedUrl")}


def publish(root, args):
    result = build(root, strict=True)
    config = config_for(root)
    repository = config.get("repository", "")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Invalid GitHub repository configuration")
    def git(*arguments):
        return subprocess.check_output(["git", "-C", str(root)] + list(arguments), text=True).strip()
    if git("rev-parse", "--show-toplevel") != str(root):
        raise ValueError("Project must be its own Git repository")
    if git("status", "--porcelain", "--untracked-files=normal"):
        raise ValueError("Commit and push the reviewed public changes first; publication requires a clean working tree")
    branch = git("branch", "--show-current")
    if not branch:
        raise ValueError("Publication requires a named branch")
    local_head = git("rev-parse", "HEAD")
    remote = subprocess.check_output(["gh", "api", "repos/" + repository + "/commits/" + branch, "--jq", ".sha"], text=True).strip()
    if remote != local_head:
        raise ValueError("Local commit is not the remote branch commit; push reviewed changes first")
    subprocess.run(["gh", "workflow", "run", "pages.yml", "--repo", repository, "--ref", branch], check=True)
    result.update(status="deployment_requested", commit=local_head, repository=repository)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("due")
    collection = commands.add_parser("collect")
    collection.add_argument("--force", action="store_true", help="Start a new attempt even if not due; existing attempts remain in the ledger")
    collection.add_argument("--max-seconds", type=float, default=180)
    validation = commands.add_parser("validate")
    validation.add_argument("report_id", nargs="?")
    hashing = commands.add_parser("hashes")
    hashing.add_argument("report_id", nargs="?")
    building = commands.add_parser("build")
    building.add_argument("--strict", action="store_true", help="Refuse publication with zero approved reports")
    baseline = commands.add_parser("baseline", help="Track protected published report IDs and intentional withdrawals")
    baseline_action = baseline.add_mutually_exclusive_group()
    baseline_action.add_argument("--include-approved", action="store_true", help="Add currently approved report IDs without removing existing protection")
    baseline_action.add_argument("--withdraw", metavar="REPORT_ID", help="Intentionally remove a published report with an audit reason")
    baseline_action.add_argument("--restore", metavar="REPORT_ID", help="Restore an intentionally withdrawn report after current approval")
    baseline.add_argument("--reason", help="Required explanation for an intentional withdrawal")
    configuring = commands.add_parser("configure")
    configuring.add_argument("--interval-days", type=float)
    configuring.add_argument("--enabled", choices=["true", "false"])
    recording = commands.add_parser("record-source")
    recording.add_argument("--run-id", required=True)
    recording.add_argument("--source-id", required=True)
    recording.add_argument("--status", choices=["success", "failed"], required=True)
    recording.add_argument("--partial", action="store_true", help="With success, record accessible but incomplete history without advancing lastCoverageAt")
    recording.add_argument("--note", required=True)
    completion = commands.add_parser("complete-run")
    completion.add_argument("--run-id", required=True)
    completion.add_argument("--coverage-note", required=True)
    completion.add_argument("--limitation", action="append", default=[])
    feed = commands.add_parser("discover-feed")
    feed.add_argument("--source-id", required=True)
    commands.add_parser("publish")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    global RUBRIC_HASH
    rubric = read_json(root / "data/rubric.json", {})
    if rubric.get("version") != RUBRIC_VERSION:
        parser.error("A matching data/rubric.json is required")
    RUBRIC_HASH = digest(rubric)
    try:
        with project_lock(root):
            exit_code = 0
            if args.command == "due":
                config = config_for(root)
                runs = read_json(root / "data/runs.json", [])
                completed = completed_runs(runs)
                last = completed[-1]["finishedAt"] if completed else None
                output = {"due": is_due(config, runs), "enabled": config.get("enabled", True), "intervalHours": config.get("intervalHours", 48), "lastCompleteScan": last, "nextScanAt": timestamp(parse_date(last) + dt.timedelta(hours=config.get("intervalHours", 48))) if last and config.get("enabled", True) else None, "pendingRuns": [run["id"] for run in runs if run.get("status") in {"collecting", "acquisition_complete"}]}
            elif args.command == "configure":
                config = config_for(root)
                if args.interval_days is not None:
                    hours = args.interval_days * 24
                    if not math.isfinite(hours) or not 1 <= hours <= 8760:
                        raise ValueError("Interval must be between one hour and one year")
                    config["intervalHours"] = int(hours) if hours.is_integer() else hours
                if args.enabled is not None:
                    config["enabled"] = args.enabled == "true"
                save_json(root / "config.json", config)
                output = config
            elif args.command == "collect":
                if not math.isfinite(args.max_seconds) or not 1 <= args.max_seconds <= 1800:
                    raise ValueError("max-seconds must be between 1 and 1800")
                output = collect(root, args.force, args.max_seconds)
            elif args.command == "build":
                output = build(root, args.strict)
            elif args.command == "baseline":
                output = publication_baseline(root, args)
            elif args.command in {"hashes", "validate"}:
                evidence = read_json(root / "data/evidence.json", [])
                paths = sorted((root / "data/reports").glob("*.json"))
                if args.report_id:
                    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,99}", args.report_id):
                        raise ValueError("Invalid report ID")
                    paths = [root / "data/reports" / (args.report_id + ".json")]
                output = {}
                for path in paths:
                    report = read_json(path)
                    if report is None:
                        raise ValueError("Report not found: " + path.stem)
                    if args.command == "hashes":
                        output[path.stem] = {"reportHash": report_hash(report), "evidenceHash": evidence_hash(report, evidence), "rubricVersion": RUBRIC_VERSION, "rubricHash": RUBRIC_HASH, "wordCount": word_count(report)}
                    else:
                        errors = validate_report(report, evidence, load_reviews(root, path.stem))
                        output[path.stem] = {"valid": not errors, "errors": errors}
                        exit_code = max(exit_code, int(bool(errors)))
            elif args.command == "record-source":
                output = record_source(root, args)
            elif args.command == "complete-run":
                output = complete_run(root, args)
            elif args.command == "discover-feed":
                output = discover_feed(root, args)
            else:
                output = publish(root, args)
            print(json.dumps(output, ensure_ascii=False, indent=2))
            return exit_code
    except (ValueError, OSError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
