"""Real Chromium test with an intercepted document and no external network."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from scrapling_worker import render_document


class BrowserTest(unittest.TestCase):
    def test_javascript_announcements_render_and_private_fetches_are_blocked(self):
        html = '''<html><body><main id="events"></main><script>
        const event = {"@type":"Event","name":"Fixture CTF 2026",
          "startDate":"2026-11-01T12:00:00Z","endDate":"2026-11-02T12:00:00Z",
          "eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode"};
        const data = document.createElement('script'); data.type='application/ld+json';
        data.textContent=JSON.stringify(event); document.head.append(data);
        document.querySelector('main').innerHTML='<a href="/ctf">Fixture CTF 2026</a>';
        fetch('https://127.0.0.1/private').catch(()=>document.body.dataset.blocked='yes');
        </script></body></html>'''
        with patch('scrapling_worker.render_profile', return_value={'render': True}), patch('scrapling_worker.pinned_host', return_value='MAP ctf.example 192.0.2.1'):
            rendered = render_document('https://ctf.example/', html)
        self.assertIn('<script type="application/ld+json">', rendered)
        self.assertIn('data-blocked="yes"', rendered)
        self.assertIn('<a href="/ctf">Fixture CTF 2026</a>', rendered)


if __name__ == '__main__':
    unittest.main()
