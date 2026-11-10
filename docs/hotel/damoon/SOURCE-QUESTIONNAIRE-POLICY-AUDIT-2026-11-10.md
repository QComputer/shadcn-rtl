# Damoon source questionnaire and cancellation policy audit

**Audited:** 2026-11-10
**Scope:** Downloaded Damoon questionnaires, their duplicate files, the one-page cancellation policy PDF, and current owner direction carried into this task. This records source quality and approval status; it is not a public-facing transcription. Personal contact details and respondent identifiers are deliberately omitted.

## Source inventory and readability

| Source | Verified properties | Audit use and limits |
|---|---|---|
| `Downloads/Damoon_Hotel_Completed_Questionnaire_FA.pdf` | 4,298,878 bytes; 23 pages; SHA-256 `642d649ed2569e2a4610cb1735ed310527c900856d9b95fc32cb0805f34f66e3`. The `(1)` copy has identical bytes and hash. | Pages 1–13 have extractable text; pages 14–23 have no text layer and are scanned page images. The scanned source pages for Q29, Q41, and Q43 are PDF pages 17–19; these were visually inspected. This is source handwriting, not a clean searchable master. Text extraction alone cannot establish handwritten wording or completeness. |
| `Downloads/damoon-questionnaire-filled-fa.pdf` | 190,184 bytes; 7 pages; SHA-256 `fa19ac8259f9f915727aaad695624ed7ac10a1883d67001df3963efb805d26d9`. The `(1)` copy is byte-identical. | Searchable earlier typed transcript. Treat its readings as transcription, not owner approval. |
| `Downloads/Damoon-Questionnaire-Typed-Updated-2026-10-10.pdf` and `.md` | PDF: 214,378 bytes; 9 pages; SHA-256 `024466d7a5fa9b15e95c5202c4e89754170fb614a9d20e54c04c4e95f334f964`; its `(1)` PDF copy is byte-identical. Companion MD: 25,413 bytes; SHA-256 `c8eac14c2b3bc5c33fe43883664a37f563ddefec5e50818597077eb16d862d3d`; its `(1)` MD copy is byte-identical. | The MD has 90 unique numbered question headings (1–90), 89 blocks with a `پاسخ:` response label, one explicitly blank response (Q28), and 29 blocks containing explicit uncertainty wording (`نیازمند تأیید`, `خوانش اولیه`, `احتمالاً`, or `نامطمئن`). The marked question IDs are 6, 9, 10, 14, 16, 17, 20, 23–27, 30–35, 39, 46, 48, 50, 53–54, 62–64, 83, and 90. These are mechanical counts of transcript labels, not a completeness or approval score. RTL text extraction from the PDF disrupts question-number order; use the MD for numbering counts and the scan for handwriting. The transcript says bracketed notes are transcriber notes, not management answers. |
| `Downloads/Damoon_Hotel_Management_Questionnaire_v2.pdf` | 223,667 bytes; 13 pages; searchable text. | A management follow-up and evidence checklist, not a completed approval record. It asks for current operating and booking policies; Q27 requests the direct-booking cancellation/no-show/change/refund policy. |
| `Downloads/Damoon_Hotel_Master_Data_v2.pdf` | 441,764 bytes; 11 pages; searchable text. | A status register. It marks the official cancellation/refund policy NEEDS CONFIRMATION at P0 and lists unit counts/types as conflicting or needing confirmation. It is evidence of open decisions, not a policy approval. |
| `Downloads/Telegram Desktop/قوانین کنسلی هتل.pdf` | 137,273 bytes; 1 page; SHA-256 `be2f9412323767b65c07d7a93f7cd10541a87889778c4f35f952ec9df82dc38f`. PDF metadata reports Word 2013 and creation/modification 2024-11-03; no signature or approval date is visible on the page. | The text is selectable and the single page was visually checked to read the Persian right-to-left table. It is a hotel-titled policy candidate, but its current applicability and management approval are unverified. |

The blank source template `Downloads/damoon-hotel-brand-seo-questionnaire-fa.pdf` is 108,519 bytes and 10 pages; it is useful for questionnaire structure, not for proving responses or approval. Duplicate downloads of the completed and typed questionnaires were byte-identical, so they do not provide independent corroboration.

The last scanned page of the 23-page composite had no text layer and produced a zero-byte image during the bounded Poppler render; its visual content was not verified.

## Q29, Q41, and Q43 findings

| Question | Source evidence | Safe reading for product copy |
|---|---|---|
| Q29: what guests praise | The October 10 typed transcript says a calm, warm, friendly environment, proximity to medical centers, and facilities. The earlier completed composite's transcription summary instead flags quality of stay and staff manner/warmth as readable fragments and says other parts need rereading. The original handwriting is not sufficiently clear to settle every detail from the sampled scan. | The warm, calm, friendly tone is a reasonable high-level editorial synthesis and matches the current owner-approved direction. Do not publish medical proximity, facilities, price, or a verbatim testimonial from this answer without direct confirmation. |
| Q41: desired feeling on arrival | The October 10 transcript reads “well-being and calm”; the original scanned response is consistent with that reading. | Calm and comfort/well-being are supported as desired brand intent. This is an aspiration, not a measurable guarantee. |
| Q43: sentence about how a guest should feel | The October 10 transcript gives the second-home wording. The sampled handwritten answer supports the same central idea, though it remains a handwritten source. | “A second home” is supported as brand intent and matches the current owner-approved direction. Present it as an aspiration, not a promise about every stay. |

The current development candidate’s English and Arabic About copy expresses warm, friendly, calm hospitality and the feeling of being at home. It is an editorial paraphrase of Q29/Q41/Q43, not a verified verbatim quotation. The exact full Q29 response remains unresolved.

## Cancellation policy: source versus approval

Visual review of the one-page PDF confirms these listed charges, each expressed as a percentage of **one night**:

| Listed timing before arrival | Listed charge |
|---|---:|
| 4 days | No penalty |
| 72 hours | 20% |
| 48 hours | 50% |
| 24 hours | 70% |
| Arrival day | 100% |

The document gives thresholds but does not define the interval between 4 days and 72 hours, whether cutoff times are inclusive, how “arrival day” is determined, or the treatment of no-shows, date changes, refunds, taxes, and fees. The Management Questionnaire v2 asks management to decide the formal direct-booking policy, and Master Data v2 still flags that policy as NEEDS CONFIRMATION/P0. Therefore, the PDF is source evidence only; these figures must not be published as current terms or wired into booking/payment logic until management confirms the complete rule.

## Current approval boundary and unresolved facts

- Current owner direction for this phase says the restaurant is ready and the café remains in completion. The questionnaire's Q37 checklist includes a café as a facility category; that checkbox does not establish current operating status. Use the current owner direction for status copy and keep the café marked in progress.
- Phase one is coordination-only: date and guest selections do not reserve a room. Do not show confirmed prices/availability or unapproved definitive cancellation terms. The current About/Policies copy must keep the distinction between desired experience and guaranteed service.
- Room inventory/counts remain unresolved: the source questionnaire's room/suite figures conflict across questions, and Master Data v2 marks the relevant counts/types as conflicting or needing confirmation. Do not turn those figures into inventory or capacity claims.
- The current task states that approved original photography is not ready. Questionnaire scans and other research images are not approved hotel photography; keep concept-image labels until approved originals are supplied.
- The source transcript's cover identity/date fields are themselves marked uncertain. No accessible source here establishes that the handwritten answers or the cancellation PDF were signed off by the hotel owner. The explicit current owner direction takes precedence for the restaurant/café statuses above; other operational terms still need direct confirmation.

This audit used the local downloads and current task direction only. It does not claim access to prior ChatGPT conversations or private messages.


## Q1–Q90 question-by-question index (sanitized)

The private reconciliation ledger is stored outside Git at `C:/Users/disso/.codex/recovery/damoon-knowledge-20261110/questionnaire-q01-q90-private.json` (ledger SHA-256: `0435a743d022af3414a9dc892b6f4b695ee353c4946c9bd53c9acc4e4eb97617`; source-manifest SHA-256: `9c8f06052707365e041d3c137fb2b48bab81245ea32ecfba1ba2f89038d907bb`). The private ledger compares every Q row against Master v1.1 section 3; all 90 Master rows are present, with differences or qualifications recorded. It retains each row’s source text. Its records contain the verbatim typed transcript block, extraction/source provenance, per-question corrections, certainty, approval state, and site-use determination. Do not copy that file into this public repository. The Q IDs below correspond to the transcript's numbered questions; this table contains neutral topic labels and omits raw question text and answers. “Not established” means no verified question-specific management approval was found; it does not mean the respondent gave no answer.

Coverage is exactly Q01–Q90. The categories below describe transcription quality only, not whether 90 approved/complete answers exist. One response is blank; uncertain or partial transcript readings remain unapproved. The source text is the 2026-10-10 typed consolidated version (MD SHA-256 `c8eac14c2b3bc5c33fe43883664a37f563ddefec5e50818597077eb16d862d3d`). Its PDF companion SHA-256 is `024466d7a5fa9b15e95c5202c4e89754170fb614a9d20e54c04c4e95f334f964`; the earlier typed transcript, completed composite scan, management questionnaire, Master Data and cancellation PDF are assessed in the source inventory above. The original composite has extractable text on pages 1–13 only; pages 14–23 are scanned images. Two 2026-10-27 rewrite photos were visually inspected in this task. Pages in the Telegram handwritten ZIP were not re-read here; their prior repository audit review is inherited evidence only. The ledger preserves typed content, and does not claim complete visual handwriting reconciliation or that typed content fully matches it. The prior zero-byte render limitation on the composite final page remains unresolved.

| Question / neutral topic | Transcript classification | Management approval | Site use |
| --- | --- | --- | --- |
| Q01 — Official Persian name | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q02 — Common name | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q03 — English name | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q04 — Establishment type | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q05 — Official rating | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q06 — Establishment year | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q07 — Renovation year | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q08 — Building floors | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q09 — Room and suite count | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q10 — Official address | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q11 — Reception and messaging contacts | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q12 — Social media | Blank / absent in transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q13 — One-sentence introduction | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q14 — Desired brand associations | Partial / uncertain transcript | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q15 — Brand personality | Readable transcription, unapproved | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q16 — Three brand descriptors | Partial / uncertain transcript | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q17 — Undesired associations | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q18 — Origin story | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q19 — Name meaning | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q20 — Building history and area | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q21 — Previous hotel name | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q22 — Current guest groups | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q23 — Ideal guest profile | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q24 — Desired future guest groups | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q25 — Guest mix | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q26 — Reason for choosing hotel | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q27 — Strengths and room features | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q28 — Weaknesses | Blank / absent in transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q29 — Guest praise | Readable transcription, unapproved | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q30 — Guest complaints | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q31 — Competitive difference | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q32 — Competitors | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q33 — Relative positioning | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q34 — Desired market position | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q35 — Room categories and inventory | Partial / uncertain transcript | Not established | Hold public operational claim pending current scope and approval. |
| Q36 — Room facilities | Partial / uncertain transcript | Not established | Hold public operational claim pending current scope and approval. |
| Q37 — Public facilities | Readable transcription, unapproved | Not established | Current owner status governs; historic checkbox is not operating status. |
| Q38 — Breakfast | Readable transcription, unapproved | Not established | Hold public operational claim pending current scope and approval. |
| Q39 — Parking | Partial / uncertain transcript | Not established | Hold public operational claim pending current scope and approval. |
| Q40 — Check-in and check-out | Readable transcription, unapproved | Not established | Hold public operational claim pending current scope and approval. |
| Q41 — Arrival feeling | Readable transcription, unapproved | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q42 — Departure impression | Readable transcription, unapproved | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q43 — Desired guest feeling | Readable transcription, unapproved | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q44 — Staff role in brand | Readable transcription, unapproved | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q45 — Website style | Readable transcription, unapproved | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q46 — Website experience | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q47 — Brand colors | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q48 — Colors to avoid | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q49 — Existing logo | Readable transcription, unapproved | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q50 — Reference websites | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q51 — Brand tone | Partial / uncertain transcript | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q52 — Guest address form | Readable transcription, unapproved | Not established | Editorial brand intent only; paraphrase; no guarantees or quotations. |
| Q53 — Possible slogan | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q54 — Advertising exclusions | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q55 — Website priorities | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q56 — Website success | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q57 — Direct booking share goal | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q58 — Search phrases | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q59 — Priority search phrase | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q60 — Target markets | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q61 — Foreign guest languages | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q62 — Location advantage | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q63 — Nearby places | Partial / uncertain transcript | Not established | Hold public operational claim pending current scope and approval. |
| Q64 — Location-based guest reasons | Partial / uncertain transcript | Not established | Hold public operational claim pending current scope and approval. |
| Q65 — Direct website booking | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q66 — Online payment | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q67 — Direct booking benefits | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q68 — 360 tour areas | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q69 — Pre-booking room view | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q70 — Spaces excluded from tour | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q71 — New photography | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q72 — Outdated photos | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q73 — Introductory video | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q74 — Management content | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q75 — Customer reviews | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q76 — Requesting reviews | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q77 — Official review replies | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q78 — Loyalty program | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q79 — Loyalty benefits | Readable transcription, unapproved | Not established | Historical preference only; no booking, payment, policy, loyalty, discount or media activation. |
| Q80 — Organization contracts | Readable transcription, unapproved | Not established | Hold public operational claim pending current scope and approval. |
| Q81 — Corporate guest priority | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q82 — Corporate target groups | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q83 — Excluded site content | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q84 — Claims not to exaggerate | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q85 — Management review topics | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q86 — Development plans | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q87 — Future market position | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q88 — Desired additions | Readable transcription, unapproved | Not established | Current owner status governs; historic checkbox is not operating status. |
| Q89 — Management choice reason | Readable transcription, unapproved | Not established | Internal evidence only; no site claim without explicit current approval. |
| Q90 — Reason not to choose | Partial / uncertain transcript | Not established | Internal evidence only; no site claim without explicit current approval. |

### Cross-source corrections and authority

- Q09/Q35 conflict on suite count; Q27's “12” and Q20's area figure remain uncertain. Do not infer inventory, capacity, or architectural facts.
- Q37/Q88 checkbox content does not establish current café operation. Current owner direction is restaurant ready and luxury café in progress.
- Q55/Q65–Q80 reflect historical preferences or intentions; they do not authorize online booking, payments, cancellation rules, discounts, loyalty, contract claims, or media publication. Current phase is contact-based stay coordination only.
- Q71's old answer does not override the current owner statement that approved original photos are not ready.
- Q29/Q41/Q43 support restrained warm/calm/second-home brand intent; Q29's full wording remains unresolved. The site copy is an editorial paraphrase, not an approved quotation or guaranteed experience.
- The cancellation PDF is a candidate source; Master Data v2 still flags current policy confirmation open. No policy was activated.
- Cancellation policy reference: no service or booking activation was performed during this audit.
