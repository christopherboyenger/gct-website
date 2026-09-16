# GCT Daily — Newsroom Architecture

GCT Daily is the publication and intelligence layer for the Golf Creator Tour website.

## Product goal

Build a trusted, high-signal publication covering the business of golf creators: creators, brands, sponsorships, media, technology, events, money, travel, people, and proprietary GCT data.

The newsroom should serve four functions at once:

1. **Publication** — useful reporting and analysis for creators, brands, operators, and industry decision-makers.
2. **Marketing engine** — convert each approved story into email, social, app, and sales content.
3. **Intelligence layer** — structure signals about brands, creators, campaigns, executives, destinations, and sponsorship activity.
4. **Partnership engine** — surface qualified commercial opportunities without compromising editorial standards.

## Current MVP

- `/news` — publication homepage.
- `/news/:slug` — reusable article route.
- `news-data.json` — structured publication and story data.
- `news.html` — newsroom landing template.
- `news-article.html` — reusable story template.

The MVP intentionally starts with GCT-owned editorial content rather than fabricated or weakly sourced external news.

## Story schema

Each story should include:

- `slug`
- `category`
- `kicker`
- `title`
- `dek`
- `date`
- `readTime`
- `featured`
- `sourceName`
- `sourceUrl`
- `image`
- `whatHappened`
- `whyItMatters`
- `gctTake`
- `body[]`

Future automation should also add internal-only fields such as source IDs, confidence, verification status, entities, opportunity score, and editorial status.

## Automation pipeline

### 1. Monitor

Continuously ingest candidate signals from a curated source registry:

- primary company newsrooms and investor relations
- golf industry publications
- creator public channels
- tournament and event announcements
- platform and technology newsrooms
- business / funding sources
- destination and resort announcements
- GCT-owned submissions and first-party data

### 2. Normalize

Convert each candidate into a standard record:

- headline
- source URL
- source type
- published timestamp
- entities mentioned
- summary
- category
- possible creator relevance
- possible commercial relevance

### 3. Deduplicate

Cluster multiple URLs about the same event. Prefer the primary source when one exists.

### 4. Score

Recommended initial score:

`editorial_score = relevance × significance × creator_relevance × recency × source_quality`

Commercial opportunity scoring must remain an internal layer and must not influence factual editorial conclusions.

### 5. Verify

Before factual publication, require one of:

- a credible primary source; or
- independent corroboration from multiple reliable sources.

Never convert rumor, speculation, anonymous social posts, or AI inference into stated fact.

### 6. Draft

AI can produce:

- headline options
- factual summary
- "What happened"
- "Why it matters"
- draft analysis
- suggested tags / entities
- suggested social derivatives

Every external factual claim should retain traceable source references.

### 7. Editorial approval

Initial operating mode should be **human approval required**.

Statuses:

- `candidate`
- `researching`
- `verified`
- `draft`
- `approved`
- `published`
- `rejected`

No candidate should move from draft to published without approval until the system has demonstrated reliable sourcing and editorial quality.

### 8. Publish + repurpose

One approved story can create:

- website article
- newsletter item
- LinkedIn post
- X post / thread
- Instagram carousel copy
- app / web notification copy
- CRM intelligence record
- partnership lead suggestion

## Internal intelligence layer

For every story, the system should eventually extract structured entities such as:

- company / brand
- creator
- executive / decision-maker
- agency
- property / event
- destination / course / resort
- product
- campaign
- partnership type

Possible internal actions:

- add/update CRM record
- note recent campaign activity
- identify likely marketing / creator-relations owner
- surface a destination campaign opportunity
- surface an event sponsorship prospect
- identify a creator partnership trend

Editorial and commercial data can share infrastructure, but sponsored relationships must never be presented as independent editorial judgment without disclosure.

## Recommended publishing cadence

### Weekdays — GCT Daily

A concise briefing:

- 5 things to know
- creator move
- brand move
- money / technology item
- GCT take

### Sunday — GCT Report

A deeper feature, proprietary ranking, market analysis, campaign breakdown, or GCT data report.

## Phase 2 build

1. Verify and configure initial source registry.
2. Add ingestion job / scheduler.
3. Add candidate and draft data stores.
4. Add source quality and verification logic.
5. Add editorial review interface.
6. Integrate newsletter provider.
7. Add social repurposing queue.
8. Add CRM / partnership intelligence output.
9. Add analytics: subscribers, opens, CTR, article views, shares, lead attribution, sponsor revenue.

## Editorial principle

**Be first when possible, but be right every time.**

GCT Daily should earn distribution through useful information, not volume. The long-term moat is trusted reporting plus proprietary knowledge of the golf creator economy.
