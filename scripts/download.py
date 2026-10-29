"""Download all dataset images, with retries and resumable local files."""

import argparse
import concurrent.futures
import json
import os
import random
import time
import urllib.request
from pathlib import Path
from urllib.parse import urljoin

from asset_utils import MANIFEST, ROOT, asset_paths, inspect_image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=int(os.environ.get('WORKERS', '24')))
    parser.add_argument('--origin', default=os.environ.get('ASSET_ORIGIN', 'https://ai-costume-gallery.pages.dev/'))
    args = parser.parse_args()
    if not 1 <= args.workers <= 64:
        parser.error('--workers must be between 1 and 64')
    origin = args.origin.rstrip('/') + '/'
    paths = asset_paths()
    previous = json.loads(MANIFEST.read_text(encoding='utf-8'))['files'] if MANIFEST.exists() else {}

    def download(relative):
        target = ROOT / relative
        if target.exists():
            try:
                details = inspect_image(target)
                if relative not in previous or details == previous[relative]:
                    return relative, details, True
            except (OSError, ValueError):
                pass
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = Path(str(target) + '.part')
        for attempt in range(5):
            try:
                request = urllib.request.Request(urljoin(origin, relative), headers={'User-Agent': 'COSTUME-Atlas-archive/1.0', 'Accept-Encoding': 'identity'})
                with urllib.request.urlopen(request, timeout=60) as response, temporary.open('wb') as output:
                    expected = response.headers.get('Content-Length')
                    while chunk := response.read(256 * 1024):
                        output.write(chunk)
                if expected and temporary.stat().st_size != int(expected):
                    raise ValueError('Content-Length mismatch')
                # The temporary file retains a .part extension; inspect using its format.
                content = temporary.read_bytes()
                if target.suffix == '.png':
                    if not content.startswith(bytes((137, 80, 78, 71, 13, 10, 26, 10))) or content[-12:] != bytes((0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130)):
                        raise ValueError('Invalid or incomplete PNG response')
                elif len(content) < 30 or content[:4] != b'RIFF' or content[8:12] != b'WEBP' or int.from_bytes(content[4:8], 'little') + 8 != len(content):
                    raise ValueError('Invalid or incomplete WebP response')
                temporary.replace(target)
                details = inspect_image(target)
                if relative in previous and details != previous[relative]:
                    raise ValueError('Image differs from the recorded SHA-256 manifest')
                return relative, details, False
            except Exception as error:
                temporary.unlink(missing_ok=True)
                if attempt == 4:
                    raise RuntimeError(f'{relative}: {type(error).__name__}: {error}') from error
                time.sleep(min(2 ** attempt, 12) + random.random())

    results = {}
    failed = []
    skipped = 0
    started = time.monotonic()
    last_report = started
    print(f'Downloading {len(paths)} assets with {args.workers} workers from {origin}', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        tasks = {executor.submit(download, path): path for path in paths}
        for future in concurrent.futures.as_completed(tasks):
            try:
                relative, details, existed = future.result()
                results[relative] = details
                skipped += int(existed)
            except Exception as error:
                failed.append(tasks[future])
                print(f'FAILED {error}', flush=True)
            completed = len(results) + len(failed)
            if completed % 50 == 0 or time.monotonic() - last_report >= 15 or completed == len(paths):
                total_bytes = sum(item['bytes'] for item in results.values())
                print(f'{completed}/{len(paths)} | {total_bytes / 1024 ** 2:.1f} MiB | skipped {skipped} | failed {len(failed)} | {time.monotonic() - started:.0f}s', flush=True)
                last_report = time.monotonic()
    if failed:
        print('Run again to retry failed files: ' + ', '.join(failed), flush=True)
        raise SystemExit(1)
    manifest = {'source': origin, 'count': len(results), 'total_bytes': sum(item['bytes'] for item in results.values()), 'files': dict(sorted(results.items()))}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + chr(10), encoding='utf-8')
    print(f'Complete. Manifest saved to {MANIFEST.relative_to(ROOT)}', flush=True)


if __name__ == '__main__':
    main()
