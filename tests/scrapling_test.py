import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from scrapling_worker import browser_request_allowed, parse_document, pinned_host, public_url, render_document
TEMP = Path(__file__).resolve().parent.parent / '.test-runtime'
TEMP.mkdir(exist_ok=True)


class ScraplingTests(unittest.TestCase):
    def test_nested_links_are_normalized_without_inventing_event_facts(self):
        html = '<main><a href="/ctf"><span>Campus</span> CTF &amp; 2026</a><a href="/ctf">Repeat CTF</a><a href="https://127.0.0.1">Private CTF</a><a href="/register">Register CTF</a></main>'
        with tempfile.TemporaryDirectory(dir=TEMP, ignore_cleanup_errors=True) as directory:
            result = parse_document('https://events.example/', html, Path(directory))
        self.assertEqual(result['html'], html)
        self.assertEqual(result['links'], [{'title': 'Campus CTF & 2026', 'url': 'https://events.example/ctf'}])
        self.assertNotIn('start', result['links'][0])

    def test_adaptive_state_survives_a_layout_change_and_is_scoped_to_url(self):
        before = '<main id="events"><a href="/ctf">Campus CTF 2026</a></main>'
        after = '<div id="events"><a href="/ctf">Campus CTF 2026</a></div>'
        with tempfile.TemporaryDirectory(dir=TEMP, ignore_cleanup_errors=True) as directory:
            state = Path(directory)
            parse_document('https://events.example/', before, state)
            result = parse_document('https://events.example/', after, state)
            other = parse_document('https://events.example/another', after, state)
        self.assertTrue(result['adaptiveUsed'])
        self.assertFalse(other['adaptiveUsed'])
        self.assertEqual(result['html'], after)
        self.assertEqual(result['links'][0]['url'], 'https://events.example/ctf')

    def test_limits_and_unsafe_urls(self):
        for url in ('http://ctf.example/', 'https://localhost/', 'https://[::1]/', 'https://10.0.0.1/', 'https://user:password@ctf.example/', 'https://ctf.example:8080/'):
            self.assertFalse(public_url(url), url)
        with self.assertRaises(ValueError):
            parse_document('https://ctf.example/', 'x' * 1_500_001)
        with patch('scrapling_worker.socket.getaddrinfo', return_value=[(None, None, None, None, ('10.1.2.3', 443))]):
            with self.assertRaises(ValueError):
                pinned_host('ctf.example')

    def test_browser_cannot_follow_redirects_or_fetch_unapproved_origins(self):
        source = 'https://ctf.example/'
        self.assertTrue(browser_request_allowed(source, source, 'GET', 'document'))
        self.assertTrue(browser_request_allowed(source + 'app.js', source, 'GET', 'script'))
        for url, method, kind, redirected in [
            ('https://127.0.0.1/', 'GET', 'fetch', False),
            ('https://other.example/app.js', 'GET', 'script', False),
            (source + 'login', 'POST', 'fetch', False),
            (source + 'next', 'GET', 'document', False),
            (source + 'redirect', 'GET', 'script', True),
            (source, 'GET', 'image', False),
        ]:
            self.assertFalse(browser_request_allowed(url, source, method, kind, redirected))
        with self.assertRaises(ValueError):
            render_document('https://unapproved.example/', '<html></html>')


if __name__ == '__main__':
    unittest.main()
