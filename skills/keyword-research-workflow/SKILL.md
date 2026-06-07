---
name: keyword-research-workflow
description: >-
  Use when a user wants keyword research, SEO keyword ideas, Google Ads keyword
  planning, an SEO audit, or to know whether AI assistants recommend their site —
  especially when they can describe their product but don't know what keywords to
  target. Drives the JackpotKeywords connector tools in the right order (research
  job → poll for report → interpret scores) so Claude returns a prioritized
  keyword strategy instead of raw data.
---

# Keyword Research Workflow

Guide for using the **JackpotKeywords** MCP connector to turn a plain-English
product description — or just a URL — into a prioritized keyword strategy backed
by real Google Ads Keyword Planner data. JackpotKeywords starts from what the
product *does* (no seed keywords needed), scores every keyword 0–100, and also
offers SEO audits and AI-visibility (AEO) scans.

## When to use this skill
Trigger when the user mentions any of: "keyword research", "what keywords should
I target", "SEO keywords for my product/site", "Google Ads keywords", "keyword
ideas", "low-competition keywords", "audit my site's SEO", "does ChatGPT/AI
recommend my site", or describes a product and asks how people would search
for it.

## Core workflow (description → strategy)

1. **Choose the research tier.**
   - `jackpotkeywords_recommend` — the standard report. Free, but limited to
     **one per account per month**; check `jackpotkeywords_usage_status` if
     unsure whether the allowance is spent.
   - `jackpotkeywords_recommend_deep` ($0.30) — everything in the standard
     report PLUS competitor discovery, keyword clusters, and per-category
     aggregates. Prefer this when the user wants the competitive picture or a
     content/campaign plan, not just a keyword list.
   - Input: a plain-English `description` and/or the product `url` (at least
     one). Pass `location` for local businesses and `budget` (daily USD) for ad
     planning — both improve scoring.

2. **Poll for the report.** Research tools return a `job_id` immediately; the
   pipeline takes 1–3 minutes. Call `jackpotkeywords_get_report` with that id,
   waiting ~30 seconds between polls. Don't hammer it — two or three patient
   polls beat ten rapid ones. Failed jobs refund automatically.

3. **Interpret the data for the user.**
   - **Jackpot Score (0–100)**: composite of search volume, CPC, competition,
     trend, autocomplete depth, and AI relevance to *this* product. 75+ is a
     strong target.
   - **$0.00 CPC** means Google returned no advertiser bid data — promising but
     unproven, NOT free clicks. Say so when recommending those keywords.
   - **Intent labels**: commercial/transactional → ads + product pages;
     informational → blog/how-to content; navigational competitor terms →
     comparison pages only.
   - **Clusters** (deep report): each cluster is one content target — recommend
     one page per cluster, not one page per keyword. `keywordCount` is the true
     cluster size (the keyword list shown is a sample).
   - **Competitors** (deep report): use competitor-brand and alternative
     keywords for comparison/alternative pages; warn that bidding on brand
     terms means fighting an established player.

4. **Audit the user's site** — `jackpotkeywords_audit` ($0.50) when they have a
   live site. Crawls up to 10 pages, scores 20+ factors, returns prioritized
   fixes. Lead with the highest-priority issues, quickest wins first.

5. **Check AI visibility** — `jackpotkeywords_aeo_scan` ($1.00) when the user
   asks whether AI assistants (ChatGPT, Gemini, Claude) mention or cite their
   site. Reports per-query citation/mention status, which competitors get cited
   instead, and concrete action items.

## Cost & etiquette
- Free: `jackpotkeywords_credit_balance`, `jackpotkeywords_usage_status`,
  `jackpotkeywords_get_report`, and one `jackpotkeywords_recommend` per month.
- Metered (prepaid credits): `jackpotkeywords_recommend_deep` $0.30,
  `jackpotkeywords_audit` $0.50, `jackpotkeywords_aeo_scan` $1.00. New accounts
  include $2.00 starter credit; top-ups at jackpotkeywords.web.app.
- Mention the cost before running a metered tool if the user seems
  cost-sensitive; check `jackpotkeywords_credit_balance` when a call reports
  insufficient credits. Failed runs refund automatically.

## Output guidance
End with a prioritized shortlist (5–15 keywords with score, volume, CPC, and
what to do with each), grouped by action: target with ads now / write content
for / build a comparison page. For deep reports, map clusters to a content
calendar or ad-group structure. Close with the standard caveat: volumes and
CPCs are Google Keyword Planner data — validate with a small test budget before
committing big spend, and re-check seasonal keywords near their season.
