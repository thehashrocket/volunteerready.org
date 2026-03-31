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

## On Startups — The Community For Entrepreneurs (POSTED — awaiting group approval)

**Title:** Selling to nonprofits as a solo founder — what I'm learning

I've been building a SaaS for nonprofit volunteer management (screening, background checks, shift scheduling) and I'm in the stage where the product is live and I have zero paying users.

A few things I've figured out so far that might be useful to other founders selling into this space:

1. Nonprofits don't have "IT budgets." The person choosing software is usually the same person doing everything else. They're not evaluating your product against competitors — they're evaluating it against the spreadsheet they already have.

2. Discovery conversations are worth more than landing page traffic. I posted a discussion question on Reddit asking volunteer coordinators how they handle screening. The responses taught me more in 24 hours than weeks of assumption-based building. One person told me their org batches all background check renewals into January because they have no way to track individual expiration dates. Another said the lengthy screening process is intentional — it filters out uncommitted volunteers.

3. The "free tier" conversation is different with nonprofits. They're not evaluating free vs. paid the way a tech company would. They're evaluating free vs. "we literally cannot spend money on this."

Still early. Still learning. If anyone else is building for the nonprofit space or has sold into budget-constrained orgs, I'd love to compare notes.

---

## React Developers / JavaScript Groups (POSTED to both — re-posted this session)

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

## Young Nonprofit Professionals Network / YNPN — 61K members (POSTED)

*Angle: Founder doing research, open framing. YNPN skews early-career and tends to appreciate transparency.*

---

I'm building software for nonprofits that manage volunteers, and I've been spending a lot of time listening before building.

One pattern keeps coming up: the gap between what funders *require* and what they're willing to *fund*.

Grants increasingly require documentation — volunteer hours, headcount, background check status — but the overhead category in most grants doesn't cover the tools to actually collect that data. So orgs end up doing it manually. Spreadsheets, paper sign-in sheets, a coordinator who keeps track in their head.

One person described it as: "We're always compliant in practice, but I'm never confident I could prove it on short notice."

For those of you working at nonprofits: does this match your experience? How does your org handle volunteer documentation for grant reporting — is it systematized, or held together with duct tape?

---

## The New Social Worker Magazine — 47K members (PENDING APPROVAL — draft ready)

*Angle: The risk isn't failing to do the screening — it's failing to prove that you did.*

---

A question for social workers who oversee or work alongside volunteer programs:

There's a bind I keep hearing about when it comes to grant compliance. Funders — especially foundations and government contracts — increasingly require documentation of volunteer screening: background check status, training completion, hours logged.

But most orgs I've talked to are meeting those requirements manually. Spreadsheets. Paper sign-in sheets. A coordinator who keeps track in their head.

One person described it this way: "We're always compliant in practice, but I'm never confident I could prove it on short notice."

That's a different kind of risk than most people think about — not *failing* to do the screening, but failing to *document* that you did.

Does this resonate with your experience? How does your org handle the documentation side of volunteer compliance — especially for grant reporting?

---

## Volunteer Jobs, Volunteer Coordinator & Director Jobs — 3K members (PENDING APPROVAL — draft ready)

*Angle: Direct, operational. These ARE volunteer coordinators and directors — use their language.*
*Priority: HIGHEST. Post this one first once approved.*

---

A question for fellow volunteer coordinators and directors:

How does your org track background check renewals across your full volunteer roster?

I've been talking to volunteer managers at a range of nonprofits lately — from small community orgs to large multi-site agencies — and the approaches vary a lot:

- Batching everyone's renewals in the same month of the year (avoids tracking individual dates, but means some volunteers renew before they need to)
- Spreadsheet with expiration dates and a monthly manual review
- Relying on each program director to flag when their volunteers are due (with predictable results)
- No formal system at all — renewals happen when someone remembers

The orgs working with kids, elderly, or other vulnerable populations feel the stakes most acutely. A missed renewal isn't just an admin headache — it's a compliance gap that can show up in a funder audit or insurance review.

What's working for your org? And where does the process tend to break down?

---

## Social Learning & Impact — Corporate Volunteering & CSR — 11K members (PENDING APPROVAL — draft ready)

*Angle: The documentation gap between what companies need for ESG reporting and what nonprofits provide.*

---

A question for those managing corporate volunteer programs:

When your company volunteers with a nonprofit partner, who owns the documentation?

I've been exploring the gap between what companies need for ESG reporting — verified hours, headcount, participation data — and what most nonprofits are actually set up to provide.

Most nonprofits track volunteer hours on paper sign-in sheets or basic spreadsheets, which works fine internally. But when a corporate partner needs structured data for their CSR report, the friction usually lands on the nonprofit coordinator: manually compiling records, chasing down sign-in sheets from three months ago, formatting data for a partner's specific template.

For those of you on the corporate side: how do you currently collect volunteer hour data from your nonprofit partners? Is it a smooth handoff, or does it usually involve a few awkward email threads?

---

## Corporate Giving and Volunteering — 1.5K members (PENDING APPROVAL — draft ready)

*Angle: The documentation burden from the nonprofit's perspective, framed for a corporate giving audience.*

---

Something I keep hearing from nonprofits that work with corporate volunteer partners:

The ask is easy. The documentation is hard.

A company shows up to volunteer, everyone has a great experience — and then six weeks later the corporate CSR team emails asking for a breakdown of volunteer hours, headcount, and evidence that volunteers completed any required screening.

For smaller nonprofits, pulling that together is a real lift. The records usually live in paper sign-in sheets or a spreadsheet one person maintains.

For those of you managing corporate giving programs: is this friction you encounter on your side? How much time goes toward chasing documentation from nonprofit partners after the fact?

---

## Corporate Volunteering Network (CVN) — 805 members (PENDING APPROVAL — draft ready)

*Angle: Smaller, tighter community — more conversational tone appropriate.*

---

Curious what others in this group are experiencing:

How much friction is there between your corporate volunteer program and the nonprofit partners around documentation and compliance?

I've been talking to both sides of this recently — companies that need verified hours and screening records for ESG reporting, and nonprofits that are doing their best to track that information manually. The gap is real on both ends. Companies need structured, exportable data. Nonprofits have paper sign-in sheets and spreadsheets.

Getting from one to the other usually involves a lot of email.

Is this something your organization has figured out, or is it still an ongoing friction point?

---

## Personal page post: Reddit research insights (POSTED 2026-03-30)

I've been spending the last few weeks in Reddit threads asking nonprofit professionals how they handle volunteer compliance.

Not pitching. Just asking questions and listening to what comes back.

One thing I didn't expect to hear: compliance failures in the nonprofit sector are an open secret. Everyone "knows someone" whose org lost a grant renewal because they couldn't produce volunteer records from two years ago. But nobody talks about it publicly.

Why? Because orgs don't want to look incompetent to other funders. Funders don't want to look heavy-handed. And everyone prefers the narrative that these failures are "rare exceptions."

But behind closed doors, grant professionals absolutely talk about it. The ones who've been burned once become religious about documentation. The ones who haven't operate on hope until something goes wrong.

The part that surprised me most: the real risk isn't losing one grant. It's what happens next. One funder audits you, finds gaps in your volunteer records, and suddenly you're explaining that to every other funder on your next application. You're not fixing a process anymore. You're rebuilding trust.

I'm building VolunteerReady (volunteerready.org) to make this kind of documentation automatic. Screening, background checks, hours, credentials, all tracked as part of the volunteer workflow instead of as a separate compliance task.

Still early. Still learning. If you work in the nonprofit space, I'd love to hear whether this matches what you've seen.

#NonprofitLeadership #VolunteerManagement #GrantCompliance #FounderJourney #NonprofitTech

---

## Posting strategy

- **Post order:** YNPN first (can post now) → Volunteer Coordinator & Director Jobs (highest priority, post as soon as approved) → The New Social Worker Magazine → Social Learning & Impact CSR → Corporate Giving → CVN
- **Spacing:** Wait 2-3 days between posts across different groups
- **Engagement rule:** Reply to every comment within a few hours — LinkedIn rewards fast replies and dramatically extends reach
- **If someone gives a detailed comment:** Ask one follow-up question. If they engage twice, offer to continue over DM or a 15-minute call
- **Note on Social Work Network and Counseling:** Those were posted with the old scheduling/tracking angle. If 3+ weeks have passed, a second post with the compliance/grant angle is reasonable — but don't rush it
