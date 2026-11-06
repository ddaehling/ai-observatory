#!/usr/bin/env python3
"""Read-only structural/accounting checks; not an editorial truth verifier."""
import argparse
from collections import Counter
from datetime import datetime
import hashlib
import ipaddress
import json
from pathlib import Path
import re
from urllib.parse import urlsplit


def check(project, check_captures=False):
    catalogue = json.loads((project / 'data/publisher-catalogue.json').read_text())
    sources = {s['id']: s for s in json.loads((project / 'data/sources.json').read_text())}
    errors = []

    def require(condition, message):
        if not condition:
            errors.append(message)

    def public_url(value):
        try:
            u = urlsplit(value)
            host = (u.hostname or '').lower()
            if u.scheme not in {'http', 'https'} or not host or u.username or u.password:
                return False
            if host == 'localhost' or host.endswith(('.localhost', '.local', '.internal')):
                return False
            try:
                if not ipaddress.ip_address(host).is_global:
                    return False
            except ValueError:
                pass
            return True
        except (TypeError, ValueError):
            return False

    def identity(value):
        u = urlsplit(value)
        host = (u.hostname or '').lower().removeprefix('www.')
        host = 'x.com' if host == 'twitter.com' else host
        path = u.path.rstrip('/')
        return host, path.lower() if host == 'x.com' else path

    def timestamp(value, label):
        try:
            require(bool(value), f'{label}: missing date')
            datetime.fromisoformat(value.replace('Z', '+00:00'))
        except (AttributeError, TypeError, ValueError):
            errors.append(f'{label}: invalid ISO date')

    entries = catalogue['entries']
    queue = catalogue['discoveryQueue']
    require(catalogue.get('schemaVersion') == 1, 'unsupported schemaVersion')
    timestamp(catalogue.get('updatedAt'), 'updatedAt')
    require(len({e['id'] for e in entries + queue}) == len(entries + queue), 'duplicate entry/lead IDs')
    require(len({identity(e['url']) for e in entries}) == len(entries), 'duplicate recurring identity URLs')
    allowed = {'social_account', 'community', 'newsletter', 'blog', 'release_tracker', 'research_listing', 'official_blog'}
    for e in entries:
        label = e['id']
        require(e.get('kind') in allowed, f'{label}: unknown kind')
        require(e.get('status') in {'verified', 'specialist', 'provisional', 'blocked', 'retired'}, f'{label}: unknown status')
        require(public_url(e['url']), f'{label}: non-public identity URL')
        source = sources.get(e.get('sourceId'))
        require(bool(source and source.get('monitor') is True), f'{label}: missing recurring ledger source')
        if source:
            require(identity(source['url']) == identity(e['url']), f'{label}: source URL does not match identity')
        require(bool(e.get('whyMonitor') and e.get('editorialRole') and e.get('topics')), f'{label}: missing editorial rationale')
        require(bool(e.get('cadence', {}).get('basis')), f'{label}: cadence lacks basis')
        timestamp(e.get('lastObservedAt'), f'{label} lastObservedAt')
        timestamp(e.get('lastAssessedAt'), f'{label} lastAssessedAt')
        require(bool(e.get('assessmentHistory')), f'{label}: missing assessment history')
        require(bool(e.get('evidence')), f'{label}: no evidence')
        if e.get('status') == 'verified':
            require(e['access'].get('entrypointInspected') is True, f'{label}: verified without entrypoint inspection')
        require(public_url(e['access']['captureUrl']), f'{label}: invalid capture URL')
        for evidence in e['evidence']:
            require(public_url(evidence['url']), f'{label}: invalid evidence URL')
            timestamp(evidence['observedAt'], f'{label} evidence observedAt')
            if evidence.get('publishedAt') is not None:
                timestamp(evidence['publishedAt'], f'{label} evidence publishedAt')
            require(bool(evidence.get('observation') and evidence.get('inspection')), f'{label}: missing evidence scope')

    for e in queue:
        require(public_url(e['url']) and public_url(e['discoveredFrom']), f"{e['id']}: invalid discovery URL")
        require(bool(e.get('reason') and e.get('nextAction')), f"{e['id']}: missing lead reason/action")
        timestamp(e.get('discoveredAt'), f"{e['id']} discoveredAt")

    # Archive verification is optional because ignored captures are not portable.
    for e in entries + queue:
        p = e.get('provenance', e)
        capture = Path(p['capturePath'])
        require(not capture.is_absolute() and '..' not in capture.parts, f"{e['id']}: unsafe capture path")
        require(bool(re.fullmatch('[0-9a-f]{64}', p['captureSha256'])), f"{e['id']}: invalid capture hash")
        if check_captures:
            path = project / capture
            if not path.is_file():
                errors.append(f"{e['id']}: capture missing")
                continue
            data = path.read_bytes()
            require(hashlib.sha256(data).hexdigest() == p['captureSha256'], f"{e['id']}: capture hash differs")
            captured = data.decode('utf-8')
            locators = [v['url'] for v in e.get('evidence', [])] or [e['url']]
            for url in locators:
                require(url in captured, f"{e['id']}: evidence locator absent from capture: {url}")

    counts = catalogue['counts']
    expected = {'entries': len(entries), 'directlyInspectedSocialAccounts': sum(e['kind'] == 'social_account' and e['access']['entrypointInspected'] for e in entries), 'communities': sum(e['kind'] == 'community' for e in entries), 'discoveryQueue': len(queue), 'statuses': dict(Counter(e['status'] for e in entries))}
    for key, value in expected.items():
        require(counts.get(key) == value, f'counts.{key} differs from records')
    for run in catalogue['discoveryRuns']:
        items = run['consideredItems']
        tally = Counter(e['disposition'] for e in items)
        require(set(tally) <= {'added', 'updated', 'rejected', 'deferred', 'unchanged'}, f"{run['id']}: invalid disposition")
        require(run['considered'] == len(items), f"{run['id']}: considered count differs")
        require(len({e['id'] for e in items}) == len(items), f"{run['id']}: duplicate considered identity")
        for kind in ('added', 'updated', 'rejected', 'deferred'):
            require(run[kind] == tally[kind], f"{run['id']}: {kind} count differs")
        require(bool(run.get('reason')), f"{run['id']}: missing discovery summary/reason")
        for item in items:
            require(public_url(item['url']) and bool(item.get('reason')), f"{run['id']}: invalid considered item")
    return errors, expected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', type=Path)
    parser.add_argument('--check-captures', action='store_true', help='Also check ignored local capture hashes and evidence URL occurrence')
    args = parser.parse_args()
    try:
        errors, counts = check(args.project.resolve(), args.check_captures)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(json.dumps({'valid': False, 'errors': [str(exc)]}))
        return 1
    print(json.dumps({'valid': not errors, 'counts': counts, 'errors': errors}, indent=2))
    return bool(errors)


if __name__ == '__main__':
    raise SystemExit(main())
