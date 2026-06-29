---
title: "How AQL Sampling Plans Set Accept and Reject Limits for Freeze-Dried Fruit Lots"
category: "Industry Insights"
date: 2026-06-28
read: "8 min read"
summary: "An AQL sampling plan turns 'how many bags should we check, and when do we reject?' into defensible numbers. For freeze-dried fruit, it is the backbone of incoming inspection on breakage, foreign material, and appearance."
intro: "You cannot inspect every piece. A sampling plan decides how many you check and what verdict that sample is allowed to deliver."
takeaways:
  - "AQL (Acceptable Quality Limit) plans, built on standards like ANSI/ASQ Z1.4 and ISO 2859-1, set a defined sample size and accept/reject numbers from the lot size and inspection level."
  - "Defects are sorted into critical, major, and minor classes, each with its own AQL — tight for foreign material and safety, looser for cosmetic breakage."
  - "The plan does not guarantee a perfect lot; it controls the risk of accepting a batch that is worse than your agreed quality level, which is why the AQL must be written into the spec, not improvised at receiving."
  - "Switching rules — normal, tightened, and reduced inspection — reward consistent suppliers and catch ones whose quality is slipping."
cover_image: /images/articles/how-aql-sampling-plans-set-accept-and-reject-limits-for-freeze-dried-fruit-lots.svg
cover_alt: "Flow diagram showing a freeze-dried fruit lot feeding a sample size determined by lot size and inspection level, then an accept or reject decision based on defect counts against AQL limits"
faqs:
  - q: "What does AQL actually mean?"
    a: "AQL stands for Acceptable Quality Limit. It is the worst average defect level that is still considered acceptable over a series of lots. It is a property of the sampling plan, not a target for any single batch. A 1.0 AQL for major defects means the plan is designed so that lots at or better than 1 percent major defects are routinely accepted, while clearly worse lots are routinely rejected."
  - q: "How is the sample size chosen?"
    a: "Standards such as ANSI/ASQ Z1.4 and ISO 2859-1 use the lot size and an inspection level to look up a sample size code letter. That letter, combined with the AQL, gives the number of units to inspect and the accept and reject numbers. Larger lots and higher inspection levels mean larger samples and more discrimination."
  - q: "What are accept and reject numbers?"
    a: "After inspecting the sample, you count defects of each class. The accept number (Ac) is the maximum number of defects that still passes the lot; the reject number (Re) is the count at which the lot fails. For a typical single sampling plan, Re is simply Ac plus one, so there is no ambiguous middle."
  - q: "Why use different AQLs for different defects?"
    a: "Not all defects carry the same risk. Foreign material or a safety issue is critical and gets a very tight AQL, sometimes zero in the sample. Wrong color, oversize breakage, or fines are cosmetic and tolerated at a looser AQL. Splitting defects into critical, major, and minor lets one plan be strict where it matters and practical where it does not."
  - q: "Does passing an AQL plan mean the lot is defect-free?"
    a: "No. Sampling accepts some risk by design. A passed lot can still contain defects below the level the plan is built to catch. AQL controls the probability of accepting bad lots over time; it does not certify any individual lot as perfect. That is why it works alongside, not instead of, supplier quality systems and a COA review."
sources:
  - title: "ANSI/ASQ Z1.4: Sampling Procedures and Tables for Inspection by Attributes"
    url: "https://asq.org/quality-resources/z14-z19"
    publisher: "American Society for Quality"
    note: "Referenced for the structure of attribute sampling plans: sample size code letters, AQL-based accept/reject numbers, and normal/tightened/reduced switching rules."
  - title: "ISO 2859-1: Sampling procedures for inspection by attributes"
    url: "https://www.iso.org/standard/1141.html"
    publisher: "International Organization for Standardization"
    note: "Referenced as the international counterpart standard for attribute sampling by AQL used in incoming inspection."
---

Every buyer of freeze-dried fruit faces the same impossible task at receiving: confirm that a lot meets spec without opening, weighing, and inspecting every piece in every bag. Checking everything is destructive and uneconomic. Checking nothing is reckless. An AQL sampling plan is the structured compromise — and getting it written down in advance is what separates a defensible reject from an argument with a supplier.

## The direct answer

An AQL plan tells you three things: how many units to pull from a lot, how many defects of each type are tolerable in that sample, and at what count you reject the whole lot. The numbers are not invented at the dock. They come from published standards — ANSI/ASQ Z1.4 in the United States, ISO 2859-1 internationally — that take the lot size and an inspection level and return a sample size and the accept/reject numbers tied to your chosen AQL.

## What AQL is, and what it is not

AQL stands for Acceptable Quality Limit. It is the worst long-run average defect rate that you are willing to call acceptable across many lots. A 1.0 AQL on major defects does not mean you want 1 percent defects. It means the plan is tuned so that lots running at or below that level pass routinely, and lots clearly above it fail routinely.

The key misunderstanding to avoid: AQL is a property of the inspection plan over time, not a promise about any single batch. A lot can pass and still contain some defects. What the plan controls is the probability of waving through a batch that is genuinely worse than your agreed level. It manages risk; it does not certify perfection.

## From lot size to sample size

The mechanics are a lookup, not a calculation you do by feel.

First, pick an inspection level. General Level II is the default for most incoming inspection. Lower levels mean smaller samples and less discrimination; higher levels mean more scrutiny when a defect would be expensive to miss.

Second, the lot size plus the inspection level give a sample size code letter. A pallet of a few hundred cases lands on a different letter than a single carton.

Third, the code letter and your AQL return the actual sample size and the accept number (Ac) and reject number (Re). In a standard single sampling plan, Re is just Ac plus one, so a sample either clearly passes or clearly fails with no gray zone.

::: note "A worked shape, not a rule"
Suppose a freeze-dried mango lot of 20,000 retail pouches is inspected at General Level II. The standard points to a sample size code letter, which at a 1.0 major-defect AQL might call for inspecting on the order of a couple hundred pouches with an accept number around five and a reject number of six. The exact figures come from the table for your lot size and AQL — the point is that the sample and the verdict are fixed in advance, not negotiated at the dock.
:::

## Why freeze-dried fruit needs defect classes

A single AQL across all problems would be either too loose for safety or too strict for cosmetics. So defects are sorted into classes, each with its own AQL.

Critical defects are anything affecting safety or compliance: foreign material, the wrong product, undeclared allergen cross-contact, a swollen or compromised pack. These carry a very tight AQL, often effectively zero allowed in the sample.

Major defects undermine fitness for the intended use: moisture or texture clearly out of spec, significant off-color or oxidation, heavy fines in a whole-piece grade, an out-of-spec piece size for an ingredient application. These get a moderate AQL.

Minor defects are cosmetic and tolerated more freely: minor breakage in a snack grade, slight shade variation within the agreed range, occasional small blemishes. These carry the loosest AQL.

The classification has to be specific to the application. A breakage level that is a minor cosmetic issue for a trail-mix pack can be a major defect for a topping line that needs whole, photogenic pieces. The same lot, judged against two specs, can legitimately pass one and fail the other — which is exactly why the defect definitions belong in the quality agreement.

## Switching rules reward consistency

AQL plans are not static. The standards include switching rules that move a supplier between normal, tightened, and reduced inspection based on recent history.

Start at normal inspection. A run of clean lots can qualify the supplier for reduced inspection, which lowers the sample size and the cost of receiving. A pattern of rejects or borderline results triggers tightened inspection, with stricter accept numbers, and a continued bad streak can suspend acceptance until the supplier demonstrates control again.

This is one of the more useful and underused parts of the system. It turns inspection into a feedback loop: dependable suppliers earn lighter checks, and a supplier whose quality is drifting gets caught and scrutinized before a bad lot reaches production.

## Writing it into the relationship

A sampling plan only protects you if it exists before the truck arrives. The quality agreement or spec should state the standard used, the inspection level, the AQL for each defect class, and clear definitions and photos of what counts as critical, major, and minor. Without that, a reject becomes a subjective dispute the supplier can contest.

::: note "Sampling is one layer, not the whole wall"
AQL inspection sits alongside the documents, not instead of them. A certificate of analysis covers what a visual sample cannot — moisture, water activity, micro, residues — and the supplier's own quality system is what keeps lots good in the first place. Sampling is the receiving-end check that the agreed quality actually showed up.
:::

## The takeaway

An AQL plan converts a vague worry — "does this lot look okay?" — into a defined sample size and a yes-or-no rule backed by a published standard. For freeze-dried fruit, where breakage, color, foreign material, and piece size all matter differently depending on the buyer, the real work is classifying defects and fixing the AQLs in writing. Do that, and inspection stops being an argument and becomes a measurement.
