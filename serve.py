#!/usr/bin/env python3
"""Serve NumberTown locally using only Python's standard library."""

import argparse
import errno
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys


HOST = "127.0.0.1"
DEFAULT_PORT = 5181
DIST = Path(__file__).resolve().parent / "dist"


def port_number(value):
    try:
        port = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError("port must be an integer between 1 and 65535") from None
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Play NumberTown on this computer.")
    parser.add_argument("--port", type=port_number, default=DEFAULT_PORT,
                        help="local port, from 1 to 65535 (default: 5181)")
    return parser.parse_args(argv)


class NumberTownHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        # Always send the current asset, even if an older browser session has
        # retained a Last-Modified date from another local server.
        if "If-Modified-Since" in self.headers:
            del self.headers["If-Modified-Since"]
        return super().send_head()


def main(argv=None):
    args = parse_args(argv)
    if not (DIST / "index.html").is_file():
        print("NumberTown files were not found. Keep serve.py beside the dist folder.",
              file=sys.stderr)
        return 1

    handler = partial(NumberTownHandler, directory=str(DIST))
    try:
        server = ThreadingHTTPServer((HOST, args.port), handler)
    except OSError as error:
        if error.errno in (errno.EADDRINUSE, 10048):
            print("NumberTown could not start: port {} is already in use.\n"
                  "Choose another port with: python3 serve.py --port <port>".format(args.port),
                  file=sys.stderr)
        else:
            print("NumberTown could not start at {}:{}: {}".format(
                HOST, args.port, error.strerror or str(error)), file=sys.stderr)
        return 1

    with server:
        print("NumberTown is ready: http://{}:{}/".format(HOST, args.port), flush=True)
        print("Press Ctrl+C to stop.", flush=True)
        try:
            server.serve_forever(poll_interval=0.2)
        except KeyboardInterrupt:
            print("\nNumberTown stopped.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
