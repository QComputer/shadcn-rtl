#!/usr/bin/env python3
'''Add current-source notices to four historical Damoon docs, preserving all text.

Default is dry-run. --apply modifies docs only after a local backup.
No network, Git mutation, database access, or dependency install.
'''
import argparse
from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile

SNAPSHOT = 'docs/hotel/damoon/CURRENT-STATE-2026-11-23.md'
ROOT_FILES = [
    'docs/hotel/damoon/README.md',
    'docs/hotel/damoon/ROADMAP.md',
    'docs/hotel/damoon/STATUS-AND-DECISIONS.md',
    'docs/hotel/damoon/COMPLETION-CHECKLIST-2026-11-22.md',
]
MARKER = '<!-- DAMOON_CURRENT_REFERENCE_2026_11_23 -->'
BANNER = '''<!-- DAMOON_CURRENT_REFERENCE_2026_11_23 -->
> **مرجع وضعیت اجرایی دامون — ۲۰۲۶-۱۱-۲۳:** این سند شامل شواهد تاریخی و تصمیم‌های معتبر زمان نگارش خود است. برای آخرین وضعیت Git/Runflare، وضعیت PR145، اختلاف واقعیت‌های اتاق، آخرین نقشه راه و گیت‌های انتشار به [مرجع جاری](./CURRENT-STATE-2026-11-23.md) و [نقشه راه اجرایی](./EXECUTION-ROADMAP-2026-11-23.md) رجوع کنید. تصمیم‌های مالک و گیت‌های امنیتی قدیمی با این ارجاع حذف یا لغو نشده‌اند.

'''

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Apply safe current-reference banner (default: dry-run)')
    args = parser.parse_args()
    try:
        root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True, stderr=subprocess.DEVNULL).strip()).resolve()
    except Exception:
        print('ERROR: run in a Git checkout of shadcn-rtl; no file changed.', file=sys.stderr)
        return 2
    current = root / SNAPSHOT
    if not current.is_file():
        print('ERROR: current-state overlay missing. Extract ZIP first; no file changed.', file=sys.stderr)
        return 2
    modified = []
    for rel in ROOT_FILES:
        f = root / rel
        if not f.is_file() or f.is_symlink():
            print(f'ERROR: missing/symlink target {rel}; no file changed.', file=sys.stderr)
            return 2
        old = f.read_bytes()
        if len(old) > 200_000:
            print(f'ERROR: unexpected file size {rel}; no file changed.', file=sys.stderr)
            return 2
        try:
            content = old.decode('utf-8')
        except UnicodeError:
            print(f'ERROR: non-UTF8 target {rel}; no file changed.', file=sys.stderr)
            return 2
        if MARKER not in content:
            modified.append((rel, f, old))
        else:
            print(f'SKIP already annotated: {rel}')
    print(f'Overlay source {SNAPSHOT}; pending banner updates: {len(modified)}')
    for rel, _, _ in modified:
        print(('APPLY ' if args.apply else 'WOULD UPDATE ') + rel)
    if not args.apply or not modified:
        return 0
    backup = root / '.tmp/damoon-overlay-20261123-backup'
    for rel, f, old in modified:
        target_backup = backup / rel
        if target_backup.exists():
            print(f'ERROR: refusing to overwrite existing backup {target_backup}; no source file updated.', file=sys.stderr)
            return 2
    for rel, f, old in modified:
        dst = backup / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(old)
    for rel, f, old in modified:
        newline = '\r\n' if b'\r\n' in old and b'\n' in old else '\n'
        new = BANNER.replace('\n', newline).encode('utf-8') + old
        fd, staged = tempfile.mkstemp(prefix=f.name+'.', dir=str(f.parent))
        try:
            with os.fdopen(fd, 'wb') as w:
                w.write(new)
            os.chmod(staged, f.stat().st_mode)
            os.replace(staged, f)
        finally:
            if os.path.exists(staged):
                os.unlink(staged)
    print(f'DONE: {len(modified)} documents annotated; original bytes backed up under {backup}')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
