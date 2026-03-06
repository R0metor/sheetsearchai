# SheetSearch AI

**LLM-Powered Structured Query Engine for Arbitrary Tabular Data**

Ask plain-English questions about any CSV or Excel spreadsheet and get precise, deterministic answers — no SQL knowledge required.

---

## How It Works

1. **Upload** a CSV or XLSX file
2. **Ask** a natural-language question ("Top 3 departments by average salary")
3. The engine **deterministically extracts constraints** from your question (numeric thresholds, date ranges, boolean flags, categorical filters, rankings)
4. An **LLM generates an execution plan** (multi-step: filter → group → sort → limit)
5. The plan is **semantically validated** against extracted constraints — hallucinated filters are stripped
6. If the plan is invalid, an **automatic repair loop** corrects it
7. The plan is **executed deterministically** on the in-memory dataset
8. You get a structured answer with full execution trace and confidence score

---

## Architecture

```
frontend2/          React + Vite + TailwindCSS frontend
app/
  main.py           FastAPI routes (upload, query, stats)
  agent.py          LLM planner, validator, repair loop, execution engine
  intent_guard.py   Deterministic constraint extractor + semantic validator
  datasets.py       In-memory dataset store + automatic schema inference
  tools.py          Pure filter / sort / aggregate / group_aggregate functions
  config.py         Environment config (OpenAI API key, Google Sheets)
  sheets.py         Optional Google Sheets data source
```

### Key Design Principles

- **No LangChain. No vector DB. No hardcoded business logic.**
- Filters are only added if they come from user-extracted constraints — never injected automatically
- LLM output is constrained to a strict JSON schema and validated before execution
- All aggregation, filtering, and sorting is deterministic Python — no LLM hallucination in results

---

## Supported Query Types

| Category | Example |
|---|---|
| Basic numeric filters | "Employees with salary above 120,000" |
| Boolean filters | "Count remote employees" / "Non-remote employees in Marketing" |
| Date filters | "Employees hired after 2020" / "Hired between 2016 and 2020" |
| Sorting + limits | "Top 10 highest paid employees" |
| Group aggregations | "Average salary by department" |
| HAVING-style | "Departments with more than 40 employees" |
| Multi-step | "Top 3 office locations by average salary" |
| Edge cases | Returns 0 rows gracefully for impossible constraints |

---

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 18+
- An OpenAI API key

### 1. Clone & Install Backend

```bash
git clone <repo-url>
cd sheetsearchai

# Using uv (recommended)
uv sync

# Or pip
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file:

```env
OPENAI_API_KEY=sk-...

# Optional: Google Sheets integration
GOOGLE_SERVICE_ACCOUNT_FILE=sheetsearchkey.json
SHEET_ID=your_google_sheet_id
```

### 3. Start the Backend

```bash
uv run uvicorn app.main:app --port 8001 --reload
```

API will be available at `http://localhost:8001`.

### 4. Start the Frontend

```bash
cd frontend2
npm install
npm run dev
```

Frontend will be available at `http://localhost:5173` (or as shown in terminal).

---

## API Reference

### `POST /upload`

Upload a CSV or XLSX file.

```json
// Response
{
  "ok": true,
  "dataset_id": "abc123",
  "columns": ["name", "salary", "department"],
  "types": {"salary": "numeric", "department": "string"},
  "row_count": 500
}
```

### `POST /agent/ask`

Run a natural-language query.

```json
// Request
{
  "question": "Top 3 office locations by average salary",
  "dataset_id": "abc123"
}

// Response
{
  "ok": true,
  "answer": "AVG by office_location",
  "answer_type": "group_aggregate",
  "data": { "groups": [...] },
  "confidence": 0.9,
  "trace": [...],
  "extracted_constraints": [...],
  "plan": { "steps": [...] }
}
```

### `GET /api/stats?dataset_id=abc123`

Get metadata and sample rows for a dataset.

### `GET /api/datasets`

List all uploaded datasets.

---

## Schema Inference

Column types are automatically inferred on upload:

| Type | Rule |
|---|---|
| `boolean` | 100% of values are `true/false/yes/no/1/0` |
| `numeric` | >80% of values parse as a number |
| `date` | >80% of values match a known date format |
| `string` | Everything else |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, Uvicorn |
| LLM | OpenAI GPT-4o-mini |
| Frontend | React 18, Vite, TailwindCSS, Recharts |
| Data | In-memory (no database required) |
| Optional | Google Sheets API |

---

## Stress Test

A comprehensive 50-query stress test is included:

```bash
uv run python final_50_stress_test.py
```

Covers all query categories with a deterministic 500-row synthetic dataset. Expected pass rate: **50/50 (100%)**.
