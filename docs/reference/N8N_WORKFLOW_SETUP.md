# N8N Workflow: news-search-and-filter

This document describes `n8n/news-search-and-filter.json` used to fetch Brave Search results and filter them using Google Gemini LLM.

Overview
- Webhook node path: `latest-news` (responseMode: `lastNode`).
- Set node extracts token context: `address`, `symbol`, `token_name`, `current_time`.
- Brave Search node uses query: `token {name}({symbol}) latest news in {current_time}`.
- Split + normalize nodes iterate results and produce entries consumed by LLM filter.
- Google Gemini Chat node runs model `models/gemma-4-31b-it` to filter/score relevance.
- Final output should be JSON with `entry[]` array containing: `title`, `url`, `description`, `timestamp`, `meta` (source, favicon), `extra_snippets`.

Safety & Limits
- n8n workflow must complete within 30s per fetch cycle.
- LLM gate should use retry/backoff (maxTries=5, waitBetweenTries=2000ms).
- Workflow returns only pre-filtered articles; downstream server validates and deduplicates by URL/content hash.

Credentials
- Brave Search API credential configured in `search news` node.
- Google Palm/Gemini credential configured in Gemini node.

Integration notes
- n8n webhook `latest-news` is invoked by user action from client; ensure client supplies `{ address, symbol, name }` in request body.
- n8n can POST results to server `/api/news/webhook` as a separate step if desired; otherwise server exposes `/api/news/webhook` for direct n8n POSTs.

Example query string
```
token Jupiter(JUP) latest news in April 2026
```

Log and monitoring
- Capture LLM acceptance rate and number of results returned per request.
- Log failures and response times for alerting.

*** End
