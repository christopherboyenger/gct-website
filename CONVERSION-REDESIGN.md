# GCT conversion redesign

Prepared October 16, 2026. This replaces the earlier audit's recommendation to retain event sponsorship and editorial pages as supporting website content. The selected paid creator-entry, sponsorship sales, newsroom and article experiences are removed from the redesign.

## The sales job

The website should help a visitor answer four questions: Is this for me? Why GCT? What can I do here? What happens if I take the next step?

The creator conversion is a completed, consented creator waitlist signup. The brand conversion is a completed, consented brand-interest signup with company and campaign objective. The courses/experiences conversion is a prepared inquiry email; sending that email remains a separate action and is not counted as a submitted lead.

These are the current prelaunch conversion goals. The site should transition to account activation and campaign starts when the product is open and those destinations are verified.

## Competitor comparison

### SideShift

Sources: [creator page](https://sideshift.app/creators), [main website](https://sideshift.app/).

The useful principle is audience clarity: the creator page has its own promise, signup path, workflow and answers about eligibility and payment. Product-related proof sits near the pitch. Its extensive navigation is unnecessary for GCT's current scope.

**GCT adaptation:** give creators a complete page, repeat a consistent join action, show real content and explain participation before asking for details. Keep the current prelaunch state explicit. Competitor earnings, network totals and testimonials do not become GCT claims.

### Trybe

Source: [Trybe](https://jointrybe.com/).

The useful principle is making the exchange understandable: creators contribute content, brands use it and compensation follows an explained model. The site uses short workflows, demonstrations and audience-specific answers to reduce uncertainty. Its performance figures and integration promises are vendor claims, not evidence of GCT capability or conversion performance.

**GCT adaptation:** show a simple path from objective to agreed brief, creation and review. Let a brand choose content, seeding or partnerships and carry that choice into the form. Explain paid usage rather than imply automatic unlimited rights. Avoid asserting an unverified commission or attribution model.

### Noise

Sources: [brand website](https://getnoise.com/), [creator page](https://getnoise.com/creators).

The useful principle is showing the work: content examples and a visual operating workflow help a buyer picture a campaign. Separate starting and sales actions serve different levels of readiness. The visual scale and claims about virality are not appropriate to copy without comparable GCT proof.

**GCT adaptation:** use existing GCT footage and photographs, give each clip a controllable preview and explain campaign planning around real golf contexts. Offer a direct brand-interest form rather than send every visitor to a general inbox.

## What makes the result GCT

- Actual on-course content, product stories, creator gatherings and branded activations from the repository.
- Golf as the context for creator work, rather than an interchangeable industry label on a general UGC product.
- Community and the competitive season as creator reasons to join, with future season rules described as forthcoming.
- A separate host/operator journey for courses, destinations and experiences.
- Existing navy and gold identity with clearer type hierarchy and a self-hosted Manrope variable font.

No competitor copy, brand assets, earnings examples or platform statistics were imported. No testimonials, conversion rates or campaign performance figures were invented. Existing historical event photographs illustrate the community; the new site does not sell that past event.

## The funnel

| Stage | Visitor experience | Why it belongs |
|---|---|---|
| Arrive | A short GCT explanation and visible creator/brand paths | Helps mixed traffic self-select |
| Recognize | Audience-specific promise and real golf imagery | Establishes relevance |
| Understand | Content examples and an explained participation/workflow | Makes the offer concrete |
| Resolve | Costs, rights, selection and next steps answered | Reduces uncertainty |
| Act | A short creator or brand form | Captures interest without creating an app-account expectation |
| Confirm | Success only after the API acknowledges the save | Makes the next state reliable |

Creator pages emphasize community, collaboration, opportunities and the season. Brand pages emphasize golf relevance, content types, campaign scope and agreed deliverables. Host pages emphasize the property, visit format and hosting responsibilities. They share an identity without sharing one generic sales argument.

## Scope removed

- Deleted `gct-entry.html`, `gco-sponsor-deck.html`, `news.html` and `news-article.html` from the branch.
- Removed the newsroom scout publishing workflow so the retired editorial feature is not scheduled to publish again.
- Retired entry links redirect to Creators; retired sponsorship links redirect to Brands. News routes return a useful 404 rather than masquerading as the countdown.
- The explicit build publishes six intended pages and the required asset folders. The old network page, social production board, newsroom files and old styles/behavior are excluded.
- Historical data and documentation remain in source history or excluded repository files. The task does not delete business records or app functionality.

## Measurement

The frontend emits `gct_page_view`, `gct_cta_click`, `gct_goal_selected`, `gct_form_started`, `gct_form_submitted`, `gct_form_error` and `gct_experience_email_prepared` as browser events. An existing `dataLayer` receives them if present. No third-party analytics provider, advertising pixel or tracking cookie was added.

Form-field values are not emitted in these events. This is an instrumentation interface, not an installed analytics dashboard. Connect the approved analytics destination before relying on measured conversion reports.

Start with creator signup completion, brand-interest completion, form error rate and qualified brand inquiry rate. Compare acquisition sources once the approved analytics system supports that attribution. Do not optimize for raw button clicks while lead quality deteriorates.

## Validation and limits

- Production build completes and publishes only intended pages/assets.
- Source design lint reports zero failures and zero warnings on the new core pages and shared assets.
- Five automated form-boundary tests pass: successful save, failure with retained input, duplicate prevention, false-confirmation prevention and profile payload limit.
- Local HTTP checks confirm core routes, legacy redirects and missing/newsroom 404 responses.
- The existing signup endpoint returns a successful CORS preflight for the approved localhost origin. No production test lead was submitted, so fresh database persistence and downstream team follow-up were not revalidated.
- The endpoint's existing CORS allowlist permits the production domains and localhost:4173. Arbitrary deployment-preview origins are not allowed; form persistence on such a preview must not be assumed.
- Browser checks at 1440, 768 and 390 pixels show no horizontal overflow or headings over two lines across the four core pages. The font loaded at all tested sizes. Mobile menu open/close and Escape behavior and campaign selection synchronization were checked.
- The supplied automated visual inspector could not launch Chrome in this environment. Source lint and direct browser checks were used instead; a passing automated inspector run is not claimed.
- Actual improvement in signup or qualified-lead conversion is a hypothesis to measure after launch, not a proven result of this redesign.

## Design review

Direction: Colour chapters; seed 49255819; no redraws. Existing GCT palette retained. Idea: GCT's actual on-course content becomes the evidence in a sequence of audience-specific chapters. The live interaction is the brand objective selector, supported by user-controlled video playback.

For conversion, chapter height follows content rather than forcing every section to occupy a full viewport, and signup fields remain an ordinary labeled form rather than typography-shaped inputs. These departures preserve readable content and familiar form behavior.

Review round: desktop/phone hierarchy, typography, image crops, section variety, truthful content and working actions were checked. Fixed the initial font-weight mismatch, shortened/widened tablet heading compositions, kept mobile calls to action above media and removed dimming entrance opacity. Subjective final review: design 7.5/10, usability 8/10, creativity 7/10, content 7.5/10; weighted score 7.55/10. This is a design judgment, not user research or a conversion score.

All photos/video are existing GCT repository assets. No stock or generated media was added. The Manrope font is distributed with its SIL Open Font License. No fictional sample testimonials, statistics or customers are present. The remaining content limitation is the absence of independently verified commercial outcomes and approved creator testimonials.

## Release state

This is a reviewable redesign branch, not a live-site replacement. The production countdown remains unchanged until the branch is merged and released. Before release, confirm the new season wording, the brand follow-up process and the intended November 1 transition. The release changes the production build from the temporary countdown to the full audience website.
