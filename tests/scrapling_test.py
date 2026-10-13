import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from scrapling_worker import browser_request_allowed, parse_document, parse_social_document, pinned_host, public_url, render_document
TEMP = Path(__file__).resolve().parent.parent / '.test-runtime'
TEMP.mkdir(exist_ok=True)


class ScraplingTests(unittest.TestCase):
    def test_public_social_articles_keep_post_links_and_do_not_create_dates(self):
        html = '<article><p>Campus CTF 2026 registration is open!</p><a href="/team/status/123"><time datetime="2026-10-12T12:00:00Z">Yesterday</time></a><a href="https://ctf.example/2026">Official page</a></article>'
        result = parse_social_document('https://x.com/team', html, 'x')
        self.assertEqual(len(result['posts']), 1)
        self.assertEqual(result['posts'][0]['url'], 'https://x.com/team/status/123')
        self.assertEqual(result['posts'][0]['publishedAt'], '2026-10-12T12:00:00Z')
        self.assertNotIn('start', result['posts'][0])
        self.assertFalse(result['restricted'])

    def test_profile_biographies_are_not_posts_and_login_walls_are_reported(self):
        html = '<meta property="og:description" content="CTF registration open"><p>Log in to Instagram to view this profile</p>'
        result = parse_social_document('https://www.instagram.com/team/', html, 'instagram')
        self.assertEqual(result['posts'], [])
        self.assertTrue(result['restricted'])
        post = parse_social_document('https://www.instagram.com/p/abc123/', html, 'instagram')
        self.assertEqual(post['posts'][0]['url'], 'https://www.instagram.com/p/abc123/')

    def test_organizer_linked_social_posts_are_discovered_even_with_icon_labels(self):
        html = '<main><a href="https://www.instagram.com/p/abc123/">Instagram</a><a href="https://x.com/team/status/123">X</a><a href="https://x.com/team">Profile</a></main>'
        with tempfile.TemporaryDirectory(dir=TEMP, ignore_cleanup_errors=True) as directory:
            result = parse_document('https://events.example/', html, Path(directory))
        self.assertEqual(result['socialPosts'], ['https://www.instagram.com/p/abc123/', 'https://x.com/team/status/123'])

    def test_nested_links_are_normalized_without_inventing_event_facts(self):
        html = '<main><a href="/ctf"><span>Campus</span> CTF &amp; 2026</a><a href="/ctf">Repeat CTF</a><a href="https://127.0.0.1">Private CTF</a><a href="/register">Register CTF</a></main>'
        with tempfile.TemporaryDirectory(dir=TEMP, ignore_cleanup_errors=True) as directory:
            result = parse_document('https://events.example/', html, Path(directory))
        self.assertEqual(result['html'], html)
        self.assertEqual(result['links'], [{'title': 'Campus CTF & 2026', 'url': 'https://events.example/ctf'}])
        self.assertNotIn('start', result['links'][0])

    def test_blog_publication_metadata_is_retained_separately_from_event_dates(self):
        html = '<main><div class="post-preview"><p class="post-meta">Wed, 03 September 2025 ~ team</p><h2><a href="/announcement">Announcing Campus CTF</a></h2><p>Competition starts in November.</p></div></main>'
        with tempfile.TemporaryDirectory(dir=TEMP, ignore_cleanup_errors=True) as directory:
            result = parse_document('https://events.example/', html, Path(directory))
        self.assertEqual(result['links'][0]['publishedAt'], '2025-09-03T00:00:00+00:00')
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
