# AI Analysis Tab: End-User Explanation

This document describes what the AI Analysis tab should show to end users, what each card means, and how labels and scores are assigned. It uses the current example wallet shown in the screenshots:

`SupRAxJybdbv68r1PDXDq9LWKgdzLsmPwiyj41RM5SF`

Example visible values:

- Trust Score: `14 / 100`
- Risk Level: `CRITICAL`
- Persona: `High Risk Speculator`
- Persona Confidence: `84%`
- Data Completeness: `85%`
- Analyzed Transactions: `200`

Important wording rule: these labels are behavioral classifications from the analyzed transaction window. They are not legal judgments, fraud accusations, or proof of intent.

## 1. Header

The top header should orient the user before any scores appear.

Shown content:

- Title: `AI Wallet Behavior Analysis`
- Subtitle: `Evidence-aware wallet analysis with persona, risk, and signature-backed findings.`
- Generated time: when the analysis was produced
- Refresh button: lets the user rerun the analysis

User meaning:

- This is not a full wallet audit for all time.
- It is a structured analysis of the current transaction window.
- Findings are tied to computed metrics and, where available, transaction signatures.

## 2. Metric Cards

This section contains 6 compact cards. These are the quick summary cards users see first.

### 2.1 Trust Score

Example:

`14 / 100`

Meaning:

- Trust Score is the inverse of Risk Score.
- Formula: `Trust Score = 100 - Risk Score`.
- In this example, the wallet has `Risk Score = 86`, so `Trust Score = 14`.
- Higher trust score means fewer risky signals were observed.
- Lower trust score means stronger or more numerous risk signals were observed.

How to explain to users:

> This wallet has a low trust score because the risk model found multiple high-impact behavioral signals in the analyzed 200 transactions.

### 2.2 Risk Level

Example:

`CRITICAL`

Meaning:

- Risk Level is assigned from the total Risk Score.
- Risk Score is built by adding risk factor point impacts, then applying persona-based adjustment.
- Current thresholds:

| Risk Score | Label |
|---:|---|
| fewer than 10 analyzed transactions | `UNKNOWN` |
| 0-19 | `LOW` |
| 20-44 | `MEDIUM` |
| 45-74 | `HIGH` |
| 75-100 | `CRITICAL` |

For this wallet:

- Risk Score is `86 / 100`.
- Since `86 >= 75`, Risk Level is `CRITICAL`.

User meaning:

> Critical means the wallet triggered enough high-impact risk signals that it should be reviewed carefully. It does not mean the wallet is proven fraudulent.

### 2.3 Persona

Example:

`High Risk Speculator`

Meaning:

- Persona is the wallet's primary behavior pattern.
- It is selected by scoring several possible persona categories and choosing the highest eligible score.
- The backend stores the enum as `HIGH_RISK_SPECULATOR`, but the UI should display it as `High Risk Speculator`.

What `High Risk Speculator` means:

- The wallet behaves like an aggressive speculative trader.
- This label can be driven by high short-term trading ratio, high token diversity, negative realized PnL, low win rate, heavy DEX usage, or sniper-like trading style.
- It describes behavior, not identity.

Why this wallet may receive this label:

- The analyzed window shows strong speculative trading signals.
- The wallet has a critical risk score.
- The PnL summary shows realized PnL is negative across closed positions.
- Risk factors likely indicate short holding periods, high-frequency activity, or broad token trading.

Recommended user-facing wording:

> This wallet is classified as High Risk Speculator because its observed trading behavior appears short-term, broad, and risk-heavy in the analyzed window.

### 2.4 Persona Confidence

Example:

`84%`

Meaning:

- Confidence estimates how strongly the data supports the selected persona.
- It is not model certainty in a legal or identity sense.
- It is based on:
  - the selected persona score,
  - the gap between the top persona and next closest persona,
  - data completeness,
  - transaction count.

Important:

- `84%` means the system has strong support for the persona label from the available data.
- It does not mean the user is certainly a specific kind of person.

Recommended explanation:

> Persona confidence is high because the observed metrics support this behavior pattern more strongly than alternative persona labels.

### 2.5 Data Completeness

Example:

`85%`

Meaning:

- Data Completeness measures how reliable the available transaction data is for analysis.
- It is calculated from the normalized events.
- It is reduced by:
  - missing price data,
  - unsupported/unknown transactions,
  - parsing warnings,
  - failed transactions.

Current formula:

`100 - missingPriceRatio * 30 - unsupportedRatio * 30 - suspiciousParsingRatio * 20 - failedTransactionRatio * 20`

For the shown example:

- Data completeness is `85%`.
- The risk breakdown says there are `0 missing price points` and `10 unsupported transactions`.
- Because unsupported transactions exist, the system adds a small reliability risk factor.

Recommended user-facing wording:

> Data completeness is 85%, so most of the analyzed data was usable. Some unsupported transactions reduce confidence slightly.

### 2.6 Analyzed Transactions

Example:

`200`

Meaning:

- This is the number of transactions included in the AI analysis window.
- The current AI endpoint analyzes a capped recent transaction window, not necessarily the wallet's full lifetime.

Why this matters:

- All risk, persona, PnL, and evidence labels are based on these `200` transactions.
- If a risk factor says `10 unsupported transactions`, users should also see that this is `10 out of 200 analyzed transactions`.

Recommended improvement to explanation text:

> Across 200 analyzed transactions, 10 were unsupported by the parser and 0 were missing price points.

## 3. AI Wallet Behavior Summary

This section gives plain-language interpretation of the computed profile.

It contains:

- Short summary paragraph
- Wallet Persona card
- Risk Summary card
- PnL Summary card

### 3.1 Main Summary Paragraph

Example:

`SupRAx...M5SF is classified as HIGH_RISK_SPECULATOR with CRITICAL risk in the analyzed window.`

This should be made clearer for non-technical users:

Recommended display:

> This wallet is classified as High Risk Speculator with Critical risk in the analyzed window. This means the wallet shows aggressive speculative trading behavior and multiple high-impact risk signals in the transactions analyzed.

Avoid showing enum labels like:

- `HIGH_RISK_SPECULATOR`
- `BOT_LIKE_TRADER`
- `WASH_TRADING_SUSPECT`

Instead, convert them to readable labels:

- `High Risk Speculator`
- `Bot-like Trader`
- `Wash Trading Suspect`

### 3.2 Wallet Persona Card

Example:

`High Risk Speculator`

This card repeats the primary persona, but in a user-friendly format.

It should explain:

- what the label means,
- which behavior caused it,
- that this is a behavioral label, not an identity claim.

For `High Risk Speculator`, explain:

> The wallet shows speculative trading behavior, such as short holding periods, broad token trading, negative realized PnL, or high DEX activity.

### 3.3 Risk Summary Card

Example:

`Risk score 86/100 (CRITICAL); trust score 14/100.`

This card should explain:

- Risk Score is cumulative.
- Trust Score is inverse of Risk Score.
- Critical means the total risk score is at least 75.

Recommended display:

> Risk score is 86/100, which falls in the Critical range. Trust score is 14/100 because trust is calculated as 100 minus risk score.

### 3.4 PnL Summary Card

Example:

`Realized PnL is -4.81 USD across 45 closed positions.`

Meaning:

- Realized PnL measures profit/loss on positions that appear closed in the analyzed transaction window.
- `45 closed positions` means the analyzer found 45 completed position outcomes.
- Negative realized PnL contributes to risk if it is below zero.

Important limitation:

- PnL depends on available swap value data.
- Some illiquid or unsupported tokens may reduce precision.

## 4. Key Findings

This section combines:

- `aiSummary.suspiciousFindings`
- `aiSummary.behaviorInsights`

Each finding should be a separate card.

Each card shows:

- title,
- severity badge (`HIGH`, `MEDIUM`, `LOW`),
- explanation,
- evidence ID chips,
- related signature chips if available.

### 4.1 What HIGH / MEDIUM / LOW Means in Key Findings

For findings, severity describes how important the finding is in the current analysis.

Recommended user explanation:

| Severity | Meaning |
|---|---|
| `HIGH` | Strong signal; user should review it first. |
| `MEDIUM` | Meaningful signal; contributes to the interpretation. |
| `LOW` | Contextual signal; useful but not decisive alone. |

Important:

- A `HIGH` finding is not proof of wrongdoing.
- It means the computed evidence is important to the wallet's risk/persona profile.

### 4.2 Evidence ID Chips

Example:

`ev_risk_missing_data`

Meaning:

- Evidence IDs link findings to the exact evidence card or risk factor used by the system.
- They help users trace why a finding exists.

Recommended user explanation:

> Evidence IDs are internal references that connect this finding to the supporting evidence below.

### 4.3 Signature Chips

Meaning:

- Each signature chip links to a Solscan transaction.
- Signatures are truncated so they do not overflow.
- Example display: `5KkTMf...4LNZ`

Click behavior:

- Opens `https://solscan.io/tx/{signature}`
- Opens in a new browser tab.

User meaning:

> These are representative transactions used to support the finding.

## 5. Risk Breakdown

This section lists `profile.risk.riskFactors`.

Each risk factor card shows:

- readable title,
- severity badge,
- score impact such as `+12 pts`,
- explanation,
- evidence ID chips.

### 5.1 What `+12 pts`, `+8 pts`, `+22 pts` Mean

The point value is how much that factor adds to the wallet's total Risk Score.

Example:

- `Short Holding Period +22 pts`
- `High Frequency Activity +12 pts`
- `Missing Data +5 pts`

Meaning:

- Higher point impact means the factor contributed more to the total risk score.
- The total risk score is the sum of all positive risk factor impacts plus persona-based adjustment, capped between 0 and 100.

Formula:

`Risk Score = sum(risk factor points) + persona adjustment`

Then:

`Trust Score = 100 - Risk Score`

### 5.2 Risk Factor Severity

Risk factor severity is assigned from the score impact:

| Score Impact | Severity |
|---:|---|
| `15+ pts` | `HIGH` |
| `8-14 pts` | `MEDIUM` |
| `1-7 pts` | `LOW` |

Examples:

- `+22 pts` -> `HIGH`
- `+12 pts` -> `MEDIUM`
- `+8 pts` -> `MEDIUM`
- `+5 pts` -> `LOW`

### 5.3 Common Risk Factors and Why They Appear

#### High Frequency Activity

Appears when activity is concentrated or unusually fast.

Signals can include:

- activity level is `EXTREME`,
- burst activity score is at least `70`,
- at least `30` transactions in one hour,
- median time between transactions is `60 seconds` or less.

User explanation:

> This wallet made transactions in dense clusters, which can indicate automated or high-intensity trading behavior.

#### Short Holding Period

Appears when many positions are opened and closed quickly.

Signals can include:

- short-term trade ratio at least `50%`,
- short-term trade ratio at least `75%`,
- median holding period at or below `1 hour`,
- trading style classified as sniper-like.

User explanation:

> The wallet often holds traded assets for short periods, which increases speculative-risk scoring.

#### Negative PnL

Appears when realized PnL is below zero.

Signals can include:

- realized PnL below `0`,
- realized PnL below `-100`,
- realized PnL below `-1000`.

User explanation:

> Closed positions in the analyzed window produced negative realized PnL.

#### Low Win Rate

Appears when the wallet has enough closed positions and a low win rate.

Signals can include:

- at least `5` closed positions and win rate below `45%`,
- at least `10` closed positions and win rate below `35%`.

User explanation:

> The wallet closes enough positions to estimate win rate, and the win rate is low.

#### High Token Diversity

Appears when the wallet trades many different tokens.

Signals can include:

- at least `20` unique tokens traded,
- at least `50` unique tokens traded.

User explanation:

> The wallet trades across a broad token set, which may indicate speculative activity.

#### High Portfolio Concentration

Appears when holdings are concentrated in a small number of tokens.

Signals can include:

- portfolio concentration risk is `MEDIUM`,
- portfolio concentration risk is `HIGH`,
- top holding is at least `80%` of estimated portfolio value.

User explanation:

> A large share of portfolio value is concentrated in one or a few holdings.

#### Wash Trading Suspected

Appears when wash-trading indicators are elevated.

Signals can include:

- suspicion score at least `50`,
- suspicion score at least `70`,
- suspicion level is `HIGH`,
- multiple wash-trading signals are present.

Recommended careful wording:

> The wallet shows patterns that can be associated with potentially suspicious market behavior. This is not proof of wash trading.

#### Missing Data

Example:

`Missing Data`

`LOW +5 pts`

`Data completeness is 85% with 0 missing price points and 10 unsupported transactions.`

Meaning:

- This risk factor does not mean the wallet did something risky.
- It means the analysis is slightly less reliable because some transactions could not be fully parsed.
- In the example, there are `10 unsupported transactions`.

Recommended improved wording:

> Across 200 analyzed transactions, data completeness is 85%. There are 0 missing price points and 10 unsupported transactions, so a small reliability penalty of +5 risk points is applied.

Why it is `LOW`:

- `+5 pts` falls in the `LOW` severity range.

## 6. Evidence Highlights

This section renders `aiSummary.evidenceHighlights` if available. If not, it falls back to `profile.evidence`.

Each evidence card should show:

- evidence title,
- severity badge,
- description,
- value,
- threshold,
- evidence ID,
- related signatures,
- related token mints.

### 6.1 Evidence Title

Example:

`High token diversity`

Meaning:

- The title describes the signal being measured.
- It should be readable and not shown as an enum.

### 6.2 Severity Badge

Evidence severity uses the same user-facing meaning:

| Severity | Meaning |
|---|---|
| `HIGH` | Strong supporting evidence |
| `MEDIUM` | Meaningful supporting evidence |
| `LOW` | Contextual supporting evidence |

### 6.3 Description

The description explains why this evidence exists.

Example:

`Unique tokens traded: 55.`

Recommended clearer wording:

> The wallet traded 55 unique tokens in the analyzed transaction window.

### 6.4 Value and Threshold

Evidence cards may show:

- `Value`: the measured value for this wallet.
- `Threshold`: the rule threshold that triggered the evidence.

Example:

- Value: `55`
- Threshold: `20`

Meaning:

> The wallet measured 55 unique traded tokens, which is above the 20-token threshold for high token diversity.

### 6.5 Evidence ID

Example:

`ev_risk_high_token_diversity`

Meaning:

- This is a trace ID connecting evidence to risk factors and findings.
- It is useful for auditability.
- It should be visually secondary, not the main user-facing message.

### 6.6 Related Signatures

Meaning:

- These are representative transactions that support the evidence.
- Show only up to 5 signatures.
- If more exist, show `+N more`.
- Each signature should be clickable and open Solscan.

Recommended explanation:

> Related signatures are example transactions used to support this evidence card.

### 6.7 Related Token Mints

Meaning:

- These are token mint addresses connected to the evidence.
- They should be truncated to avoid overflow.
- They are useful when the evidence is token-specific.

Recommended explanation:

> Related token mints show which tokens were involved in this signal.

## 7. Caution Notes

This section should always appear as a muted info/warning card.

It contains:

- AI-generated caution notes if any,
- default disclaimer.

Required default disclaimer:

> Risk score reflects observed behavior in the analyzed transaction window. It is not financial advice, a legal judgment, or proof of fraud.

Purpose:

- Prevents users from treating scores as legal conclusions.
- Reminds users that the analysis is bounded by the transaction window and data quality.

## 8. Empty State

If `actualTransactionCount === 0`, show a centered empty state:

`No analyzable activity found for this wallet.`

Do not show metric cards, risk cards, or evidence cards.

User explanation:

> The system loaded transaction data successfully, but there were no analyzable events in the current analysis window.

## 9. Error State

If the API returns an error, show a clean error card with retry.

For transaction loading failure:

`AI analysis could not load wallet transaction data. Please retry.`

Do not show:

`No analyzable activity found`

Why:

- Fetch failure is different from a real empty wallet.
- Users should understand this is a loading/data issue, not a wallet behavior result.

## 10. Recommended End-User Copy for the Current Wallet

For the screenshot wallet, the UI should explain:

> This wallet was analyzed over 200 recent transactions. It is classified as High Risk Speculator with Critical risk because multiple risk factors were triggered in the analyzed window. The total risk score is 86/100, which produces a trust score of 14/100. The persona confidence is 84%, meaning the observed behavior strongly supports this persona compared with alternative labels. Data completeness is 85%, so the analysis is mostly usable, but 10 unsupported transactions reduce reliability slightly.

For `Missing Data LOW +5 pts`, explain:

> Missing Data adds +5 risk points because 10 out of 200 analyzed transactions were unsupported, even though there were 0 missing price points. This is a low-severity reliability adjustment, not a claim that the wallet behaved suspiciously.

For `High Risk Speculator` + `Critical`, explain:

> High Risk Speculator describes the wallet's behavior pattern. Critical describes the overall risk score. They are related but separate labels: persona tells users what kind of behavior the wallet most resembles, while risk level tells users how strong the total risk signals are.

## 11. UI Label Improvements Recommended

To make the tab easier for non-technical users:

- Show `High Risk Speculator`, not `HIGH_RISK_SPECULATOR`.
- Show `Bot-like Trader`, not `BOT_LIKE_TRADER`.
- Add small helper text under persona labels explaining what the label means.
- For each risk factor, show `+N pts added to risk score`.
- For missing data, include `out of 200 analyzed transactions`.
- Keep evidence IDs visible but secondary.
- Keep Solscan signature chips short and clickable.
- Avoid raw enum strings in summary paragraphs.

