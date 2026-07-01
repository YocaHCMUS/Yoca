# AI Analysis Tab — End-User Explanation and UX Specification

This document explains what end users will see in the **AI Analysis** tab, what each card/component means, and how labels, scores, severity badges, and evidence are calculated or assigned.

Example wallet used in the current UI:

`SupRAxJybdbv68r1PDXDq9LWKgdzLsmPwiyj41RM5SF`

Example visible values:

- Trust Score: `14 / 100`
- Risk Level: `CRITICAL`
- Persona: `High Risk Speculator`
- Persona Confidence: `84%`
- Data Completeness: `85%`
- Analyzed Transactions: `200`
- Risk Score: `86 / 100`
- Realized PnL: `-4.81 USD`
- Closed Positions: `45`

Important wording rule: all labels are **behavioral classifications based on the analyzed transaction window**. They are not legal judgments, financial advice, fraud accusations, or proof of intent.

---

## 1. Purpose of the AI Analysis Tab

The AI Analysis tab converts raw wallet behavior into a user-friendly, evidence-backed report.

It helps users answer:

- What kind of wallet behavior does this address show?
- How risky does the wallet look in the analyzed window?
- Which specific metrics caused the risk/persona labels?
- Which transaction signatures can users inspect on Solscan?
- How reliable is the analysis data?

The feature is not just an AI text summary. The backend first calculates metrics, persona, risk, and evidence. The AI layer then explains the computed profile in plain language.

---

## 2. Header Component

### What users see

- Title: `AI Wallet Behavior Analysis`
- Subtitle: `Evidence-aware wallet analysis with persona, risk, and signature-backed findings.`
- Generated timestamp
- Refresh analysis button

### Meaning

The header tells users that this is a structured wallet behavior report, not a generic chatbot answer.

The refresh button reruns the analysis for the selected wallet. This is useful when new transactions appear or when users want a fresh summary.

### Recommended hover/help text

> This analysis is generated from the selected wallet's recent transaction window. It combines computed metrics, risk factors, persona classification, and evidence-backed AI explanation.

---

## 3. Top Metric Cards

The top section contains six summary cards. These cards give users a quick view of the wallet's risk and analysis quality.

### 3.1 Trust Score Card

Example:

`14 / 100`

### Meaning

Trust Score is a simple inverse of Risk Score.

Formula:

```text
Trust Score = 100 - Risk Score
```

For the example wallet:

```text
Risk Score = 86
Trust Score = 100 - 86 = 14
```

Higher trust score means fewer risky behavioral signals were found. Lower trust score means stronger or more numerous risk signals were detected.

### How this wallet got 14/100

This wallet has a low trust score because multiple risk factors contributed to the total risk score, including short holding periods, high token diversity, low win rate, high-frequency activity, negative PnL, and missing/unsupported data.

### Recommended hover/help text

> Trust Score is calculated as 100 minus Risk Score. A low trust score means the wallet triggered several risk signals in the analyzed transaction window.

---

### 3.2 Risk Level Card

Example:

`CRITICAL`

### Meaning

Risk Level is assigned from the final Risk Score.

| Risk Score | Risk Level |
|---:|---|
| Fewer than 10 analyzed transactions | `UNKNOWN` |
| 0-19 | `LOW` |
| 20-44 | `MEDIUM` |
| 45-74 | `HIGH` |
| 75-100 | `CRITICAL` |

For the example wallet:

```text
Risk Score = 86
86 >= 75, so Risk Level = CRITICAL
```

### User-facing explanation

`CRITICAL` means the wallet triggered enough high-impact behavioral risk signals that users should review it carefully.

It does **not** mean the wallet is proven fraudulent or malicious.

### Recommended hover/help text

> Risk Level is based on the total Risk Score. Critical means the wallet triggered multiple strong risk signals, but it is not a fraud verdict.

---

### 3.3 Persona Card

Example:

`High Risk Speculator`

### Meaning

Persona describes the wallet's dominant behavior pattern. It is selected by scoring multiple possible personas and choosing the strongest supported label.

Backend enum:

`HIGH_RISK_SPECULATOR`

User-facing label:

`High Risk Speculator`

### What High Risk Speculator means

This label means the wallet behaves like an aggressive short-term speculative trader in the analyzed window.

Signals that can contribute to this persona include:

- high short-term trade ratio,
- many unique tokens traded,
- low win rate,
- negative realized PnL,
- heavy DEX usage,
- sniper-like or very fast trading behavior.

### Why this wallet received this label

The example wallet shows several speculative behavior signals:

- many unique tokens traded,
- short holding behavior,
- low win rate,
- negative realized PnL,
- high overall risk score.

### Important clarification: Persona vs Risk Level

`High Risk Speculator` and `CRITICAL` do not mean the same thing.

| Label | Meaning |
|---|---|
| Persona: `High Risk Speculator` | What behavior pattern the wallet most resembles |
| Risk Level: `CRITICAL` | How strong the total risk signals are |

A wallet can be a High Risk Speculator with High or Critical risk depending on the risk score. Persona explains **type of behavior**. Risk level explains **severity of risk signals**.

### Recommended hover/help text

> Persona is a behavioral label. It describes what the wallet's activity resembles, not who controls the wallet or whether the wallet is malicious.

---

### 3.4 Persona Confidence Card

Example:

`84%`

### Meaning

Persona Confidence measures how strongly the analyzed data supports the selected persona compared with alternative personas.

It is based on:

- the top persona score,
- the gap between the top persona and the next closest persona,
- data completeness,
- transaction count.

### User-facing explanation

`84%` means the system found strong support for the selected persona in the available data.

It does not mean the label is a guaranteed truth. It only means the selected behavior pattern is strongly supported by the computed metrics.

### Recommended hover/help text

> Persona Confidence estimates how strongly the wallet's metrics support this behavior label. It is not legal certainty or proof of intent.

---

### 3.5 Data Completeness Card

Example:

`85%`

### Meaning

Data Completeness estimates how reliable the available data is for the analysis.

It is reduced by:

- missing price data,
- unsupported or unknown transactions,
- parsing warnings,
- failed transactions.

Current formula:

```text
Data Completeness = 100
  - missingPriceRatio * 30
  - unsupportedRatio * 30
  - suspiciousParsingRatio * 20
  - failedTransactionRatio * 20
```

### Example explanation

For this wallet:

- analyzed transactions: `200`
- missing price points: `0`
- unsupported transactions: `10`
- data completeness: `85%`

Recommended wording:

> Across 200 analyzed transactions, data completeness is 85%. There are 0 missing price points and 10 unsupported transactions, so the analysis is mostly usable but not perfect.

### Recommended hover/help text

> Data Completeness tells you how much of the wallet data was usable for analysis. Unsupported or missing data lowers reliability.

---

### 3.6 Analyzed Transactions Card

Example:

`200`

### Meaning

This is the number of transactions included in the analysis window.

The AI Analysis tab does not necessarily analyze the wallet's full lifetime. It analyzes the selected/capped recent transaction window.

### Why it matters

All labels, scores, findings, PnL, and evidence are based on these analyzed transactions.

For example, if the UI says:

```text
10 unsupported transactions
```

it should ideally explain:

```text
10 unsupported transactions out of 200 analyzed transactions
```

### Recommended hover/help text

> This is the number of transactions used in the current AI analysis. Results describe this window, not necessarily the wallet's full history.

---

## 4. AI Wallet Behavior Summary Component

This section gives a plain-language interpretation of the computed wallet profile.

It usually contains:

- short summary paragraph,
- Wallet Persona mini-card,
- Risk Summary mini-card,
- PnL Summary mini-card.

---

### 4.1 Short Summary Paragraph

Current style example:

```text
SupRAx...M5SF is classified as HIGH_RISK_SPECULATOR with CRITICAL risk in the analyzed window.
```

Recommended user-facing style:

```text
This wallet is classified as High Risk Speculator with Critical risk in the analyzed transaction window. This means it shows aggressive speculative trading behavior and multiple high-impact risk signals.
```

### UI recommendation

Do not show raw enum labels in prose.

Use readable labels:

| Raw enum | User-facing label |
|---|---|
| `HIGH_RISK_SPECULATOR` | `High Risk Speculator` |
| `BOT_LIKE_TRADER` | `Bot-like Trader` |
| `WASH_TRADING_SUSPECT` | `Wash Trading Suspect` |
| `DEFI_TRADER` | `DeFi Trader` |
| `LONG_TERM_HOLDER` | `Long-term Holder` |

---

### 4.2 Wallet Persona Mini-Card

Example:

`High Risk Speculator`

### What it explains

This card should explain the selected behavior pattern in one or two sentences.

Recommended copy for this wallet:

> The wallet shows speculative trading behavior, including broad token trading, short holding behavior, and weak trading outcomes in the analyzed window.

---

### 4.3 Risk Summary Mini-Card

Example:

`Risk score 86/100 (CRITICAL); trust score 14/100.`

### What it explains

This card should make the relationship between risk and trust clear.

Recommended copy:

> Risk score is 86/100, which falls in the Critical range. Trust score is 14/100 because trust is calculated as 100 minus risk score.

---

### 4.4 PnL Summary Mini-Card

Example:

`Realized PnL is -4.81 USD across 45 closed positions.`

### Meaning

Realized PnL measures approximate profit or loss from positions that appear closed within the analyzed transaction window.

`45 closed positions` means the analyzer found 45 completed trade outcomes.

### Important limitation

PnL is approximate and depends on available swap value data. Transfers, airdrops, unknown cost basis assets, and unsupported transactions may reduce precision.

### Recommended hover/help text

> Realized PnL is calculated from closed swap positions where the system has enough USD value data. It may exclude transfers, airdrops, or unknown cost basis assets.

---

## 5. Key Findings Component

This section combines:

- `aiSummary.suspiciousFindings`,
- `aiSummary.behaviorInsights`.

Each finding should be shown as a separate card.

Each finding card should contain:

- title,
- severity badge,
- explanation,
- evidence ID chips,
- related transaction signature chips.

---

### 5.1 What HIGH / MEDIUM / LOW Means

For Key Findings, severity describes how important the finding is to the current analysis.

| Severity | Meaning |
|---|---|
| `HIGH` | Strong signal. User should review this first. |
| `MEDIUM` | Meaningful signal. It contributes to the interpretation. |
| `LOW` | Contextual signal. Useful but not decisive alone. |

A `HIGH` finding is not proof of wrongdoing. It means the supporting metric/evidence is important.

---

### 5.2 Example: Short Holding Period

Example finding:

```text
SHORT HOLDING PERIOD — HIGH
Short-term trade ratio is 100% with a median holding period of 0.0002777 hours.
Evidence ID: ev_risk_short_holding
```

### Meaning

The wallet frequently opens and closes positions very quickly.

This can contribute to speculative-risk scoring because fast exits may indicate aggressive short-term trading or automated behavior.

### Recommended clearer display

```text
Short Holding Period
Severity: High
100% of closed positions were short-term trades. Median holding time was extremely short.
Evidence: ev_risk_short_holding
Representative transactions: [signature chips]
```

---

### 5.3 Example: High Token Diversity

Example:

```text
HIGH TOKEN DIVERSITY — HIGH
Wallet traded 74 unique tokens in the analyzed window.
```

### Meaning

The wallet traded many different tokens instead of focusing on a small number of assets.

This may suggest speculative behavior, especially when combined with short holding periods or weak PnL.

---

### 5.4 Example: Low Win Rate

Example:

```text
LOW WIN RATE — MEDIUM
Win rate is 29% across 45 closed positions.
```

### Meaning

The wallet closed enough positions to estimate win rate, and the percentage of profitable closed positions is low.

This contributes to risk because it suggests poor realized trading outcomes in the analyzed window.

---

### 5.5 Example: High Frequency Activity

Example:

```text
HIGH FREQUENCY ACTIVITY — MEDIUM
Activity is concentrated with a busiest UTC hour containing 16 transactions.
```

### Meaning

The wallet made many transactions in a short period. This can indicate high-intensity trading, bot-like behavior, or active speculation.

---

### 5.6 Evidence ID Chips

Example:

`ev_risk_short_holding`

### Meaning

Evidence IDs connect the finding to the exact supporting evidence card and risk factor.

They are mainly for traceability and auditability.

### UI recommendation

Show evidence IDs as secondary chips, not as the main explanation.

---

### 5.7 Signature Chips

Signature chips are representative transactions that users can inspect.

Display format:

```text
5KkTMf...4LNZ
```

Click behavior:

```text
https://solscan.io/tx/{signature}
```

Open in a new tab.

### User explanation

> These are representative transactions used to support this finding. Click a signature to inspect it on Solscan.

---

## 6. Risk Breakdown Component

This section renders `profile.risk.riskFactors`.

Each risk factor card should show:

- readable risk factor title,
- severity badge,
- score impact, e.g. `+22 pts`,
- explanation,
- evidence ID chips.

---

### 6.1 What +N Points Means

The `+N pts` value shows how much that factor adds to the wallet's total Risk Score.

Example:

- `Short Holding Period +22 pts`
- `High Token Diversity +15 pts`
- `Low Win Rate +14 pts`
- `Missing Data +5 pts`

Formula:

```text
Risk Score = sum(risk factor points) + persona adjustment
Trust Score = 100 - Risk Score
```

The final Risk Score is capped between `0` and `100`.

### Recommended hover/help text

> This value shows how many points this factor adds to the wallet's total risk score.

---

### 6.2 Risk Factor Severity

Risk factor severity is assigned from score impact.

| Score Impact | Severity |
|---:|---|
| 1-7 pts | `LOW` |
| 8-14 pts | `MEDIUM` |
| 15+ pts | `HIGH` |

Examples:

- `+22 pts` → `HIGH`
- `+12 pts` → `MEDIUM`
- `+8 pts` → `MEDIUM`
- `+5 pts` → `LOW`

---

### 6.3 Common Risk Factors

#### Short Holding Period

Appears when the wallet opens and closes positions quickly.

Signals can include:

- short-term trade ratio at least `50%`,
- short-term trade ratio at least `75%`,
- median holding period at or below `1 hour`,
- sniper-like trading style.

User explanation:

> This wallet often holds traded assets for short periods, which increases speculative risk.

---

#### High Frequency Activity

Appears when transactions are unusually dense or fast.

Signals can include:

- activity level is `EXTREME`,
- burst activity score is at least `70`,
- at least `30` transactions in one hour,
- median time between transactions is `60 seconds` or less.

User explanation:

> This wallet made transactions in dense clusters, which can indicate automated or high-intensity trading behavior.

---

#### Negative PnL

Appears when realized PnL is below zero.

Signals can include:

- realized PnL below `0`,
- realized PnL below `-100`,
- realized PnL below `-1000`.

User explanation:

> Closed positions in the analyzed window produced negative realized PnL.

---

#### Low Win Rate

Appears when the wallet has enough closed positions and a low win rate.

Signals can include:

- at least `5` closed positions and win rate below `45%`,
- at least `10` closed positions and win rate below `35%`.

User explanation:

> The wallet has enough closed trades to estimate win rate, and the win rate is low.

---

#### High Token Diversity

Appears when the wallet trades many different tokens.

Signals can include:

- at least `20` unique tokens traded,
- at least `50` unique tokens traded.

User explanation:

> The wallet traded across a broad token set, which may indicate speculative activity.

---

#### High Portfolio Concentration

Appears when the wallet's holdings are concentrated in one or a few assets.

Signals can include:

- portfolio concentration risk is `MEDIUM`,
- portfolio concentration risk is `HIGH`,
- top holding is at least `80%` of estimated portfolio value.

User explanation:

> A large share of portfolio value is concentrated in one or a few holdings.

---

#### Wash Trading Suspected

Appears when wash-trading indicators are elevated.

Signals can include:

- suspicion score at least `50`,
- suspicion score at least `70`,
- suspicion level is `HIGH`,
- multiple wash-trading signals are present.

Careful wording:

> The wallet shows patterns that can be associated with potentially suspicious market behavior. This is not proof of wash trading.

---

#### Missing Data

Example:

```text
Missing Data
LOW +5 pts
Data completeness is 85% with 0 missing price points and 10 unsupported transactions.
```

### Meaning

Missing Data does not mean the wallet behaved suspiciously. It means the analysis is slightly less reliable because some transactions could not be fully parsed.

For the example wallet:

- total analyzed transactions: `200`
- missing price points: `0`
- unsupported transactions: `10`
- data completeness: `85%`
- risk impact: `+5 pts`
- severity: `LOW`

Recommended wording:

> Across 200 analyzed transactions, data completeness is 85%. There are 0 missing price points and 10 unsupported transactions, so a small reliability penalty of +5 risk points is applied.

---

## 7. Evidence Highlights Component

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

---

### 7.1 Evidence Title

Example:

`High token diversity`

Meaning:

The title describes the signal being measured.

UI should use readable titles instead of raw enums.

---

### 7.2 Severity Badge

Evidence severity means how strong the supporting evidence is.

| Severity | Meaning |
|---|---|
| `HIGH` | Strong supporting evidence |
| `MEDIUM` | Meaningful supporting evidence |
| `LOW` | Contextual supporting evidence |

---

### 7.3 Description

The description explains why the evidence exists.

Raw example:

```text
Unique tokens traded: 55.
```

Clearer user-facing version:

```text
The wallet traded 55 unique tokens in the analyzed transaction window.
```

---

### 7.4 Value and Threshold

Evidence cards may show a measured value and the threshold that triggered the rule.

Example:

```text
Value: 55
Threshold: 20
```

Meaning:

> The wallet traded 55 unique tokens, which is above the 20-token threshold for high token diversity.

---

### 7.5 Evidence ID

Example:

`ev_risk_high_token_diversity`

Meaning:

Evidence ID is a trace ID connecting the evidence to risk factors and key findings.

UI recommendation:

Display it, but keep it visually secondary.

---

### 7.6 Related Signatures

Related signatures are representative transactions that support the evidence.

Rules:

- Show up to 5 signatures.
- Truncate signatures.
- Link each signature to Solscan.
- If there are more than 5, show `+N more`.

Recommended explanation:

> Related signatures are example transactions used to support this evidence card.

---

### 7.7 Related Token Mints

Related token mints show which tokens were involved in a token-specific signal.

They should be truncated and shown as chips.

Recommended explanation:

> Related token mints show which tokens were involved in this signal.

---

## 8. Caution Notes Component

This section should always appear as a muted info/warning card.

It contains:

- AI-generated caution notes,
- default product disclaimer.

Required disclaimer:

> Risk score reflects observed behavior in the analyzed transaction window. It is not financial advice, a legal judgment, or proof of fraud.

Purpose:

- prevents overclaiming,
- reminds users that the result depends on the analysis window,
- prevents users from treating AI output as a legal or investment conclusion.

---

## 9. Empty State

If:

```text
actualTransactionCount === 0
```

show:

```text
No analyzable activity found for this wallet.
```

Do not show metric cards, risk cards, or evidence cards.

Meaning:

The system successfully loaded data, but there were no usable events in the current analysis window.

---

## 10. Error State

If transaction loading fails, show:

```text
AI analysis could not load wallet transaction data. Please retry.
```

Do not show:

```text
No analyzable activity found
```

Reason:

Fetch failure is different from a wallet with no analyzable activity.

---

## 11. Recommended Tooltip System

Because users may not understand scores and labels, the UI should add tooltips or info icons beside important labels.

Recommended tooltip locations:

| UI Element | Tooltip should explain |
|---|---|
| Trust Score | Formula: `100 - Risk Score` |
| Risk Level | Score thresholds for Low/Medium/High/Critical |
| Persona | Behavioral meaning of the selected label |
| Persona Confidence | Why confidence is not certainty |
| Data Completeness | Missing price, unsupported transactions, warnings |
| Analyzed Transactions | Scope of the analysis window |
| Severity Badge | Meaning of High/Medium/Low |
| +N Risk Points | Contribution to total Risk Score |
| Evidence ID | Trace link between finding and evidence |
| Signature Chips | Click to verify transactions on Solscan |

This is better than adding too much text directly into the cards. Cards stay clean, while curious users can hover for details.

---

## 12. Recommended UX Improvements

### 12.1 Add “Why this label?” expandable section

For Persona and Risk Level, add an expandable explanation.

Example:

```text
Why High Risk Speculator?
- 74 unique tokens traded
- 100% short-term trade ratio
- 29% win rate across 45 closed positions
- Negative realized PnL
```

### 12.2 Add “How score is calculated” link

For Trust Score/Risk Score, show a small link or tooltip:

```text
How is this calculated?
```

Opening it should show:

```text
Risk Score is built from risk factor points. Trust Score is 100 minus Risk Score.
```

### 12.3 Separate “risk” from “data reliability”

Missing Data should be visually framed as reliability, not suspicious behavior.

Recommended label:

```text
Data Reliability Penalty
```

instead of only:

```text
Missing Data
```

### 12.4 Use readable labels everywhere

Avoid showing raw enum values in the UI.

Bad:

```text
HIGH_RISK_SPECULATOR
```

Good:

```text
High Risk Speculator
```

### 12.5 Keep evidence IDs secondary

Users care more about the explanation and signatures than internal IDs.

Show:

```text
Evidence: Short Holding Period
```

Then optionally:

```text
ID: ev_risk_short_holding
```

### 12.6 Add severity legend

Add a small legend:

```text
HIGH = strong signal
MEDIUM = meaningful signal
LOW = contextual signal
```

This prevents users from misinterpreting severity badges.

---

## 13. Recommended End-User Copy for the Current Wallet

For the sample wallet, the AI Analysis tab should communicate something like:

> This wallet was analyzed over 200 recent transactions. It is classified as High Risk Speculator with Critical risk because multiple high-impact risk factors were triggered in the analyzed window. The total risk score is 86/100, which gives a trust score of 14/100. Persona confidence is 84%, meaning the observed behavior strongly supports this persona compared with alternative labels. Data completeness is 85%, so most data was usable, but 10 unsupported transactions reduce reliability slightly.

For Missing Data:

> Missing Data adds +5 risk points because 10 out of 200 analyzed transactions were unsupported, even though there were 0 missing price points. This is a low-severity reliability adjustment, not a claim that the wallet behaved suspiciously.

For High Risk Speculator + Critical:

> High Risk Speculator describes the wallet's behavior pattern. Critical describes the overall risk level. They are related but separate: persona tells users what kind of behavior the wallet resembles, while risk level tells users how strong the total risk signals are.

---

## 14. Final User-Facing Mental Model

The AI Analysis tab should teach users this simple model:

```text
Persona = What behavior pattern does this wallet resemble?
Risk Level = How strong are the risk signals?
Trust Score = 100 - Risk Score
Data Completeness = How reliable is the available data?
Key Findings = Main reasons behind the result
Risk Breakdown = Point-by-point risk calculation
Evidence Highlights = Metrics and transactions users can verify
Caution Notes = Limits of the analysis
```

This turns the feature from a black-box AI opinion into an explainable wallet intelligence report.
