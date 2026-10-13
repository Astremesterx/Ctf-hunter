"""Scrapling parsing and bounded rendering for the scheduled SignalCTF worker.

The parent downloads HTML with robots/public-host/size checks. Adaptive matches
discover review leads only; the TypeScript verifier reads the complete document.
"""
import hashlib
import ipaddress
import json
import logging
import re
import socket
import sys
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from scrapling import Selector

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / '.scrapling-state'
MAX_HTML = 1_500_000
USER_AGENT = 'SignalCTF/1.0 (+https://signal-ctf.vercel.app/sources)'
CTF = re.compile(r'\bctf\b|ctf\s*20\d{2}|capture[\s_-]*the[\s_-]*flag', re.I)
logging.getLogger('scrapling').setLevel(logging.ERROR)


def public_url(url):
    try:
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.port not in (None, 443) or parsed.username or parsed.password:
            return False
        host = parsed.hostname.lower().rstrip('.')
        if host in ('localhost', 'metadata.google.internal') or host.endswith(('.local', '.internal', '.localhost')):
            return False
        try:
            return ipaddress.ip_address(host).is_global
        except ValueError:
            return '.' in host and len(url) <= 2048
    except (ValueError, TypeError):
        return False


def pinned_host(host):
    addresses = {item[4][0] for item in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)}
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError('Non-public browser host')
    # Prefer IPv4 for predictable Chromium host-resolver syntax on all runners.
    address = sorted(addresses, key=lambda item: ':' in item)[0]
    return f'MAP {host} [{address}]' if ':' in address else f'MAP {host} {address}'


def render_profile(url):
    sources = json.loads((ROOT / 'data/scraping-sources.json').read_text(encoding='utf-8'))
    return next((source for source in sources['organizers'] if source['url'] == url and source.get('render')), None)


def browser_request_allowed(url, source_url, method, resource_type, redirected=False):
    if method != 'GET' or redirected or not public_url(url):
        return False
    target, source = urlsplit(url), urlsplit(source_url)
    if (target.scheme, target.netloc) != (source.scheme, source.netloc):
        return False
    if resource_type == 'document':
        return url == source_url
    return resource_type in ('script', 'xhr', 'fetch')


def render_document(url, html):
    if not render_profile(url):
        raise ValueError('URL is not approved for browser rendering')
    from scrapling.fetchers import DynamicFetcher

    rules = pinned_host(urlsplit(url).hostname) + ', MAP * ~NOTFOUND'
    request_count = 0

    def setup(page):
        def route_request(route):
            nonlocal request_count
            request_count += 1
            request = route.request
            if request_count > 60 or not browser_request_allowed(request.url, url, request.method, request.resource_type, bool(request.redirected_from)):
                route.abort()
            elif request.resource_type == 'document':
                # Reuse the exact bounded, robots-approved HTML fetched by Node.
                route.fulfill(status=200, content_type='text/html; charset=utf-8', body=html)
            else:
                route.continue_()

        try:
            page.context.route('**/*', route_request)
            page.context.route_web_socket('**/*', lambda route: route.close())
            page.context.on('page', lambda popup: popup.close())
        except Exception:
            # Scrapling logs setup errors and continues; close the page so a
            # failed guard cannot accidentally permit an unrestricted load.
            page.close()
            raise

    page = DynamicFetcher.fetch(
        url, headless=True, timeout=15_000, retries=1, wait=1000,
        # Our route handler owns filtering; Scrapling's page-level resource
        # handler would otherwise override the context-level network guard.
        network_idle=False, disable_resources=False, google_search=False,
        useragent=USER_AGENT, page_setup=setup,
        extra_flags=[f'--host-resolver-rules={rules}', '--no-proxy-server', '--disable-quic'],
        additional_args={'service_workers': 'block', 'accept_downloads': False},
        selector_config={'huge_tree': False},
    )
    if page.status != 200:
        raise ValueError('Browser did not return a successful document')
    result = page.body.decode('utf-8', errors='replace')
    if len(result.encode('utf-8')) > MAX_HTML:
        raise ValueError('Rendered document too large')
    return result


def link_publication_date(anchor):
    parent = anchor.parent
    for _ in range(4):
        if parent is None:
            break
        times = parent.css('time::attr(datetime)')
        if len(times) == 1:
            return str(times[0])[:100]
        metadata = parent.css('.post-meta')
        if len(metadata) == 1:
            text = str(metadata[0].get_all_text(separator=' ', strip=True))
            match = re.search(r'\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(\d{1,2}\s+[A-Z][a-z]+\s+20\d{2})', text)
            if match:
                try:
                    return datetime.strptime(match[1], '%d %B %Y').replace(tzinfo=timezone.utc).isoformat()
                except ValueError:
                    pass
        parent = parent.parent
    return None


def parse_document(url, html, state_dir=STATE):
    if not public_url(url) or len(html.encode('utf-8')) > MAX_HTML:
        raise ValueError('Invalid input document')
    state_dir.mkdir(parents=True, exist_ok=True)
    page = Selector(html, url=url, adaptive=True, huge_tree=False,
                    storage_args={'storage_file': str(state_dir / 'selectors.db'), 'url': url})
    identifier = hashlib.sha256(url.encode()).hexdigest() + ':main:v1'
    main = page.css('main', auto_save=True, identifier=identifier)
    adaptive_used = False
    if not main and page.retrieve(identifier):
        main = page.css('main', adaptive=True, identifier=identifier)
        adaptive_used = bool(main)
    scopes = [main[0], page] if main else [page]
    links, seen = [], set()
    for scope in scopes:
        for anchor in scope.css('a[href]'):
            title = re.sub(r'\s+', ' ', str(anchor.get_all_text(separator=' ', strip=True))).strip()
            target = urljoin(url, anchor.attrib['href'])
            if not CTF.search(title) or not public_url(target) or target in seen:
                continue
            if re.search(r'login|sign.?in|logout|register|scoreboard|privacy|rules|challenge', urlsplit(target).path, re.I):
                continue
            published = link_publication_date(anchor)
            links.append({'title': title[:150], 'url': target, **({'publishedAt': published} if published else {})})
            seen.add(target)
            if len(links) >= 24:
                break
        if len(links) >= 24:
            break
    social_posts = []
    for anchor in page.css('a[href]'):
        target = urljoin(url, anchor.attrib['href'])
        if social_permalink(target) and target not in social_posts:
            social_posts.append(target)
        if len(social_posts) >= 12:
            break
    return {'url': url, 'html': html, 'links': links, 'socialPosts': social_posts, 'adaptiveUsed': adaptive_used, 'rendered': False}


def social_permalink(url, platform=None):
    if not public_url(url):
        return False
    parsed = urlsplit(url)
    host, path = parsed.hostname.removeprefix('www.'), parsed.path
    found = 'instagram' if host == 'instagram.com' else 'x' if host in ('x.com', 'twitter.com') else 'facebook' if host == 'facebook.com' else None
    if not found or platform and platform != found:
        return False
    return bool(re.fullmatch(r'/(?:p|reel)/[\w-]+/?', path)) if found == 'instagram' else bool(re.fullmatch(r'/\w+/status/\d+/?', path)) if found == 'x' else bool(re.fullmatch(r'/(?:[^/]+/posts/[^/]+|events/\d+)/?', path) or path == '/permalink.php' and re.search(r'(?:^|&)story_fbid=\d+(?:&|$)', parsed.query))


def parse_social_document(url, html, platform):
    if not public_url(url) or len(html.encode('utf-8')) > MAX_HTML:
        raise ValueError('Invalid social document')
    page = Selector(html, huge_tree=False)
    posts, seen = [], set()
    for article in page.css('article, [data-testid="tweet"], [role="article"]'):
        links = [link for anchor in article.css('a[href]') if len(link := urljoin(url, anchor.attrib['href'])) <= 2048]
        permalink = next((link for link in links if social_permalink(link, platform)), None)
        if not permalink or permalink in seen:
            continue
        seen.add(permalink)
        posts.append({'url': permalink, 'text': str(article.get_all_text(separator=' ', strip=True))[:2000], 'links': links[:30], 'publishedAt': article.css('time::attr(datetime)').get()})
        if len(posts) >= 24:
            break
    if not posts and social_permalink(url, platform):
        description = page.css('meta[property="og:description"]::attr(content), meta[name="description"]::attr(content)').get()
        if description:
            posts.append({'url': url, 'text': description[:2000], 'links': [], 'publishedAt': None})
    text = str(page.get_all_text(separator=' ', strip=True))
    restricted = not posts and bool(re.search(r'log\s?in|sign\s?in|sign up to|create an account to|join.*to see', text, re.I))
    return {'url': url, 'html': html, 'links': [], 'socialPosts': [], 'posts': posts, 'restricted': restricted, 'adaptiveUsed': False, 'rendered': False}


def main():
    if '--check' in sys.argv:
        from scrapling.fetchers import DynamicFetcher  # noqa: F401
        print(json.dumps({'scrapling': version('scrapling')}))
        return
    data = json.loads(sys.stdin.buffer.read(MAX_HTML * 2 + 10_000))
    url, html = data['url'], data['html']
    rendered, render_error = False, None
    if data.get('render'):
        try:
            html = render_document(url, html)
            rendered = True
        except Exception as error:
            # Preserve the static document; a failed browser never creates evidence.
            render_error = type(error).__name__
    result = parse_social_document(url, html, data['social']) if data.get('social') else parse_document(url, html)
    result.update(rendered=rendered, renderError=render_error)
    print(json.dumps(result, ensure_ascii=True))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'{type(error).__name__}: {str(error)[:160]}', file=sys.stderr)
        sys.exit(1)
