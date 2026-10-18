"""Exercise cadence controls without starting research or changing real config."""

import http.client
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.parse import urlencode
from datetime import datetime, timezone


SPEC = importlib.util.spec_from_file_location("control_panel", Path(__file__).resolve().parents[1] / "scripts" / "control_panel.py")
controls = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(controls)


class IntervalTests(unittest.TestCase):
    def test_supported_intervals(self):
        for value, expected in (("2", "2"), ("0.5", "0.5"), ("02.00", "2"), ("365", "365"), (str(1 / 24), str(1 / 24))):
            with self.subTest(value=value):
                self.assertEqual(controls.validate_interval(value), expected)

    def test_invalid_or_unsafe_intervals(self):
        for value in ("", "0", "-1", "0.01", "366", "nan", "NaN", "Infinity", "1e3", "2;touch x", "$(id)", " 2", "1.2.3", "9" * 25):
            with self.subTest(value=value), self.assertRaises(ValueError):
                controls.validate_interval(value)

    def test_configuration_uses_validated_argv_without_shell(self):
        with patch.object(controls.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, "", "")) as run:
            controls.save_configuration(Path("/tmp/project with spaces"), "02.00", True)
        self.assertEqual(run.call_args.args[0][1:], ["/tmp/project with spaces/scripts/observatory.py", "configure", "--interval-days", "2", "--enabled", "false"])
        self.assertNotIn("shell", run.call_args.kwargs)

    def test_invalid_value_cannot_start_configuration_process(self):
        with patch.object(controls.subprocess, "run") as run:
            with self.assertRaises(ValueError):
                controls.save_configuration(Path("/tmp/project"), "2;echo unsafe", False)
            run.assert_not_called()


class ScheduleTests(unittest.TestCase):
    def test_only_latest_completed_scan_controls_next_due(self):
        now = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)
        runs = [
            {"status": "complete", "finishedAt": "2026-10-17T10:00:00Z"},
            {"status": "running", "finishedAt": "2026-10-18T11:00:00Z"},
            {"status": "failed", "finishedAt": "2026-10-18T11:30:00Z"},
            {"status": "complete", "finishedAt": "2026-10-15T10:00:00Z"},
            {"status": "complete", "finishedAt": "invalid"},
        ]
        state = controls.schedule_summary({"intervalHours": 48}, runs, now)
        self.assertFalse(state["due"])
        self.assertEqual(state["next"].isoformat(), "2026-10-19T10:00:00+00:00")

    def test_paused_has_no_next_scan(self):
        state = controls.schedule_summary({"enabled": False}, [])
        self.assertTrue(state["paused"])
        self.assertFalse(state["due"])
        self.assertIsNone(state["next"])

    def test_no_history_is_due_but_not_falsely_completed(self):
        state = controls.schedule_summary({}, [])
        self.assertTrue(state["due"])
        self.assertIsNone(state["last"])

    def test_unsafe_site_urls_are_not_linked(self):
        for url in ("javascript:alert(1)", "http://example.com", "https://user:password@example.com", "https://example.com/\n", "https://[invalid", None):
            self.assertIsNone(controls.safe_site_url(url))
        self.assertEqual(controls.safe_site_url("https://example.com/"), "https://example.com/")


class HTTPControlsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        (self.root / "data").mkdir()
        self.config = {"intervalHours": 48, "enabled": True, "timezone": "Europe/Berlin", "siteUrl": "https://example.com/"}
        (self.root / "config.json").write_text(json.dumps(self.config))
        (self.root / "data" / "runs.json").write_text("[]")
        self.server = controls.ControlServer(self.root, 0)
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        self.thread.start()
        self.saver = patch.object(controls, "save_configuration")
        self.save = self.saver.start()
        self.status, self.headers, self.body = self.request("GET")
        self.cookie = self.headers["Set-Cookie"].split(";", 1)[0]
        self.csrf = re.search(r'name="csrf" value="([^"]+)"', self.body).group(1)

    def tearDown(self):
        self.saver.stop()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp.cleanup()

    def request(self, method, body=None, headers=None, path="/"):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        result = response.status, dict(response.getheaders()), response.read().decode("utf-8")
        conn.close()
        return result

    def post(self, values=None, headers=None):
        form = {"csrf": self.csrf, "interval_days": "2"}
        form.update(values or {})
        request_headers = {"Origin": self.server.origin, "Cookie": self.cookie, "Content-Type": "application/x-www-form-urlencoded"}
        request_headers.update(headers or {})
        return self.request("POST", urlencode(form), request_headers)

    def test_get_is_read_only_and_loopback_bound(self):
        self.assertEqual(self.status, 200)
        self.assertEqual(self.server.server_address[0], "127.0.0.1")
        self.save.assert_not_called()
        self.assertEqual(json.loads((self.root / "config.json").read_text()), self.config)
        self.assertIn("No completed scan recorded", self.body)
        self.assertIn("Codex and this Mac must be available", self.body)
        self.assertIn("HttpOnly; SameSite=Strict", self.headers["Set-Cookie"])
        self.assertEqual(self.headers["Cache-Control"], "no-store")
        self.assertEqual(self.headers["Referrer-Policy"], "same-origin")
        self.assertNotIn("Access-Control-Allow-Origin", self.headers)
        self.assertIn("frame-ancestors 'none'", self.headers["Content-Security-Policy"])

    def test_valid_form_saves_cadence_and_pause(self):
        status, _, body = self.post({"interval_days": "0.5", "paused": "1"})
        self.assertEqual(status, 200)
        self.save.assert_called_once_with(self.root, "0.5", True)
        self.assertIn("Saved locally", body)

    def test_unchecked_pause_resumes(self):
        self.assertEqual(self.post()[0], 200)
        self.save.assert_called_once_with(self.root, "2", False)

    def test_cross_origin_or_missing_origin_rejected(self):
        for origin in ("https://malicious.example", "null", "", "http://localhost:" + str(self.server.server_port)):
            with self.subTest(origin=origin):
                self.assertEqual(self.post(headers={"Origin": origin})[0], 403)
        self.save.assert_not_called()

    def test_absent_origin_accepts_only_a_same_origin_referrer(self):
        body = urlencode({"csrf": self.csrf, "interval_days": "2"})
        headers = {"Cookie": self.cookie, "Content-Type": "application/x-www-form-urlencoded", "Referer": self.server.origin + "/"}
        self.assertEqual(self.request("POST", body, headers)[0], 200)
        self.save.assert_called_once_with(self.root, "2", False)

    def test_absent_origin_without_valid_referrer_cannot_save(self):
        body = urlencode({"csrf": self.csrf, "interval_days": "2"})
        for referrer in (None, "", "https://malicious.example/", "http://127.0.0.1:1/", self.server.origin + "@malicious.example/", "http://user@" + self.server.host + "/"):
            headers = {"Cookie": self.cookie, "Content-Type": "application/x-www-form-urlencoded"}
            if referrer is not None:
                headers["Referer"] = referrer
            with self.subTest(referrer=referrer):
                self.assertEqual(self.request("POST", body, headers)[0], 403)
        self.save.assert_not_called()

    def test_referrer_cannot_override_explicit_bad_origin(self):
        for origin in ("null", "", "https://malicious.example"):
            with self.subTest(origin=origin):
                self.assertEqual(self.post(headers={"Origin": origin, "Referer": self.server.origin + "/"})[0], 403)
        self.save.assert_not_called()

    def test_referrer_fallback_still_requires_session_and_token(self):
        headers = {"Cookie": self.cookie, "Content-Type": "application/x-www-form-urlencoded", "Referer": self.server.origin + "/"}
        body = urlencode({"csrf": "wrong", "interval_days": "2"})
        self.assertEqual(self.request("POST", body, headers)[0], 403)
        headers.pop("Cookie")
        body = urlencode({"csrf": self.csrf, "interval_days": "2"})
        self.assertEqual(self.request("POST", body, headers)[0], 403)
        self.save.assert_not_called()

    def test_host_must_match_exact_loopback_url(self):
        for host in ("malicious.example", "localhost", "127.0.0.1:1"):
            with self.subTest(host=host):
                self.assertEqual(self.request("GET", headers={"Host": host})[0], 403)
                self.assertEqual(self.post(headers={"Host": host})[0], 403)
        self.save.assert_not_called()

    def test_invalid_token_or_session_rejected(self):
        for token in ("wrong", "", "é"):
            with self.subTest(token=token):
                self.assertEqual(self.post({"csrf": token})[0], 403)
        self.assertEqual(self.post(headers={"Cookie": ""})[0], 403)
        self.assertEqual(self.post(headers={"Cookie": self.cookie + "forged"})[0], 403)
        self.save.assert_not_called()

    def test_invalid_interval_or_duplicate_field_never_saves(self):
        self.assertEqual(self.post({"interval_days": "0"})[0], 400)
        self.assertEqual(self.post({"paused": "true"})[0], 400)
        self.assertEqual(self.post({"surprise": "1"})[0], 400)
        form = urlencode([("csrf", self.csrf), ("interval_days", "2"), ("interval_days", "3")])
        headers = {"Origin": self.server.origin, "Cookie": self.cookie, "Content-Type": "application/x-www-form-urlencoded"}
        self.assertEqual(self.request("POST", form, headers)[0], 400)
        self.save.assert_not_called()

    def test_child_process_error_is_escaped(self):
        self.save.side_effect = ValueError("<script>alert('bad')</script>")
        status, _, body = self.post()
        self.assertEqual(status, 400)
        self.assertIn("&lt;script&gt;", body)
        self.assertNotIn("<script>", body)

    def test_no_files_can_be_served(self):
        self.assertEqual(self.request("GET", path="/config.json")[0], 404)
        self.assertEqual(self.request("GET", path="/../config.json")[0], 404)

    def test_broken_config_does_not_report_a_fictional_schedule(self):
        (self.root / "config.json").write_text('{"intervalHours":"<bad>"}')
        status, _, body = self.request("GET")
        self.assertEqual(status, 200)
        self.assertIn("Could not read the local configuration", body)
        self.assertIn("Unavailable", body)


if __name__ == "__main__":
    unittest.main()
