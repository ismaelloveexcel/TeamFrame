# TeamFrame — Customer Zero

**Purpose:** Before building anything else, answer these five questions. Until they are answered with specificity, every feature decision is a guess.

**Rule:** No feature work that doesn't trace back to an answer below.

**Owner:** Ismael
**Status:** Draft — needs founder input
**Last updated:** 2026-05-30

---

## 1. Who exactly is TeamFrame for?

> One sentence. Specific enough that you could name 20 real companies that fit it.

**Bad answers:** "SMEs", "startups", "small businesses", "growing teams", "finance firms"
**Good answers:** "UK independent accounting practices with 8–25 staff", "Mauritius management companies under 25 employees", "fractional CFO firms with 5–15 consultants"

### Test
- Can you name 20 specific companies that match? List 5 here:
  1.
  2.
  3.
  4.
  5.
- If you can't name 5 in 10 minutes, the definition is still too vague.

### Your answer

> _(fill in)_

---

## 2. What painful problem do they have that TeamFrame solves?

> Not "managing employees". A specific recurring pain that costs them time, money, or sleep.

**Bad answers:** "HR is hard", "spreadsheets break", "they need an HR system"
**Good answers:** "They lose 4 hours every new hire re-creating the same onboarding checklist", "Their auditor flags missing leave records every year", "They can't prove who acknowledged the AML policy"

### Test
- When did you last hear a real person describe this pain in their own words? Who, when, what did they say?
- If you've never heard it described unprompted, it might not be a real pain.

### Your answer

> _(fill in)_

---

## 3. Why won't BambooHR / HiBob / Factorial / Personio / Charlie HR / Bob solve it better?

> If they solve it better, TeamFrame loses. There must be a real reason they don't.

**Format:** "BambooHR is built for X. TeamFrame is built for Y."

**Honest reasons that work:**
- Price (incumbents start at £4–8/seat with minimums — under 10 staff, that adds up)
- Onboarding friction (incumbents take days to set up; you take 10 min)
- Niche fit (incumbents are generic; you ship policy packs / templates / language for one industry)
- UK/EU/specific-jurisdiction defaults that US tools get wrong
- Audit trail visibility (most HR tools hide it; yours could surface it)

**Honest reasons that don't work:**
- "Better UX" — taste is not a moat
- "Cleaner code" — customers don't see it
- "More modern stack" — irrelevant

### Test
- Sign up for a BambooHR / Charlie HR / Personio free trial this week. Time the setup. Note 3 things they do worse than you could.

### Your answer

> _(fill in)_

---

## 4. How will the first 10 paying customers hear about TeamFrame?

> The single most important question. Product without distribution = hobby.

**Channels and what they imply:**

| Channel | Realistic timeline to 10 customers | What it requires |
|---|---|---|
| Personal network outreach | 2–3 months | A list of 50–100 named people you can email |
| Referrals from 1–2 industry partners | 3–6 months | Landing one partner first |
| Content / SEO | 12–24 months | Consistent weekly writing, not feature work |
| Paid ads (Google, LinkedIn) | 3–6 months | £2–5k budget + landing page that converts |
| Cold outbound (sales) | 3–6 months | Tolerance for rejection + ICP list |
| Communities (Slack, Reddit, indie hackers) | 6–12 months | Authentic presence, no spam |
| Product Hunt / Hacker News launch | 1 week burst, low retention | A polished landing page + a story |
| "Build in public" / Twitter | 6–12 months | Audience-building energy |

### Test
- Pick ONE primary channel. Not two.
- Can you take a concrete action toward it this week?

### Your answer

> Primary channel: _(fill in)_
> First action this week: _(fill in)_

---

## 5. What is the smallest thing that would stop customer #1 from paying today?

> The product almost certainly already does enough. The blocker is usually not a missing feature — it's:
> - No way to sign up without you
> - No way to pay
> - No pricing page
> - No trust signals (no website copy, no testimonials, no logos)
> - No legal (no T&Cs, no privacy policy, no data processing agreement)
> - No way to import existing data
> - One specific feature gap that the niche absolutely requires (e.g. leave balances for any HR tool)

### Test
- Imagine a real prospect saying "yes, send me the link, I'll pay". What would they hit first that would make them stop?

### Your answer

> _(fill in)_

---

## Decision rule going forward

Once questions 1–5 are answered, every PR / feature / hour spent must answer:

> **"Does this increase the probability that customer #1 pays?"**

If no → defer. If yes → ship.

Specifically defer:
- KPI dashboards
- Guard parser hardening
- More CI / audit work
- Architectural refactors
- "Nice to have" UX polish on routes customer #1 won't touch

Specifically prioritise:
- Self-signup
- Pricing page + Stripe
- T&Cs / privacy / DPA (boring but blocks B2B)
- Whatever feature gap question 2 surfaced
- Landing page that answers question 3 in one sentence

---

## Next step

Walk through questions 1–5 with Copilot. Push back on every vague answer. Don't move on until each has a specific, testable answer.
