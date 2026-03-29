# LinkedIn Posts — VolunteerReady.org

---

## Option A: The "I volunteered and saw the problem" story

I started volunteering at a local nonprofit last year. Figured I'd show up, help out, and feel good about it.

What I didn't expect was watching the volunteer coordinator juggle everything from a spreadsheet, her phone, and a filing cabinet full of background check paperwork. She told me she spends about 6 hours a week just on screening and onboarding — not managing programs, not working with the community. Paperwork.

The thing that really got me: I'd already passed a background check at another org three months earlier. Didn't matter. Had to redo the whole thing from scratch. Same check, same provider, same result. Just a different organization.

I'm a software developer. I couldn't unsee it.

So I built VolunteerReady — a platform that handles volunteer screening, background checks, shift scheduling, and what I'm calling portable credentials. The idea is simple: when a volunteer clears a background check or completes training at one organization, that verification follows them. No redundant screening. No starting over.

It's live. It's early. And I have zero users.

I'm not posting this to get a round of applause. I'm posting because I need honest feedback from people who work in or around the nonprofit space. Does this solve a real problem? Is the approach wrong? What am I missing?

If you manage volunteers, work with nonprofits, or just have opinions about early-stage products, I'd genuinely appreciate 5 minutes on the site: volunteerready.org

And if you know a volunteer coordinator who's drowning in spreadsheets, I'd love an intro.

---

## Option B: The "here's what I learned talking to 10 nonprofit people" angle

I spent the last few months talking to volunteer coordinators at nonprofits. Not pitching. Just asking questions and listening.

Here's what I heard over and over:

The average time from "I want to volunteer" to a first shift is 2-4 weeks. Not because screening is thorough — because it's manual. Background checks get started and then nobody follows up. Emails fall through the cracks. Half the people who sign up never actually show up because the process takes too long and they lose interest.

One coordinator told me she loses about 30% of her volunteer applicants to the onboarding process itself.

The other thing: nothing transfers. A volunteer who's been background-checked and trained at one org starts completely from zero at the next one. Every organization is its own island.

I'm a developer, so I did what developers do — I built something. VolunteerReady handles screening, background checks, scheduling, and portable credentials that follow volunteers across organizations.

It's live at volunteerready.org. Early release, no users yet. I'm personally onboarding every org that joins.

I'm sharing this here because I want to know if I'm on the right track. If you work with nonprofits, manage a CSR program, or have been a volunteer coordinator — does this match what you've seen? What am I getting wrong?

DMs are open. Happy to just talk about the problem even if the product isn't for you.

---

## Option C: The short, punchy version

I built a thing and nobody's using it yet. Let me tell you about it anyway.

VolunteerReady is volunteer management software for nonprofits. Screening, background checks, shift scheduling, portable credentials.

The problem I keep hearing from coordinators: onboarding a volunteer takes weeks because everything is manual, background checks don't transfer between organizations, and half of new volunteers ghost before their first shift because the process is too slow.

I've been working on this solo for a while. It's live. It works. Now I need people to break it and tell me what's wrong.

volunteerready.org

If you know anyone who coordinates volunteers at a nonprofit, I'd appreciate an introduction more than a like.

---
---

# LinkedIn Group Posts

---

## On Startups — The Community For Entrepreneurs (POSTED)

**Title:** Selling to nonprofits as a solo founder — what I'm learning

I've been building a SaaS for nonprofit volunteer management (screening, background checks, shift scheduling) and I'm in the stage where the product is live and I have zero paying users.

A few things I've figured out so far that might be useful to other founders selling into this space:

1. Nonprofits don't have "IT budgets." The person choosing software is usually the same person doing everything else. They're not evaluating your product against competitors — they're evaluating it against the spreadsheet they already have.

2. Discovery conversations are worth more than landing page traffic. I posted a discussion question on Reddit asking volunteer coordinators how they handle screening. The responses taught me more in 24 hours than weeks of assumption-based building. One person told me their org batches all background check renewals into January because they have no way to track individual expiration dates. Another said the lengthy screening process is intentional — it filters out uncommitted volunteers.

3. The "free tier" conversation is different with nonprofits. They're not evaluating free vs. paid the way a tech company would. They're evaluating free vs. "we literally cannot spend money on this."

Still early. Still learning. If anyone else is building for the nonprofit space or has sold into budget-constrained orgs, I'd love to compare notes.

---

## React Developers / JavaScript Groups (POSTED to both)

**Title:** Built a full-stack SaaS with Next.js 16, tRPC, and Prisma — lessons from a solo dev

I've been building a volunteer management platform as a solo founder and wanted to share some things I ran into that might be useful to others working with this stack.

The app uses Next.js App Router, tRPC v11, Prisma with Postgres, and Zod for shared validation between client and server. A few things I learned the hard way:

The layered architecture saved me more than once. I enforce strict boundaries — tRPC routers can only call services, services call repositories, repositories are the only thing touching Prisma. It felt like overkill early on, but when I needed to add audit logging to every database write, it was a one-layer change instead of hunting through 30 files.

Zod schemas next to domain models and imported on both sides eliminated an entire class of bugs. No more "the form sends a string but the API expects a number" issues.

Background check integrations (Checkr and Sterling) were the hardest part. FCRA compliance workflows have strict timing requirements — pre-adverse notices, waiting periods, final adverse action letters. Getting the webhook handling reliable with idempotency tables was more work than the rest of the integration combined.

Happy to answer questions about the architecture or any of these pieces. The site is volunteerready.org if you want to see the end result.

---

## Volunteering Opportunities Group (POSTED — AL!VE discussion post)

**Title:** Credential portability across organizations — is this something the field is thinking about?

I've been doing research on volunteer management and one pattern I keep seeing: a volunteer who's been background-checked, trained, and verified at one organization has to start completely from scratch when they sign up at a different org. Same checks, same trainings, no transfer.

From a volunteer's perspective, this seems like unnecessary friction. But from an org's perspective, I can see why you'd want to run your own checks — liability, different standards, different populations served.

For people who've been in volunteer engagement for a while:

- Is credential portability something that's been discussed in the field?
- Are there any standards or frameworks for recognizing screening done at another organization?
- Or is the "start fresh every time" approach the right one for liability reasons?

Genuinely curious about the professional perspective on this. I'm a developer exploring this space and I want to understand the nuance before assuming technology can solve what might be a policy problem.

---

## Social Work Network — 313K members (POSTED)

> Question for anyone managing volunteers alongside their caseload: how do
> you keep track of volunteer hours, scheduling, and coordination without
> it becoming a second job? I've been talking to a lot of folks in the
> field and it seems like most people are still using spreadsheets or
> paper sign-in sheets. Curious what's actually working for people — and
> what's not.

---

## Counseling/Guidance & Social Worker Coordinators — 32K members (POSTED)

> Hi everyone — I come from a software engineering background but I've
> been spending a lot of time lately in the volunteer coordination world
> trying to understand the day-to-day challenges coordinators face. One
> thing that keeps coming up is how much time gets eaten by scheduling
> and tracking. For those of you coordinating volunteers: what's the most
> frustrating part of your workflow that you'd love to just make disappear?

---

## The New Social Worker Magazine — 47K members (PENDING — not yet posted)

---

## Social Learning & Impact - Corporate Volunteering & CSR — 11K members (PENDING APPROVAL)

Target audience: CSR managers running employee volunteering programs.
Post angle: ESG reporting, verified hours, audit-ready data.
Draft post to be written once approved.

---

## Corporate Giving and Volunteering — 2K members (PENDING APPROVAL)

Target audience: Corporate giving/CSR professionals.
Post angle: Same as above — verified ESG data, not just self-reported hours.
Draft post to be written once approved.

---

## Corporate Volunteering Network (CVN) — PENDING APPROVAL

Target audience: Professionals organizing employee volunteering opportunities.
Post angle: Making employee volunteering programs trackable and audit-ready.
Draft post to be written once approved.
