#!/usr/bin/env python3
# Guarded, idempotent amendment to prior Damoon overlay docs.
# No prior content is removed without an exact anchor; dry-run by default.
from __future__ import annotations
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOC = Path('docs/hotel/damoon')
DECISION = 'OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md'
LINK = f'[{DECISION}]({DECISION})'

# Each previous paragraph was copied byte-for-byte from the November 23 overlay.
PATCHES = {
    DOC / 'OWNER-DECISION-DELTA-2026-11-23.md': [(
        '''- **عمل:** مالک/مدیر هتل باید **طبقه‌بندی واحدهای فیزیکی** را با دسته‌های بازاریابی/نمایشی تطبیق دهد و تفاوت را مستند کند. Agent B متن عمومی را با کمترین تغییر و فقط بر اساس پاسخ معتبر اصلاح و سه زبان/تست را همگام کند. Agent A هیچ رکورد فیزیکی یا inventory از این مجموع تولید نکند.
- **موقت:** فقط تعداد کل تأییدشده یا واژه‌های کلی دسته‌ها بدون اعداد مشکوک. نباید کد، عدد دسته‌بندیِ جدید را با حدس «درست» کند.''',
        '''- **تصمیم جدید مالک (۲۳ نوامبر):** مبنای اجرایی اولیه **۳ اتاق یک‌نفره + ۱۷ اتاق دونفره + ۶ سوئیت سه‌نفره + ۳ سوئیت چهارنفره + ۲ سوئیت پنج‌نفره** انتخاب شد (۲۰ اتاق، ۱۱ سوئیت، ۳۱ واحد). مرجع لازم‌الاجرا: `OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md`.
- **اقدام:** Agent B این پنج دسته را در محتوای عمومی سه‌زبانه و سپس در داشبورد قابل‌ویرایش/انتشار مدیریت نمایندگی کند؛ link/alias و درخواست هماهنگی موجود را حفظ کند. بخش‌های فرضی پرسشنامه صرفاً به مبنای انتخابی امروز تبدیل شده‌اند، نه تاریخچه تأیید فیزیکی. Agent A/C نباید از این مقدارها رکورد فیزیکی، ظرفیت عملیاتی یا نرخ تولید کنند.
- **مرز:** تأیید مجدد تفکیک زیرگروه‌ها مانع توسعه نیست؛ تأیید داده واقعی برای رزرو/پرداخت و هر Migration همچنان جداست.''')
    ],
    DOC / 'CURRENT-STATE-2026-11-23.md': [(
        '''| PR148، حذف ادعاهای بدون منبع درباره دسته اتاق | شاخه `codex/damoon-public-facts-20261123` | چک‌های implementation پاس شده؛ پس از این به‌روزرسانی سند باید روی head تازه دوباره تأیید شوند. ادغام متوقف تا روشن‌شدن درخواست استقرار SHA قدیمی | `RELEASE_BLOCKED_BY_RUNFLARE_REQUEST` |''',
        '''| PR148، حذف ادعاهای بدون منبع درباره دسته اتاق | شاخه `codex/damoon-public-facts-20261123` | چک‌های implementation پاس شده؛ پس از این به‌روزرسانی سند باید روی head تازه دوباره تأیید شوند. ادغام متوقف تا روشن‌شدن درخواست استقرار SHA قدیمی | `RELEASE_BLOCKED_BY_RUNFLARE_REQUEST` |
| Owner decision, five-category accommodation baseline | Direct owner decision 2026-11-23 | 3/17/6/3/2 selected; public UI and dashboard implementation, CI, deployment pending | `OWNER_SELECTED_BASELINE_IMPLEMENTATION_PENDING` |''')
    ],
    DOC / 'EXECUTION-ROADMAP-2026-11-23.md': [(
        '''تعارض ۲۰/۱۱ در برابر ۷/۱۷/۷ تعیین تکلیف؛ هیچ داده حدسی/موقت به‌عنوان قطعی منتشر نشود؛ اصل لوگو/عکس با حقوق و EXIF review؛ ۳ زبان همسان''',
        '''پیش‌فرض اجرایی پنج‌گانه مصوب مالک (۳/۱۷/۶/۳/۲) در سه زبان و کارت‌ها اعمال؛ پیکربندی محتوا از داشبورد قابل‌ویرایش/انتشار شود؛ داده فیزیکی/رزرو بدون منشأ ایجاد نشود؛ اصل لوگو/عکس با حقوق و EXIF review''')
    ],
    DOC / 'NEXT-AGENT-HANDOFF-2026-11-23.md': [(
        '''4. فایل `sites/damoon/content.js` را برای اختلاف ۲۰/۱۱ و ۷/۱۷/۷ Audit کن. اصلاح عدد فقط پس از تأیید مالک/مدیر؛ اگر متن عمومی فعلی بر داده بدون پشتوانه تکیه دارد، راه‌حل حداقلی غیرمدعی را در PR جدا پیشنهاد بده.''',
        '''4. تصمیم جدید مالک در `OWNER-DECISION-ACCOMMODATION-BASELINE-2026-11-23.md` را اعمال کن: پنج دسته ۳/۱۷/۶/۳/۲، جمع ۲۰ اتاق و ۱۱ سوئیت. کد در حال تغییر M2 را با این تصمیم هماهنگ کن، مسیرهای قدیمی/CTA/URL و تست‌ها را حفظ کن و سپس بر قابلیت ویرایش/انتشار داشبورد تمرکز کن؛ هیچ ثبت فیزیکی/عملیاتی Production انجام نده.''')
    ]
}
BANNERS = [
    DOC / 'README.md',
    DOC / 'COMPLETION-CHECKLIST-2026-11-22.md',
]
APPEND = [
    DOC / 'ARCHITECTURE-AND-CONTRACTS-2026-11-23.md',
    DOC / 'CONTENT-MEDIA-AND-SEO-GATES-2026-11-23.md',
    DOC / 'PRODUCTION-BOOKING-AND-DB-GATES-2026-11-23.md',
    DOC / 'REQUEST-TO-RECEPTION-ACCEPTANCE-2026-11-23.md',
]
MARK = 'OWNER_ACCOMMODATION_AMENDMENT_20261123'
BANNER = (f'> **{MARK}** — A newer owner decision selects a five-category initial accommodation baseline '
          f'(3 single + 17 double + 6 three-person suites + 3 four-person suites + 2 five-person suites = 31). '
          f'See `{DECISION}`. This does not authorize production inventory/migrations or remove historical evidence.\n\n')
APPEND_TEXT = (f'\n\n## {MARK} — Current owner-selected category baseline\n\n'
               f'The implementation now targets **3 single rooms, 17 double rooms, 6 three-person suites, '
               f'3 four-person suites and 2 five-person suites**, aggregate **20 rooms + 11 suites = 31 units**. '
               f'This is the owner-selected editable **product default**, not certified physical capacity. '
               f'Dashboard/website category edits must follow existing tenant-scoped publication/revision rules, '
               f'preserve slugs/CTAs and remain separate from operational room inventory. '
               f'Refer to `{DECISION}` and `ACCOMMODATION-ADMIN-AND-CONTENT-CONTRACT-2026-11-23.md`. '
               f'No Production writes, migration, PR140 merge or booking activation are authorized.\n')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Write audited edits after producing ignored backups')
    args=parser.parse_args()
    decision=ROOT/DOC/DECISION
    if not decision.exists():
        print('ERROR: extract amendment ZIP into the repository root first; owner decision file is missing.',file=sys.stderr)
        return 2
    operations=[]; drift=[]
    for rel,repls in PATCHES.items():
        file=ROOT/rel
        if not file.is_file():
            drift.append((rel, 'file not found'));continue
        old=file.read_text(encoding='utf-8'); new=old
        if MARK in old: print(f'SKIP already patched: {rel}');continue
        for before,after in repls:
            if after in new:
                continue  # exact amendment already applied (idempotent)
            if new.count(before)!=1:
                drift.append((rel,'expected exact anchor absent or duplicated; manual reconciliation required'))
                new=old;break
            new=new.replace(before,after,1)
        if new!=old: operations.append((rel,old,new))
    for rel in BANNERS:
        file=ROOT/rel
        if not file.is_file():drift.append((rel,'file not found'));continue
        old=file.read_text(encoding='utf-8')
        if MARK not in old:operations.append((rel,old,BANNER+old))
    for rel in APPEND:
        file=ROOT/rel
        if not file.is_file():drift.append((rel,'file not found'));continue
        old=file.read_text(encoding='utf-8')
        if MARK not in old:operations.append((rel,old,old.rstrip('\n')+APPEND_TEXT))
    for rel,old,new in operations: print(('APPLY' if args.apply else 'DRY-RUN')+f' {rel}: {len(old)} -> {len(new)} chars')
    if drift:
        for rel,msg in drift:print(f'REVIEW REQUIRED {rel}: {msg}',file=sys.stderr)
        print('No file changes made because at least one target drifted; reconcile manually then rerun.',file=sys.stderr)
        return 3
    if not operations:
        print('Already applied, or nothing to change.');return 0
    if not args.apply:print('Dry-run only. Use --apply once all anchored docs are confirmed.');return 0
    bkp=ROOT/'.tmp/damoon-accommodation-amendment-20261123-backup'
    # Preflight before writes. Refuse to overwrite prior backups.
    for rel,_,_ in operations:
        p=bkp/rel
        if p.exists():print(f'ERROR: backup already exists, refusing overwrite: {p}',file=sys.stderr);return 4
    for rel,old,new in operations:
        target=ROOT/rel;backup=bkp/rel
        backup.parent.mkdir(parents=True,exist_ok=True)
        backup.write_bytes(target.read_bytes())
        target.write_text(new,encoding='utf-8',newline='\n')
    print(f'Patched {len(operations)} docs; backups in ignored local directory {bkp}')
    return 0
if __name__=='__main__':sys.exit(main())
