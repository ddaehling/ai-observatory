"""Publication-gate regression tests; run with python3 -m unittest discover -s tests."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import socket
import sys
import tempfile
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from xml.sax.saxutils import escape


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "observatory.py"
SPEC = importlib.util.spec_from_file_location("observatory_under_test", MODULE_PATH)
observatory = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = observatory
SPEC.loader.exec_module(observatory)

DIMENSIONS = ("usefulness", "impact", "novelty", "maturity", "openness")


def make_report(words=1000):
    return {
        "id": "test-tool",
        "title": "A documented educational tool",
        "entity": "Example",
        "category": "Tools",
        "tags": ["education"],
        "summary": "A sourced assessment of documented functionality.",
        "changeType": "baseline",
        "publishedAt": None,
        "discoveredAt": "2026-10-18T10:00:00Z",
        "updatedAt": "2026-10-18T10:00:00Z",
        "officialUrl": "https://example.com/tool",
        "sections": [{"id": "assessment", "title": "Assessment", "html": "<p>" + " ".join(["evidence"] * words) + "</p>"}],
        "useCases": ["Classroom preparation"],
        "limitations": ["Capabilities require independent evaluation."],
        "sources": [{
            "id": "source-one",
            "title": "Official documentation",
            "url": "https://example.com/tool/documentation",
            "accessedAt": "2026-10-18T09:00:00Z",
            "publishedAt": None,
            "locator": "Features section",
            "supports": "Documented educational functionality",
        }],
        "images": [],
        "judgment": "Useful for evaluation, with documented limitations.",
        "researchNote": "A baseline assessment; launch date remains unknown.",
    }


def make_evidence():
    return [{
        "id": "claim-one",
        "claim": "The documentation describes educational functionality.",
        "source_ids": ["source-one"],
        "locator": "Features section",
        "quote": "Educational functionality is available.",
        "event_date": None,
        "publication_date": None,
        "retrieval_date": "2026-10-18T09:00:00Z",
        "qualifiers": ["Vendor documentation"],
        "limitations": ["Not independently tested"],
    }]


def make_atom_feed(title="Story title", url="https://example.com/story", published_at="2026-10-17T10:00:00Z", updated_at="2026-10-18T10:00:00Z", summary="Documented functionality is available."):
    fields = "<title>" + escape(title) + "</title><link href=\"" + escape(url, {'"': "&quot;"}) + "\"/>"
    for tag, value in (("published", published_at), ("updated", updated_at), ("summary", summary)):
        if value is not None:
            fields += "<" + tag + ">" + escape(value) + "</" + tag + ">"
    return ('<feed xmlns="http://www.w3.org/2005/Atom"><entry>' + fields + "</entry></feed>").encode("utf-8")


def make_reviews(report, evidence, impact=4):
    reviews = []
    for reviewer in ("reviewer-a", "reviewer-b"):
        scores = {dimension: 4 for dimension in DIMENSIONS}
        scores["impact"] = impact
        reviews.append({
            "reportId": report["id"],
            "reviewerId": reviewer,
            "model": "gpt-6-astra",
            "effort": "high",
            "reviewedAt": "2026-10-18T11:00:00Z",
            "reportHash": observatory.report_hash(report),
            "evidenceHash": observatory.evidence_hash(report, evidence),
            "rubricVersion": observatory.RUBRIC_VERSION,
            "rubricHash": observatory.RUBRIC_HASH,
            "verdict": "approve",
            "scores": scores,
            "rationale": {dimension: "The cited documentation supports this rating." for dimension in DIMENSIONS},
            "confidence": "medium",
            "concerns": [],
        })
    return reviews


class CanonicalUrlTests(unittest.TestCase):
    def test_removes_tracking_and_fragment_and_sorts_query(self):
        actual = observatory.canonical_url(
            "https://GitHub.COM/OpenAI/Example?z=2&utm_source=newsletter&a=1&fbclid=tracker&gclid=tracker#readme"
        )
        self.assertEqual(actual, "https://github.com/OpenAI/Example?a=1&z=2")

    def test_preserves_scheme_and_case_sensitive_path(self):
        self.assertEqual(observatory.canonical_url("http://Example.com/CaseSensitive"), "http://example.com/CaseSensitive")

    def test_is_idempotent(self):
        raw = "https://example.com/docs?b=2&a=one%20two&utm_medium=email#section"
        once = observatory.canonical_url(raw)
        self.assertEqual(observatory.canonical_url(once), once)

    def test_rejects_unsafe_or_nonpublic_urls(self):
        urls = (
            "javascript:alert(1)", "file:///etc/passwd", "ftp://example.com/file",
            "//example.com/path", "/relative/path", "https://user:secret@example.com/",
            "http://localhost/", "http://127.0.0.1/", "http://10.1.2.3/",
            "http://172.16.0.1/", "http://192.168.1.1/", "http://169.254.169.254/",
            "http://[::1]/", "http://[fc00::1]/", "https:///missing-host",
        )
        for url in urls:
            with self.subTest(url=url), self.assertRaises(ValueError):
                observatory.canonical_url(url)


class TrustStoreTests(unittest.TestCase):
    def setUp(self):
        self.context = MagicMock(spec=observatory.ssl.SSLContext)
        self.context.verify_mode = observatory.ssl.CERT_REQUIRED
        self.context.check_hostname = True
        self.context.cert_store_stats.return_value = {"x509_ca": 0}
        self.verify_paths = SimpleNamespace(
            capath=None, openssl_cafile_env="SSL_CERT_FILE", openssl_capath_env="SSL_CERT_DIR"
        )
        guards = (
            patch.object(observatory.ssl, "create_default_context", return_value=self.context),
            patch.object(observatory.ssl, "get_default_verify_paths", return_value=self.verify_paths),
            patch.dict(observatory.os.environ, {}, clear=True),
        )
        for guard in guards:
            guard.start()
            self.addCleanup(guard.stop)

    def bundle(self, name, owner=0, mode=0o100644, exists=True):
        bundle = MagicMock(spec=Path)
        bundle.__str__.return_value = name
        bundle.is_file.return_value = exists
        bundle.stat.return_value = SimpleNamespace(st_uid=owner, st_mode=mode)
        return bundle

    def assert_verification_required(self, context):
        self.assertIs(context, self.context)
        self.assertEqual(context.verify_mode, observatory.ssl.CERT_REQUIRED)
        self.assertIs(context.check_hostname, True)

    def test_populated_default_context_is_preserved_without_fallback(self):
        self.context.cert_store_stats.return_value = {"x509_ca": 128}
        bundle = self.bundle("/etc/ssl/cert.pem")
        with patch.object(observatory, "SYSTEM_CA_BUNDLES", (bundle,)):
            context = observatory.verified_ssl_context()
        self.assert_verification_required(context)
        self.context.load_verify_locations.assert_not_called()
        observatory.ssl.get_default_verify_paths.assert_not_called()
        bundle.is_file.assert_not_called()

    def test_empty_store_loads_first_trusted_bundle_and_preserves_verification(self):
        self.context.cert_store_stats.side_effect = [{"x509_ca": 0}, {"x509_ca": 128}]
        first = self.bundle("/etc/ssl/cert.pem")
        second = self.bundle("/etc/ssl/certs/ca-certificates.crt")
        with patch.object(observatory, "SYSTEM_CA_BUNDLES", (first, second)):
            context = observatory.verified_ssl_context()
        self.assert_verification_required(context)
        self.context.load_verify_locations.assert_called_once_with(cafile="/etc/ssl/cert.pem")
        second.is_file.assert_not_called()

    def test_untrusted_bundle_ownership_or_permissions_are_skipped(self):
        cases = (("non-root owner", 1000, 0o100644), ("group writable", 0, 0o100664), ("world writable", 0, 0o100646))
        for label, owner, mode in cases:
            with self.subTest(case=label):
                self.context.load_verify_locations.reset_mock()
                self.context.cert_store_stats.side_effect = [{"x509_ca": 0}, {"x509_ca": 128}]
                unsafe = self.bundle("/etc/ssl/cert.pem", owner=owner, mode=mode)
                trusted = self.bundle("/etc/ssl/certs/ca-certificates.crt")
                with patch.object(observatory, "SYSTEM_CA_BUNDLES", (unsafe, trusted)):
                    context = observatory.verified_ssl_context()
                self.assert_verification_required(context)
                self.context.load_verify_locations.assert_called_once_with(cafile="/etc/ssl/certs/ca-certificates.crt")

    def test_absent_bundle_and_capath_fail_without_disabling_verification(self):
        missing = self.bundle("/etc/ssl/cert.pem", exists=False)
        with patch.object(observatory, "SYSTEM_CA_BUNDLES", (missing,)):
            with self.assertRaisesRegex(ValueError, "TLS trust store is empty"):
                observatory.verified_ssl_context()
        self.assert_verification_required(self.context)
        self.context.load_verify_locations.assert_not_called()

    def test_existing_default_capath_preserves_lazy_loaded_context(self):
        self.verify_paths.capath = "/configured/openssl/certs"
        bundle = self.bundle("/etc/ssl/cert.pem")
        with patch.object(observatory.Path, "is_dir", return_value=True) as is_directory, patch.object(observatory, "SYSTEM_CA_BUNDLES", (bundle,)):
            context = observatory.verified_ssl_context()
        self.assert_verification_required(context)
        is_directory.assert_called_once_with()
        self.context.load_verify_locations.assert_not_called()
        bundle.is_file.assert_not_called()

    def test_explicit_certificate_environment_configuration_is_preserved(self):
        for variable in ("SSL_CERT_FILE", "SSL_CERT_DIR"):
            with self.subTest(variable=variable):
                bundle = self.bundle("/etc/ssl/cert.pem")
                with patch.dict(observatory.os.environ, {variable: "/explicit/certificates"}, clear=True), patch.object(observatory, "SYSTEM_CA_BUNDLES", (bundle,)):
                    context = observatory.verified_ssl_context()
                self.assert_verification_required(context)
                self.context.load_verify_locations.assert_not_called()
                bundle.is_file.assert_not_called()

    def test_bundle_that_loads_no_roots_does_not_count_as_usable(self):
        bundle = self.bundle("/etc/ssl/cert.pem")
        with patch.object(observatory, "SYSTEM_CA_BUNDLES", (bundle,)):
            with self.assertRaisesRegex(ValueError, "TLS trust store is empty"):
                observatory.verified_ssl_context()
        self.context.load_verify_locations.assert_called_once_with(cafile="/etc/ssl/cert.pem")
        self.assert_verification_required(self.context)


class FetchDeadlineTests(unittest.TestCase):
    """Use connected local sockets: no listener, DNS lookup, or external network."""

    def serve_response(self, chunks):
        client, server = socket.socketpair()
        stop = threading.Event()
        errors = []

        def produce():
            try:
                server.settimeout(1)
                request = b""
                while b"\r\n\r\n" not in request and not stop.is_set():
                    received = server.recv(4096)
                    if not received:
                        return
                    request += received
                for delay, content in chunks:
                    if stop.wait(delay):
                        return
                    server.sendall(content)
            except (BrokenPipeError, ConnectionResetError):
                pass  # The fetch watchdog intentionally closes the client.
            except OSError as error:
                if not stop.is_set():
                    errors.append(error)
            finally:
                server.close()

        producer = threading.Thread(target=produce, daemon=True)
        producer.start()

        def cleanup():
            stop.set()
            try:
                client.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            client.close()
            producer.join(timeout=1)
            server.close()
            self.assertFalse(producer.is_alive(), "Response producer must stop during cleanup")
            self.assertEqual(errors, [])

        self.addCleanup(cleanup)
        return client

    def test_slow_trickle_body_obeys_overall_deadline(self):
        header = b"HTTP/1.1 200 OK\r\nContent-Length: 12\r\nContent-Type: text/plain\r\n\r\n"
        client = self.serve_response([(0, header)] + [(0.025, b"x") for _ in range(12)])
        with patch.object(observatory, "public_addresses", return_value=["93.184.216.34"]), patch.object(observatory.socket, "create_connection", return_value=client):
            started = time.monotonic()
            with self.assertRaises(TimeoutError):
                observatory.safe_fetch("http://example.com/feed.xml", timeout=0.08)
            self.assertLess(time.monotonic() - started, 0.25)

    def test_slow_trickle_headers_obey_overall_deadline(self):
        response = b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nContent-Type: text/plain\r\n\r\nok"
        client = self.serve_response([(0.025, bytes([byte])) for byte in response])
        with patch.object(observatory, "public_addresses", return_value=["93.184.216.34"]), patch.object(observatory.socket, "create_connection", return_value=client):
            started = time.monotonic()
            with self.assertRaises(TimeoutError):
                observatory.safe_fetch("http://example.com/feed.xml", timeout=0.08)
            self.assertLess(time.monotonic() - started, 0.25)

    def test_normal_response_succeeds_without_external_network(self):
        response = b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\nContent-Type: text/plain\r\n\r\nhello"
        client = self.serve_response([(0, response)])
        with patch.object(observatory, "public_addresses", return_value=["93.184.216.34"]) as addresses, patch.object(observatory.socket, "create_connection", return_value=client) as connect:
            result = observatory.safe_fetch("http://example.com/feed.xml", timeout=0.5)
        self.assertEqual(result, (b"hello", "http://example.com/feed.xml", "text/plain"))
        self.assertEqual(addresses.call_count, 1)
        self.assertEqual(connect.call_count, 1)
        self.assertEqual(connect.call_args.args[0], ("93.184.216.34", 80))


class DueTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)

    def run_at(self, hours_ago, status="complete"):
        when = (self.now - timedelta(hours=hours_ago)).isoformat()
        return {"id": f"run-{hours_ago}", "status": status, "startedAt": when, "finishedAt": when}

    def test_first_run_is_due(self):
        self.assertTrue(observatory.is_due({}, [], self.now))

    def test_disabled_always_skips(self):
        self.assertFalse(observatory.is_due({"enabled": False}, [], self.now))

    def test_default_interval_boundary(self):
        self.assertFalse(observatory.is_due({}, [self.run_at(47.999)], self.now))
        self.assertTrue(observatory.is_due({}, [self.run_at(48)], self.now))

    def test_configured_interval(self):
        self.assertFalse(observatory.is_due({"intervalHours": 72}, [self.run_at(49)], self.now))
        self.assertTrue(observatory.is_due({"intervalHours": 24}, [self.run_at(25)], self.now))

    def test_only_completed_runs_with_finish_times_delay_scan(self):
        runs = [self.run_at(100), self.run_at(1, "failed"), self.run_at(2, "running")]
        runs.append({"status": "complete", "startedAt": self.now.isoformat(), "finishedAt": None})
        self.assertTrue(observatory.is_due({}, runs, self.now))

    def test_latest_completed_run_wins_regardless_of_array_order(self):
        runs = [self.run_at(1), self.run_at(100)]
        self.assertFalse(observatory.is_due({}, runs, self.now))
        self.assertFalse(observatory.is_due({}, list(reversed(runs)), self.now))

    def test_completion_time_is_used_instead_of_start_time(self):
        run = self.run_at(2)
        run["startedAt"] = (self.now - timedelta(hours=60)).isoformat()
        self.assertFalse(observatory.is_due({}, [run], self.now))

    def test_iso_z_and_timezone_offset_are_compared_as_instants(self):
        for timestamp in ("2026-10-18T11:00:00Z", "2026-10-18T13:00:00+02:00"):
            with self.subTest(timestamp=timestamp):
                run = {"status": "complete", "finishedAt": timestamp}
                self.assertFalse(observatory.is_due({}, [run], self.now))

    def test_malformed_finish_time_cannot_delay_a_scan(self):
        run = {"status": "complete", "finishedAt": "not-a-date"}
        self.assertTrue(observatory.is_due({}, [run], self.now))


class HashTests(unittest.TestCase):
    def test_report_hash_is_sha256_of_canonical_utf8_json(self):
        report = {"z": "café", "a": {"two": 2, "one": 1}}
        canonical = json.dumps(report, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        self.assertEqual(observatory.report_hash(report), expected)
        self.assertEqual(observatory.report_hash(report), observatory.report_hash({"a": {"one": 1, "two": 2}, "z": "café"}))

    def test_evidence_hash_tracks_relevant_claim_and_source_changes(self):
        report, evidence = make_report(), make_evidence()
        original = observatory.evidence_hash(report, evidence)
        updated_evidence = deepcopy(evidence)
        updated_evidence[0]["claim"] = "The documented claim changed."
        self.assertNotEqual(original, observatory.evidence_hash(report, updated_evidence))
        updated_report = deepcopy(report)
        updated_report["sources"][0]["locator"] = "Revised source locator"
        self.assertNotEqual(original, observatory.evidence_hash(updated_report, evidence))

    def test_unrelated_claims_do_not_invalidate_evidence_hash(self):
        report, evidence = make_report(), make_evidence()
        unrelated = {"id": "unrelated", "source_ids": ["source-other"], "claim": "Unrelated claim"}
        self.assertEqual(observatory.evidence_hash(report, evidence), observatory.evidence_hash(report, evidence + [unrelated]))

    def test_claim_overlapping_any_report_source_is_included(self):
        report, evidence = make_report(), make_evidence()
        evidence[0]["source_ids"] = ["source-other", "source-one"]
        self.assertNotEqual(observatory.evidence_hash(report, []), observatory.evidence_hash(report, evidence))


class PublicationGateTests(unittest.TestCase):
    def setUp(self):
        self.report = make_report()
        self.evidence = make_evidence()
        self.reviews = make_reviews(self.report, self.evidence)

    def errors(self, report=None, evidence=None, reviews=None):
        return observatory.validate_report(
            self.report if report is None else report,
            self.evidence if evidence is None else evidence,
            self.reviews if reviews is None else reviews,
        )

    def test_complete_current_unanimous_reviews_pass(self):
        self.assertEqual(self.errors(), [])

    def test_requires_two_distinct_reviewers(self):
        self.assertTrue(self.errors(reviews=self.reviews[:1]))
        self.reviews[1]["reviewerId"] = self.reviews[0]["reviewerId"]
        self.assertTrue(self.errors())

    def test_model_effort_report_and_rubric_must_match(self):
        mutations = {
            "model": "gpt-6-sol", "effort": "medium", "reportId": "other-report",
            "rubricVersion": "0.9", "rubricHash": "0" * 64,
        }
        for key, value in mutations.items():
            with self.subTest(field=key):
                reviews = deepcopy(self.reviews)
                reviews[1][key] = value
                self.assertTrue(self.errors(reviews=reviews))

    def test_missing_rubric_hash_blocks(self):
        del self.reviews[1]["rubricHash"]
        self.assertTrue(self.errors())

    def test_reject_or_revise_verdict_blocks(self):
        for verdict in ("revise", "reject"):
            with self.subTest(verdict=verdict):
                reviews = deepcopy(self.reviews)
                reviews[1]["verdict"] = verdict
                self.assertTrue(self.errors(reviews=reviews))

    def test_report_or_relevant_evidence_edits_invalidate_reviews(self):
        report = deepcopy(self.report)
        report["summary"] += " Updated."
        self.assertTrue(self.errors(report=report))
        evidence = deepcopy(self.evidence)
        evidence[0]["quote"] = "The supporting passage changed."
        self.assertTrue(self.errors(evidence=evidence))

    def test_every_dimension_requires_an_integer_from_one_to_ten(self):
        for dimension in DIMENSIONS:
            for value in (0, 11, 4.0, "4", True, None):
                with self.subTest(dimension=dimension, value=value):
                    reviews = deepcopy(self.reviews)
                    reviews[0]["scores"][dimension] = value
                    self.assertTrue(self.errors(reviews=reviews))
            reviews = deepcopy(self.reviews)
            del reviews[0]["scores"][dimension]
            self.assertTrue(self.errors(reviews=reviews))

    def test_more_than_two_point_disagreement_blocks(self):
        self.reviews[1]["scores"]["usefulness"] = 6
        self.assertEqual(self.errors(), [])
        self.reviews[1]["scores"]["usefulness"] = 7
        self.assertTrue(self.errors())

    def test_malformed_reviews_return_errors_without_crashing(self):
        malformed = [None, {}, "invalid", [], [None, None], [{}, {}], [self.reviews[0], "invalid"], [self.reviews[0], {"scores": None}]]
        for reviews in malformed:
            with self.subTest(reviews=reviews):
                errors = observatory.validate_report(self.report, self.evidence, reviews)
                self.assertIsInstance(errors, list)
                self.assertTrue(errors)

    def test_malformed_scores_return_errors_without_crashing(self):
        for scores in (None, [], "invalid", 4):
            with self.subTest(scores=scores):
                reviews = deepcopy(self.reviews)
                reviews[1]["scores"] = scores
                self.assertTrue(self.errors(reviews=reviews))

    def test_unsafe_markup_blocks_even_when_reviews_are_fresh(self):
        payloads = (
            '<script>alert(1)</script>', '<iframe src="https://example.com"></iframe>',
            '<p onclick="alert(1)">click</p>', '<a href="javascript:alert(1)">click</a>',
            '<a href="&#106;avascript:alert(1)">click</a>',
        )
        for payload in payloads:
            with self.subTest(payload=payload):
                report = deepcopy(self.report)
                report["sections"][0]["html"] += payload
                reviews = make_reviews(report, self.evidence)
                self.assertTrue(self.errors(report=report, reviews=reviews))

    def test_comments_declarations_and_processing_instructions_block_with_fresh_reviews(self):
        payloads = {
            "browser_parser_differential": "<!--><img src=x onerror=alert(1)>-->",
            "normal_comment": "<!-- ordinary comment -->",
            "unclosed_comment": "<!-- unfinished comment",
            "bogus_declaration": "<!bogus declaration>",
            "cdata": "<![CDATA[<img src=x onerror=alert(1)>]]>",
            "processing_instruction": '<?xml version="1.0"?>',
        }
        for name, payload in payloads.items():
            with self.subTest(case=name):
                report = deepcopy(self.report)
                report["sections"][0]["html"] += payload
                reviews = make_reviews(report, self.evidence)
                self.assertTrue(self.errors(report=report, reviews=reviews))

    def test_safe_semantic_markup_is_accepted(self):
        report = deepcopy(self.report)
        report["sections"][0]["html"] = report["sections"][0]["html"].replace(
            "evidence", '<strong>evidence</strong>', 1
        ) + '<p><a href="https://example.com/docs">Documentation</a></p>'
        self.assertEqual(self.errors(report=report, reviews=make_reviews(report, self.evidence)), [])

    def test_word_count_uses_body_sections_only(self):
        report = make_report(words=899)
        report["summary"] = " ".join(["summary"] * 300)
        report["sections"][0]["title"] = " ".join(["heading"] * 300)
        report["judgment"] = " ".join(["judgment"] * 300)
        self.assertTrue(self.errors(report=report, reviews=make_reviews(report, self.evidence)))

    def test_impact_controls_word_count_target_with_inclusive_tolerance(self):
        for impact, target in ((4, 1000), (5, 2000), (7, 2000), (8, 3000)):
            for words in (int(target * 0.9), target, int(target * 1.1)):
                with self.subTest(impact=impact, words=words):
                    report = make_report(words)
                    reviews = make_reviews(report, self.evidence, impact=impact)
                    self.assertEqual(self.errors(report=report, reviews=reviews), [])
            for words in (int(target * 0.9) - 1, int(target * 1.1) + 1):
                with self.subTest(impact=impact, words=words):
                    report = make_report(words)
                    reviews = make_reviews(report, self.evidence, impact=impact)
                    self.assertTrue(self.errors(report=report, reviews=reviews))

    def test_average_impact_selects_target(self):
        report = make_report(2000)
        reviews = make_reviews(report, self.evidence)
        reviews[0]["scores"]["impact"] = 4
        reviews[1]["scores"]["impact"] = 6
        self.assertEqual(self.errors(report=report, reviews=reviews), [])


class EnrichmentTests(unittest.TestCase):
    def test_public_scores_are_arithmetic_means_and_preserve_both_reviews(self):
        report, evidence = make_report(), make_evidence()
        reviews = make_reviews(report, evidence)
        reviews[1]["scores"]["usefulness"] = 5
        reviews[1]["scores"]["openness"] = 6
        enriched = observatory.enrich_report(report, reviews)
        self.assertEqual(enriched["scores"], {"usefulness": 4.5, "impact": 4.0, "novelty": 4.0, "maturity": 4.0, "openness": 5.0})
        self.assertEqual(enriched["score"], 4.3)
        self.assertEqual(enriched["wordCount"], 1000)
        self.assertEqual(len(enriched["reviews"]), 2)
        self.assertEqual({review["reviewerId"] for review in enriched["reviews"]}, {"reviewer-a", "reviewer-b"})

    def test_enrichment_does_not_mutate_input_report_or_reviews(self):
        report, evidence = make_report(), make_evidence()
        reviews = make_reviews(report, evidence)
        report_before, reviews_before = deepcopy(report), deepcopy(reviews)
        observatory.enrich_report(report, reviews)
        self.assertEqual(report, report_before)
        self.assertEqual(reviews, reviews_before)


class BuildTests(unittest.TestCase):
    """Exercise publication with isolated project roots and no network access."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="observatory-build-test-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.addCleanup(patch.stopall)
        patch.object(observatory, "safe_fetch", side_effect=AssertionError("Build must not fetch network data")).start()
        for directory in ("data/reports", "data/reviews", "src/assets"):
            (self.root / directory).mkdir(parents=True)
        rubric = json.loads((MODULE_PATH.parents[1] / "data/rubric.json").read_text(encoding="utf-8"))
        self.write_json("data/rubric.json", rubric)
        self.write_json("config.json", {"intervalHours": 48, "enabled": True, "repository": "example/observatory", "siteUrl": "https://example.com/observatory/"})
        self.write_json("data/publication-baseline.json", {"schemaVersion": 1, "approvedReportIds": ["test-tool"], "withdrawals": []})
        self.report = make_report()
        self.evidence = make_evidence()
        self.evidence[0]["quote"] = "RAW_EVIDENCE_SENTINEL_MUST_STAY_PRIVATE"
        self.write_json("data/evidence.json", self.evidence)
        self.write_json("data/sources.json", [{
            "id": "source-one", "name": "Example documentation", "url": "https://example.com/tool/documentation",
            "kind": "official", "status": "active", "topics": ["education"], "notes": "Documentation checked.",
            "internalTrace": "PRIVATE_BROWSER_TRACE_SENTINEL",
        }])
        self.write_json("data/runs.json", [])
        for name, content in {
            "index.html": "<!doctype html><html lang=\"en\"><title>Test</title><body>Test</body></html>",
            "styles.css": "body { color: black; }",
            "app.js": "'use strict';",
        }.items():
            (self.root / "src" / name).write_text(content, encoding="utf-8")
        self.save_report(self.report, approved=True)

    def write_json(self, path, value):
        destination = self.root / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def save_report(self, report, approved=False):
        self.write_json("data/reports/" + report["id"] + ".json", report)
        if approved:
            for suffix, review in zip(("a", "b"), make_reviews(report, self.evidence)):
                self.write_json("data/reviews/" + report["id"] + "." + suffix + ".json", review)

    def built_data(self):
        return json.loads((self.root / "dist/data.json").read_text(encoding="utf-8"))

    def mark_previous_dist(self):
        (self.root / "dist").mkdir(exist_ok=True)
        marker = self.root / "dist/previous-release.txt"
        marker.write_bytes(b"previous published version\n")
        return marker

    def assert_previous_dist_preserved(self, marker):
        self.assertEqual(marker.read_bytes(), b"previous published version\n")
        self.assertEqual(sorted(path.name for path in marker.parent.iterdir()), [marker.name])
        self.assertEqual(list(self.root.glob(".dist-stage-*")), [])
        self.assertEqual(list(self.root.glob(".dist-backup-*")), [])

    def test_valid_report_is_published_but_unreviewed_report_is_excluded(self):
        unreviewed = make_report()
        unreviewed["id"] = "unreviewed-tool"
        unreviewed["title"] = "Unreviewed tool"
        self.save_report(unreviewed)
        result = observatory.build(self.root, strict=True)
        self.assertEqual(result["publishedReports"], 1)
        self.assertIn("unreviewed-tool", result["excludedReports"])
        data = self.built_data()
        self.assertEqual([entry["id"] for entry in data["entries"]], ["test-tool"])
        self.assertEqual(data["metadata"]["reportCount"], 1)
        self.assertEqual(data["metadata"]["pendingReportCount"], 1)
        for filename in ("index.html", "styles.css", "app.js", "data.json", ".nojekyll"):
            self.assertTrue((self.root / "dist" / filename).is_file())

    def test_edited_formerly_approved_report_is_removed_on_next_build(self):
        observatory.build(self.root, strict=True)
        self.assertEqual(len(self.built_data()["entries"]), 1)
        self.report["summary"] += " A change made after review."
        self.save_report(self.report)
        result = observatory.build(self.root)
        self.assertEqual(result["publishedReports"], 0)
        self.assertIn("test-tool", result["excludedReports"])
        self.assertEqual(self.built_data()["entries"], [])

    def test_strict_zero_approved_reports_preserves_previous_dist(self):
        marker = self.mark_previous_dist()
        (self.root / "data/reviews/test-tool.b.json").unlink()
        with self.assertRaises(ValueError):
            observatory.build(self.root, strict=True)
        self.assert_previous_dist_preserved(marker)

    def test_strict_build_cannot_drop_previously_approved_report_when_another_is_valid(self):
        second = make_report()
        second["id"] = "new-tool"
        self.save_report(second, approved=True)
        self.write_json("data/publication-baseline.json", {"schemaVersion": 1, "approvedReportIds": ["test-tool", "new-tool"], "withdrawals": []})
        self.report["summary"] += " Edited since the previous approvals."
        self.save_report(self.report)
        marker = self.mark_previous_dist()
        with self.assertRaisesRegex(ValueError, "previously approved reports: test-tool"):
            observatory.build(self.root, strict=True)
        self.assert_previous_dist_preserved(marker)

    def test_strict_build_requires_valid_publication_baseline(self):
        marker = self.mark_previous_dist()
        baseline_path = self.root / "data/publication-baseline.json"
        baseline_path.unlink()
        with self.assertRaises(ValueError):
            observatory.build(self.root, strict=True)
        self.assert_previous_dist_preserved(marker)
        invalid_baselines = (
            "{malformed json", "null", "[]",
            json.dumps({"schemaVersion": 2, "approvedReportIds": ["test-tool"], "withdrawals": []}),
            json.dumps({"schemaVersion": 1, "approvedReportIds": "test-tool", "withdrawals": []}),
            json.dumps({"schemaVersion": 1, "approvedReportIds": ["test-tool", "test-tool"], "withdrawals": []}),
            json.dumps({"schemaVersion": 1, "approvedReportIds": ["test-tool"], "withdrawals": [{"reportId": "old-tool", "reason": "", "withdrawnAt": "2026-10-18T12:00:00Z"}]}),
        )
        for baseline in invalid_baselines:
            with self.subTest(baseline=baseline):
                baseline_path.write_text(baseline, encoding="utf-8")
                with self.assertRaises(ValueError):
                    observatory.build(self.root, strict=True)
                self.assert_previous_dist_preserved(marker)

    def test_strict_build_requires_new_approved_report_to_be_tracked(self):
        second = make_report()
        second["id"] = "new-tool"
        self.save_report(second, approved=True)
        marker = self.mark_previous_dist()
        with self.assertRaisesRegex(ValueError, "missing from publication baseline: new-tool"):
            observatory.build(self.root, strict=True)
        self.assert_previous_dist_preserved(marker)

    def test_include_approved_adds_only_validated_reports_without_removing_prior_ids(self):
        self.write_json("data/publication-baseline.json", {"schemaVersion": 1, "approvedReportIds": ["test-tool", "prior-report"], "withdrawals": []})
        approved = make_report()
        approved["id"] = "new-tool"
        self.save_report(approved, approved=True)
        unreviewed = make_report()
        unreviewed["id"] = "unreviewed-tool"
        self.save_report(unreviewed)
        self.report["summary"] += " This edit still needs renewed approval."
        self.save_report(self.report)
        updated = observatory.publication_baseline(self.root, SimpleNamespace(
            include_approved=True, withdraw=None, reason=None, restore=None,
        ))
        self.assertEqual(set(updated["approvedReportIds"]), {"test-tool", "prior-report", "new-tool"})
        self.assertNotIn("unreviewed-tool", updated["approvedReportIds"])
        persisted = json.loads((self.root / "data/publication-baseline.json").read_text(encoding="utf-8"))
        self.assertEqual(persisted, updated)

    def test_withdrawal_requires_reason_is_audited_and_does_not_auto_restore(self):
        second = make_report()
        second["id"] = "new-tool"
        self.save_report(second, approved=True)
        self.write_json("data/publication-baseline.json", {"schemaVersion": 1, "approvedReportIds": ["test-tool", "new-tool"], "withdrawals": []})
        baseline_path = self.root / "data/publication-baseline.json"
        before = baseline_path.read_bytes()
        for reason in (None, "", " \n "):
            with self.subTest(reason=reason), self.assertRaises(ValueError):
                observatory.publication_baseline(self.root, SimpleNamespace(
                    include_approved=False, withdraw="test-tool", reason=reason, restore=None,
                ))
            self.assertEqual(baseline_path.read_bytes(), before)
        withdrawn_at = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)
        with patch.object(observatory, "now_utc", return_value=withdrawn_at):
            withdrawn = observatory.publication_baseline(self.root, SimpleNamespace(
                include_approved=False, withdraw="test-tool", reason="  Superseded by the replacement report.  ", restore=None,
            ))
        self.assertEqual(withdrawn["approvedReportIds"], ["new-tool"])
        self.assertEqual(withdrawn["withdrawals"], [{
            "reportId": "test-tool", "reason": "Superseded by the replacement report.", "withdrawnAt": "2026-10-18T12:00:00Z",
        }])
        included = observatory.publication_baseline(self.root, SimpleNamespace(
            include_approved=True, withdraw=None, reason=None, restore=None,
        ))
        self.assertEqual(included, withdrawn)
        result = observatory.build(self.root, strict=True)
        self.assertEqual(result["publishedReports"], 1)
        self.assertEqual(result["intentionallyWithdrawnReports"], ["test-tool"])
        self.assertEqual([entry["id"] for entry in self.built_data()["entries"]], ["new-tool"])
        self.assertTrue((self.root / "data/reports/test-tool.json").is_file())

    def test_missing_frontend_source_preserves_previous_dist(self):
        marker = self.mark_previous_dist()
        (self.root / "src/app.js").unlink()
        with self.assertRaises(ValueError):
            observatory.build(self.root, strict=True)
        self.assert_previous_dist_preserved(marker)

    def test_staging_copy_failure_preserves_previous_dist(self):
        marker = self.mark_previous_dist()
        original_copy = observatory.shutil.copy2

        def fail_styles_copy(source, destination, *args, **kwargs):
            if Path(source).name == "styles.css":
                raise OSError("Simulated copy failure")
            return original_copy(source, destination, *args, **kwargs)

        with patch.object(observatory.shutil, "copy2", side_effect=fail_styles_copy):
            with self.assertRaises(OSError):
                observatory.build(self.root, strict=True)
        self.assert_previous_dist_preserved(marker)

    def test_final_swap_failure_restores_previous_dist(self):
        marker = self.mark_previous_dist()
        original_replace = observatory.os.replace

        def fail_stage_swap(source, destination, *args, **kwargs):
            if Path(source).name.startswith(".dist-stage-") and Path(destination) == self.root / "dist":
                raise OSError("Simulated final swap failure")
            return original_replace(source, destination, *args, **kwargs)

        with patch.object(observatory.os, "replace", side_effect=fail_stage_swap):
            with self.assertRaises(OSError):
                observatory.build(self.root, strict=True)
        self.assert_previous_dist_preserved(marker)

    def test_build_exports_only_public_files_and_data(self):
        for relative in (".hidden-design-prompt.md", "src/.hidden-design-prompt.md", "src/assets/design-prompt.txt"):
            (self.root / relative).write_text("PRIVATE_DESIGN_PROMPT_SENTINEL", encoding="utf-8")
        self.write_json("data/candidates.json", [{"internalPrompt": "PRIVATE_CANDIDATE_SENTINEL"}])
        observatory.build(self.root, strict=True)
        output_paths = {path.relative_to(self.root / "dist").as_posix() for path in (self.root / "dist").rglob("*") if path.is_file()}
        self.assertTrue({"index.html", "styles.css", "app.js", "data.json", ".nojekyll"}.issubset(output_paths))
        for forbidden_path in ("evidence.json", "data/evidence.json", "data/candidates.json", ".hidden-design-prompt.md", "assets/design-prompt.txt"):
            self.assertNotIn(forbidden_path, output_paths)
        serialized_output = "\n".join((self.root / "dist" / path).read_text(encoding="utf-8") for path in output_paths)
        for sentinel in ("RAW_EVIDENCE_SENTINEL", "PRIVATE_DESIGN_PROMPT_SENTINEL", "PRIVATE_BROWSER_TRACE_SENTINEL", "PRIVATE_CANDIDATE_SENTINEL"):
            self.assertNotIn(sentinel, serialized_output)
        self.assertNotIn("evidence", self.built_data())


class FeedTests(unittest.TestCase):
    def setUp(self):
        network_guard = patch.object(observatory, "safe_fetch", side_effect=AssertionError("Feed parsing must be offline"))
        network_guard.start()
        self.addCleanup(network_guard.stop)

    def test_rss_canonicalizes_and_deduplicates_urls(self):
        rss = b'''<rss version="2.0"><channel><title>Example</title>
          <item><title>First title</title><link>https://EXAMPLE.com/story?b=2&amp;utm_source=feed&amp;a=1#top</link><pubDate>Sun, 18 Oct 2026 10:00:00 GMT</pubDate></item>
          <item><title>Duplicate title</title><link>https://example.com/story?a=1&amp;b=2</link></item>
          <item><title>Another story</title><link>/other?fbclid=tracker</link></item>
        </channel></rss>'''
        entries = observatory.parse_feed(rss, "https://example.com/feed.xml")
        self.assertEqual([entry["url"] for entry in entries], ["https://example.com/story?a=1&b=2", "https://example.com/other"])
        self.assertEqual(entries[0]["title"], "First title")
        self.assertEqual(entries[0]["publishedAt"], "2026-10-18T10:00:00Z")
        self.assertIsNone(entries[1]["publishedAt"])

    def test_atom_namespace_alternate_links_dates_and_deduplication(self):
        atom = b'''<feed xmlns="http://www.w3.org/2005/Atom">
          <entry><title>Atom story</title><link rel="self" href="https://example.com/api/story"/><link rel="alternate" href="/story?utm_campaign=feed"/><updated>2026-10-18T12:00:00+02:00</updated></entry>
          <entry><title>Duplicate</title><link href="https://example.com/story#details"/><published>2026-10-17T10:00:00Z</published></entry>
        </feed>'''
        entries = observatory.parse_feed(atom, "https://example.com/feed.atom")
        self.assertEqual(len(entries), 1)
        public_fields = {key: entries[0][key] for key in ("title", "url", "publishedAt", "feedUpdatedAt")}
        self.assertEqual(public_fields, {"title": "Atom story", "url": "https://example.com/story", "publishedAt": None, "feedUpdatedAt": "2026-10-18T10:00:00Z"})
        self.assertRegex(entries[0]["feedFingerprint"], r"^[0-9a-f]{64}$")

    def test_fingerprint_ignores_normalized_whitespace_tracking_and_retrieval_time(self):
        baseline = make_atom_feed()
        reformatted = make_atom_feed(
            title="  Story\n title  ",
            url="https://EXAMPLE.com/story?utm_source=feed#details",
            published_at="2026-10-17T12:00:00+02:00",
            updated_at="2026-10-18T12:00:00+02:00",
            summary="  Documented\n functionality   is available. ",
        )
        with patch.object(observatory, "now_utc", return_value=datetime(2026, 10, 18, tzinfo=timezone.utc)):
            first = observatory.parse_feed(baseline, "https://example.com/feed.atom")[0]
        with patch.object(observatory, "now_utc", return_value=datetime(2026, 11, 18, tzinfo=timezone.utc)):
            second = observatory.parse_feed(reformatted, "https://example.com/feed.atom")[0]
        self.assertEqual(first["url"], second["url"])
        self.assertEqual(first["feedFingerprint"], second["feedFingerprint"])

    def test_fingerprint_changes_with_title_publication_update_or_summary(self):
        original = observatory.parse_feed(make_atom_feed(), "https://example.com/feed.atom")[0]
        changes = (
            {"title": "Revised story title"},
            {"published_at": "2026-10-16T10:00:00Z"},
            {"updated_at": "2026-10-18T11:00:00Z"},
            {"summary": "Additional documented functionality is available."},
        )
        for change in changes:
            with self.subTest(change=change):
                changed = observatory.parse_feed(make_atom_feed(**change), "https://example.com/feed.atom")[0]
                self.assertEqual(original["url"], changed["url"])
                self.assertNotEqual(original["feedFingerprint"], changed["feedFingerprint"])

    def test_unsafe_schemes_and_nonpublic_links_are_excluded(self):
        rss = b'''<rss><channel>
          <item><title>Unsafe JavaScript</title><link>javascript:alert(1)</link></item>
          <item><title>Unsafe file</title><link>file:///etc/passwd</link></item>
          <item><title>Unsafe FTP</title><link>ftp://example.com/file</link></item>
          <item><title>Private IP</title><link>http://127.0.0.1/private</link></item>
          <item><title>Credentials</title><link>https://user:secret@example.com/private</link></item>
          <item><title>Public story</title><link>https://example.com/public</link></item>
        </channel></rss>'''
        entries = observatory.parse_feed(rss, "https://example.com/feed.xml")
        self.assertEqual([entry["url"] for entry in entries], ["https://example.com/public"])

    def test_xml_entities_and_dtds_are_rejected(self):
        payloads = (
            b'<!DOCTYPE rss [<!ENTITY secret SYSTEM "file:///etc/passwd">]><rss><channel/></rss>',
            b'<!DOCTYPE feed SYSTEM "https://example.com/external.dtd"><feed/>',
        )
        for payload in payloads:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                observatory.parse_feed(payload, "https://example.com/feed.xml")


class CollectTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="observatory-collect-test-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        (self.root / "data").mkdir()
        self.now = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)
        self.config = {"enabled": True, "intervalHours": 48, "bootstrapLookbackDays": 30, "overlapHours": 72, "maxCandidatesPerRun": 2}
        self.source = {
            "id": "publisher-one", "name": "Example publisher", "url": "https://example.com/",
            "kind": "official", "status": "active", "monitor": True, "topics": ["education"],
            "discoveredAt": "2026-10-01T12:00:00Z", "feedUrl": "https://example.com/feed.xml",
            "lastCheckedAt": None, "lastSuccessAt": None, "lastCoverageAt": None,
        }
        self.write_json("config.json", self.config)
        self.write_json("data/sources.json", [self.source])
        self.write_json("data/candidates.json", [])
        self.write_json("data/runs.json", [])
        for name, options in (("now_utc", {"return_value": self.now}), ("safe_fetch", {})):
            guard = patch.object(observatory, name, **options)
            mocked = guard.start()
            self.addCleanup(guard.stop)
            setattr(self, "clock" if name == "now_utc" else "fetch", mocked)
        budget_clock = patch.object(observatory.time, "monotonic", return_value=0)
        budget_clock.start()
        self.addCleanup(budget_clock.stop)
        self.fetch.return_value = self.feed_response(["https://example.com/story"])

    def write_json(self, path, value):
        (self.root / path).write_text(json.dumps(value), encoding="utf-8")

    def read_json(self, path):
        return json.loads((self.root / path).read_text(encoding="utf-8"))

    def feed_response(self, urls, date=None):
        date_element = "<pubDate>" + escape(date) + "</pubDate>" if date else ""
        items = "".join("<item><title>Story " + str(index) + "</title><link>" + escape(url) + "</link>" + date_element + "</item>" for index, url in enumerate(urls))
        payload = ("<rss><channel>" + items + "</channel></rss>").encode("utf-8")
        return payload, "https://example.com/feed.xml", "application/rss+xml"

    def test_monitored_source_is_fetched_once_and_duplicate_urls_add_one_candidate(self):
        self.fetch.return_value = self.feed_response([
            "https://EXAMPLE.com/story?utm_source=feed&b=2&a=1#top",
            "https://example.com/story?a=1&b=2",
        ])
        result = observatory.collect(self.root)
        self.assertEqual(self.fetch.call_count, 1)
        self.assertEqual(self.fetch.call_args.args[0], self.source["feedUrl"])
        self.assertEqual(result["candidatesAdded"], 1)
        candidates = self.read_json("data/candidates.json")
        self.assertEqual([item["url"] for item in candidates], ["https://example.com/story?a=1&b=2"])
        sources = self.read_json("data/sources.json")
        stories = [source for source in sources if source["url"] == candidates[0]["url"]]
        self.assertEqual(len(stories), 1)
        self.assertIs(stories[0]["monitor"], False)
        repeated = observatory.collect(self.root, force=True)
        self.assertEqual(self.fetch.call_count, 2)
        self.assertEqual(repeated["candidatesAdded"], 0)
        self.assertEqual(len(self.read_json("data/candidates.json")), 1)

    def test_changed_feed_creates_linked_revision_without_mutating_original_candidate(self):
        self.fetch.return_value = (make_atom_feed(), self.source["feedUrl"], "application/atom+xml")
        first_scan = observatory.collect(self.root)
        self.assertEqual(first_scan["candidatesAdded"], 1)
        original = self.read_json("data/candidates.json")[0]
        original.update(status="included", reportId="published-report", activity=[{"event": "reviewed", "at": "2026-10-18T12:00:00Z"}])
        self.write_json("data/candidates.json", [original])
        self.fetch.return_value = (make_atom_feed(title="Revised story title", summary="A newly documented capability."), self.source["feedUrl"], "application/atom+xml")
        self.clock.return_value = self.now + timedelta(days=2)
        revised_scan = observatory.collect(self.root, force=True)
        candidates = self.read_json("data/candidates.json")
        self.assertEqual(revised_scan["candidatesAdded"], 1)
        self.assertEqual(len(candidates), 2)
        self.assertEqual(candidates[0], original)
        revision = candidates[1]
        self.assertNotEqual(revision["id"], original["id"])
        self.assertEqual(revision["revisionOf"], original["id"])
        self.assertEqual(revision["reportId"], "published-report")
        self.assertEqual(revision["publisherSourceId"], original["publisherSourceId"])
        self.assertEqual(revision["status"], "pending")
        self.assertNotEqual(revision["feedFingerprint"], original["feedFingerprint"])
        self.clock.return_value = self.now + timedelta(days=4)
        repeated = observatory.collect(self.root, force=True)
        self.assertEqual(repeated["candidatesAdded"], 0)
        self.assertEqual(self.read_json("data/candidates.json"), candidates)

    def test_recent_atom_update_keeps_entry_with_old_publication_date(self):
        self.source["lastCoverageAt"] = "2026-10-16T12:00:00Z"
        self.write_json("data/sources.json", [self.source])
        self.write_json("data/runs.json", [{
            "id": "previous-complete", "status": "complete", "finishedAt": "2026-10-16T12:00:00Z",
            "windowEnd": "2026-10-16T12:00:00Z",
        }])
        self.fetch.return_value = (
            make_atom_feed(published_at="2026-06-01T10:00:00Z", updated_at="2026-10-18T10:00:00Z"),
            self.source["feedUrl"], "application/atom+xml",
        )
        result = observatory.collect(self.root)
        self.assertEqual(result["candidatesAdded"], 1)
        candidate = self.read_json("data/candidates.json")[0]
        self.assertEqual(candidate["publishedAt"], "2026-06-01T10:00:00Z")
        self.assertEqual(candidate["feedUpdatedAt"], "2026-10-18T10:00:00Z")
        source_result = self.read_json("data/runs.json")[-1]["sourceResults"][0]
        self.assertEqual(source_result["windowStart"], "2026-10-13T12:00:00Z")

    def test_changed_known_old_story_is_retained_after_completed_run_without_rewriting_report(self):
        self.fetch.return_value = (
            make_atom_feed(published_at="2026-10-03T10:00:00Z", updated_at=None),
            self.source["feedUrl"], "application/atom+xml",
        )
        acquired = observatory.collect(self.root)
        self.assertEqual(acquired["candidatesAdded"], 1)
        original = self.read_json("data/candidates.json")[0]
        original.update(status="included", reportId="published-report", activity=[{"event": "included", "at": "2026-10-18T12:00:00Z"}])
        self.write_json("data/candidates.json", [original])
        self.write_json("data/decisions.json", [{"candidateId": original["id"], "decision": "included", "reason": "Reviewed and included in the existing report."}])
        (self.root / "data/reports").mkdir()
        (self.root / "data/reviews").mkdir()
        report, evidence = make_report(), make_evidence()
        report["id"] = "published-report"
        self.write_json("data/reports/published-report.json", report)
        self.write_json("data/evidence.json", evidence)
        for suffix, review in zip(("a", "b"), make_reviews(report, evidence)):
            self.write_json("data/reviews/published-report." + suffix + ".json", review)
        report_before = (self.root / "data/reports/published-report.json").read_bytes()
        completed = observatory.complete_run(self.root, SimpleNamespace(
            run_id=acquired["runId"], coverage_note="All expected sources and candidates accounted for.", limitation=[],
        ))
        self.assertEqual(completed["status"], "complete")
        self.assertEqual(completed["publishableReports"], 1)

        self.clock.return_value = self.now + timedelta(days=4)
        self.fetch.return_value = (
            make_atom_feed(published_at="2026-10-03T10:00:00Z", updated_at=None, summary="The same source now documents an additional capability."),
            self.source["feedUrl"], "application/atom+xml",
        )
        result = observatory.collect(self.root)
        self.assertEqual(result["candidatesAdded"], 1)
        candidates = self.read_json("data/candidates.json")
        self.assertEqual(candidates[0], original)
        revision = candidates[1]
        self.assertEqual(revision["revisionOf"], original["id"])
        self.assertEqual(revision["reportId"], report["id"])
        self.assertEqual(revision["publishedAt"], "2026-10-03T10:00:00Z")
        self.assertIsNone(revision["feedUpdatedAt"])
        self.assertEqual(revision["discoveredAt"], "2026-10-22T12:00:00Z")
        self.assertNotIn("activity", revision)
        self.assertNotIn("updatedAt", revision)
        self.assertEqual(self.read_json("data/runs.json")[-1]["sourceResults"][0]["windowStart"], "2026-10-15T12:00:00Z")
        self.assertEqual((self.root / "data/reports/published-report.json").read_bytes(), report_before)

        self.fetch.return_value = (
            make_atom_feed(url="https://example.com/unseen-old-story", published_at="2026-10-03T10:00:00Z", updated_at=None),
            self.source["feedUrl"], "application/atom+xml",
        )
        unseen_old = observatory.collect(self.root, force=True)
        self.assertEqual(unseen_old["candidatesAdded"], 0)
        self.assertEqual(self.read_json("data/candidates.json"), candidates)

    def test_distinct_publishers_keep_separate_fingerprint_baselines(self):
        second_source = dict(self.source, id="publisher-two", url="https://second.example.com/", feedUrl="https://second.example.com/feed.atom")
        self.write_json("data/sources.json", [self.source, second_source])
        responses = {
            self.source["feedUrl"]: (make_atom_feed(title="Publisher one wording", summary="Publisher one's summary."), self.source["feedUrl"], "application/atom+xml"),
            second_source["feedUrl"]: (make_atom_feed(title="Publisher two wording", summary="Publisher two's summary."), second_source["feedUrl"], "application/atom+xml"),
        }
        self.fetch.side_effect = lambda url, **kwargs: responses[url]
        baseline_scan = observatory.collect(self.root)
        candidates = self.read_json("data/candidates.json")
        self.assertEqual(baseline_scan["candidatesAdded"], 2)
        self.assertEqual({candidate["publisherSourceId"] for candidate in candidates}, {"publisher-one", "publisher-two"})
        self.assertNotEqual(candidates[0]["feedFingerprint"], candidates[1]["feedFingerprint"])
        for offset in (2, 4):
            with self.subTest(days_later=offset):
                self.clock.return_value = self.now + timedelta(days=offset)
                self.write_json("data/sources.json", list(reversed(self.read_json("data/sources.json"))))
                repeated = observatory.collect(self.root, force=True)
                self.assertEqual(repeated["candidatesAdded"], 0)
                self.assertEqual(self.read_json("data/candidates.json"), candidates)

    def test_historical_story_with_monitor_false_is_not_expected_or_scanned(self):
        historical = dict(self.source, id="historical-story", url="https://archive.example.com/old-story", feedUrl="https://archive.example.com/feed.xml", monitor=False)
        self.write_json("data/sources.json", [self.source, historical])
        result = observatory.collect(self.root)
        self.assertEqual(self.fetch.call_count, 1)
        self.assertEqual(result["sourcesSucceeded"], 1)
        run = self.read_json("data/runs.json")[-1]
        self.assertEqual(run["sourceIdsExpected"], ["publisher-one"])
        self.assertEqual([item["sourceId"] for item in run["sourceResults"]], ["publisher-one"])
        saved_history = next(source for source in self.read_json("data/sources.json") if source["id"] == "historical-story")
        self.assertIsNone(saved_history["lastCheckedAt"])
        self.assertIsNone(saved_history["lastCoverageAt"])

    def test_candidate_overflow_is_retained_as_backlog(self):
        self.fetch.return_value = self.feed_response(["https://example.com/story-" + str(index) for index in range(5)])
        result = observatory.collect(self.root)
        self.assertEqual(result["candidatesAdded"], 5)
        candidates = self.read_json("data/candidates.json")
        self.assertEqual(len(candidates), 5)
        self.assertEqual([candidate["researchPriority"] for candidate in candidates], ["current", "current", "backlog", "backlog", "backlog"])
        self.assertEqual({candidate["status"] for candidate in candidates}, {"pending"})
        self.assertEqual(self.read_json("data/runs.json")[-1]["candidatesFound"], 5)

    def test_failed_fetch_keeps_coverage_and_next_scan_retries_full_overlap_window(self):
        self.source["lastCoverageAt"] = "2026-10-01T12:00:00Z"
        self.write_json("data/sources.json", [self.source])
        self.write_json("data/runs.json", [{
            "id": "previous-complete", "status": "complete", "finishedAt": "2026-10-15T12:00:00Z",
            "windowEnd": "2026-10-15T12:00:00Z",
        }])
        self.fetch.side_effect = [
            OSError("Simulated source failure"),
            self.feed_response(["https://example.com/older-unseen-story"], date="Tue, 29 Sep 2026 12:00:00 GMT"),
        ]
        result = observatory.collect(self.root)
        self.assertEqual(result["sourcesFailed"], 1)
        saved_source = self.read_json("data/sources.json")[0]
        self.assertEqual(saved_source["lastCoverageAt"], "2026-10-01T12:00:00Z")
        self.assertIsNone(saved_source["lastSuccessAt"])
        failed_result = self.read_json("data/runs.json")[-1]["sourceResults"][0]
        self.assertEqual(failed_result["status"], "failed")
        self.assertEqual(failed_result["windowStart"], "2026-09-28T12:00:00Z")
        self.clock.return_value = self.now + timedelta(days=2)
        retried = observatory.collect(self.root, force=True)
        retry_result = self.read_json("data/runs.json")[-1]["sourceResults"][0]
        self.assertEqual(retry_result["windowStart"], failed_result["windowStart"])
        self.assertEqual(retry_result["status"], "success")
        self.assertEqual(retried["candidatesAdded"], 1)
        self.assertEqual(self.read_json("data/candidates.json")[0]["url"], "https://example.com/older-unseen-story")
        self.assertEqual(self.read_json("data/sources.json")[0]["lastCoverageAt"], "2026-10-20T12:00:00Z")

    def test_successful_acquisition_does_not_complete_the_scan_or_reset_cadence(self):
        result = observatory.collect(self.root)
        self.assertEqual(result["status"], "acquisition_complete")
        runs = self.read_json("data/runs.json")
        self.assertEqual(runs[-1]["status"], "acquisition_complete")
        self.assertIsNone(runs[-1]["finishedAt"])
        self.assertTrue(observatory.is_due(self.config, runs, self.now))
        resumed = observatory.collect(self.root)
        self.assertEqual(resumed["status"], "resume_required")
        self.assertEqual(resumed["runId"], result["runId"])
        self.assertEqual(self.fetch.call_count, 1)

    def test_candidate_save_failure_preserves_coverage_and_old_story_is_recovered(self):
        self.source["lastCoverageAt"] = "2026-10-01T12:00:00Z"
        self.write_json("data/sources.json", [self.source])
        self.fetch.return_value = self.feed_response(
            ["https://example.com/october-third-story"], date="Sat, 03 Oct 2026 12:00:00 GMT"
        )
        original_save = observatory.save_json

        def fail_candidate_save(path, value):
            if Path(path) == self.root / "data/candidates.json":
                raise OSError("Simulated candidate persistence failure")
            return original_save(path, value)

        with patch.object(observatory, "save_json", side_effect=fail_candidate_save):
            with self.assertRaises(OSError):
                observatory.collect(self.root)
        self.assertEqual(self.read_json("data/candidates.json"), [])
        self.assertEqual(self.read_json("data/sources.json")[0]["lastCoverageAt"], "2026-10-01T12:00:00Z")

        interrupted_run = self.read_json("data/runs.json")[-1]
        observatory.record_source(self.root, SimpleNamespace(
            run_id=interrupted_run["id"], source_id=self.source["id"], status="failed",
            note="Candidate persistence failed; the source coverage checkpoint remains unchanged.",
        ))
        completed = observatory.complete_run(self.root, SimpleNamespace(
            run_id=interrupted_run["id"], coverage_note="Bounded scan with a recorded persistence failure.", limitation=[],
        ))
        self.assertEqual(completed["status"], "complete")
        self.assertEqual(self.read_json("data/candidates.json"), [])
        self.assertEqual(self.read_json("data/sources.json")[0]["lastCoverageAt"], "2026-10-01T12:00:00Z")

        self.clock.return_value = self.now + timedelta(days=4)
        recovered = observatory.collect(self.root)
        self.assertEqual(recovered["candidatesAdded"], 1)
        candidates = self.read_json("data/candidates.json")
        self.assertEqual([candidate["url"] for candidate in candidates], ["https://example.com/october-third-story"])
        self.assertEqual(candidates[0]["publishedAt"], "2026-10-03T12:00:00Z")
        retry = self.read_json("data/runs.json")[-1]
        self.assertEqual(retry["windowStart"], "2026-10-15T12:00:00Z")
        self.assertEqual(retry["sourceResults"][0]["windowStart"], "2026-09-28T12:00:00Z")
        self.assertEqual(self.read_json("data/sources.json")[0]["lastCoverageAt"], "2026-10-22T12:00:00Z")

    def test_source_save_failure_keeps_durable_candidate_without_advancing_coverage(self):
        self.source["lastCoverageAt"] = "2026-10-01T12:00:00Z"
        self.write_json("data/sources.json", [self.source])
        self.fetch.return_value = self.feed_response(
            ["https://example.com/october-third-story"], date="Sat, 03 Oct 2026 12:00:00 GMT"
        )
        original_save = observatory.save_json

        def fail_source_save(path, value):
            if Path(path) == self.root / "data/sources.json":
                raise OSError("Simulated source persistence failure")
            return original_save(path, value)

        with patch.object(observatory, "save_json", side_effect=fail_source_save):
            with self.assertRaises(OSError):
                observatory.collect(self.root)
        saved_candidates = self.read_json("data/candidates.json")
        self.assertEqual([candidate["url"] for candidate in saved_candidates], ["https://example.com/october-third-story"])
        self.assertEqual(self.read_json("data/sources.json")[0]["lastCoverageAt"], "2026-10-01T12:00:00Z")
        self.assertEqual(len(self.read_json("data/sources.json")), 1)

        self.clock.return_value = self.now + timedelta(days=4)
        retried = observatory.collect(self.root, force=True)
        self.assertEqual(retried["candidatesAdded"], 0)
        self.assertEqual(self.read_json("data/candidates.json"), saved_candidates)
        sources = self.read_json("data/sources.json")
        self.assertEqual(sources[0]["lastCoverageAt"], "2026-10-22T12:00:00Z")
        self.assertEqual(sum(source["url"] == "https://example.com/october-third-story" for source in sources), 1)


if __name__ == "__main__":
    unittest.main()
