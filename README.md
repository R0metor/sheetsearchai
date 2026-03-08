# SheetSearch AI

Natural language → deterministic spreadsheet queries.

Upload a CSV/XLSX file and ask questions like:

*"Top 3 office locations by total salary among non-remote employees hired after 2017"*

<p align="center">
  <img src="docs/sheetsearchaidemovideogif.gif" width="900">
</p>

---

## How It Works

<p align="center">
  <img src="docs/pipeline-v2.png" width="600">
</p>

<p align="center">
  <img src="docs/query_transform-v2.png" width="600">
</p>

---

## Demo

<p align="center">
  <img src="docs/landing-v2.png" width="900">
</p>

<p align="center">
  <img src="docs/chat-v2.png" width="900">
</p>

<p align="center">
  <img src="docs/analytics-v2.png" width="900">
</p>

---

## Example Query

Top 3 office locations by total salary among non-remote employees hired after 2017

Execution Plan:
```
filter(remote=false)
filter(hire_date > 2017)
group_aggregate(office_location, sum(salary))
sort(desc)
limit(3)
```

---

## Tech

- FastAPI
- React & Vite
- Tailwind CSS
- Recharts
- OpenAI GPT-4o-mini
- Openpyxl