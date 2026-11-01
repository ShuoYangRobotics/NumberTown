"""Integration checks for the dependency-free local launcher."""

import importlib.util
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "serve.py"
spec = importlib.util.spec_from_file_location("numbertown_server", SCRIPT)
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


def available_port():
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        return reservation.getsockname()[1]


class ExistingHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b"existing server is still running"
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class LocalServerTests(unittest.TestCase):
    def setUp(self):
        self.outside = tempfile.TemporaryDirectory()
        self.addCleanup(self.outside.cleanup)
        self.finished = {}

    def stop(self, process):
        if process in self.finished:
            return self.finished[process]
        if process.poll() is None:
            process.terminate()
        try:
            output = process.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            output = process.communicate(timeout=3)
        self.finished[process] = output
        return output

    def start(self):
        port = available_port()
        process = subprocess.Popen(
            [sys.executable, str(SCRIPT), "--port", str(port)],
            cwd=self.outside.name, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True,
        )
        self.addCleanup(self.stop, process)
        url = "http://127.0.0.1:{}/".format(port)
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if process.poll() is not None:
                self.fail("Launcher stopped before serving: {}".format(self.stop(process)))
            try:
                with urlopen(url, timeout=0.25) as response:
                    if response.status == 200:
                        return process, url, port
            except (URLError, OSError):
                time.sleep(0.025)
        self.fail("Launcher did not become ready within five seconds")

    def assert_fresh_headers(self, headers):
        self.assertIn("no-store", headers["Cache-Control"])
        self.assertIn("no-cache", headers["Cache-Control"])
        self.assertEqual(headers["Pragma"], "no-cache")
        self.assertEqual(headers["Expires"], "0")

    def test_serves_assets_from_script_directory_when_cwd_is_elsewhere(self):
        process, url, port = self.start()
        for path, mime in [("", "text/html"), ("game.js", "text/javascript"),
                           ("vendor/three.module.js", "text/javascript"),
                           ("styles.css", "text/css")]:
            with self.subTest(path=path), urlopen(url + path, timeout=2) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers.get_content_type(), mime)
                self.assert_fresh_headers(response.headers)
                expected = ROOT / "dist" / (path or "index.html")
                self.assertEqual(response.read(), expected.read_bytes())
        stdout, stderr = self.stop(process)
        self.assertIn("http://127.0.0.1:{}/".format(port), stdout)
        self.assertIn("Ctrl+C", stdout)
        self.assertNotIn("Traceback", stderr)

    def test_404_and_head_responses_also_disable_cache(self):
        _, url, _ = self.start()
        with self.assertRaises(HTTPError) as caught:
            urlopen(url + "missing-numbertown-file.js", timeout=2)
        with caught.exception as response:
            self.assertEqual(response.code, 404)
            self.assert_fresh_headers(response.headers)
        request = Request(url + "game.js", method="HEAD")
        with urlopen(request, timeout=2) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers.get_content_type(), "text/javascript")
            self.assert_fresh_headers(response.headers)
            self.assertEqual(response.read(), b"")

    def test_old_conditional_request_receives_current_module(self):
        _, url, _ = self.start()
        request = Request(url + "game.js", headers={
            "If-Modified-Since": "Thu, 01 Jan 2099 00:00:00 GMT",
        })
        with urlopen(request, timeout=2) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.read(), (ROOT / "dist" / "game.js").read_bytes())
            self.assert_fresh_headers(response.headers)

    def test_occupied_port_is_reported_without_disturbing_existing_server(self):
        existing = ThreadingHTTPServer(("127.0.0.1", 0), ExistingHandler)
        thread = threading.Thread(target=existing.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join, 3)
        self.addCleanup(existing.server_close)
        self.addCleanup(existing.shutdown)
        port = existing.server_address[1]
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--port", str(port)],
            cwd=self.outside.name, capture_output=True, text=True, timeout=5,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("already in use", result.stderr)
        self.assertIn(str(port), result.stderr)
        self.assertIn("--port", result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        with urlopen("http://127.0.0.1:{}/".format(port), timeout=2) as response:
            self.assertEqual(response.read(), b"existing server is still running")

    def test_defaults_and_port_validation(self):
        self.assertEqual(launcher.HOST, "127.0.0.1")
        self.assertEqual(launcher.parse_args([]).port, 5181)
        self.assertEqual(launcher.parse_args(["--port", "1"]).port, 1)
        self.assertEqual(launcher.parse_args(["--port", "65535"]).port, 65535)
        for value in ["0", "65536", "-1", "not-a-port", "5.5"]:
            with self.subTest(port=value):
                result = subprocess.run(
                    [sys.executable, str(SCRIPT), "--port", value],
                    cwd=self.outside.name, capture_output=True, text=True, timeout=5,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("between 1 and 65535", result.stderr)
                self.assertNotIn("Traceback", result.stderr)

    @unittest.skipIf(sys.platform == "win32", "SIGINT subprocess delivery differs on Windows")
    def test_ctrl_c_stops_cleanly_and_releases_port(self):
        process, _, port = self.start()
        process.send_signal(signal.SIGINT)
        stdout, stderr = process.communicate(timeout=5)
        self.finished[process] = (stdout, stderr)
        self.assertEqual(process.returncode, 0)
        self.assertIn("NumberTown stopped", stdout)
        self.assertNotIn("Traceback", stderr)
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(("127.0.0.1", port))


if __name__ == "__main__":
    unittest.main()
