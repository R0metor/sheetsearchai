# SheetSearch AI

<p align="center">
  <img src="docs/pipeline.png?v=1" width="45%">
  <img src="docs/query_transform.png?v=1" width="45%">
</p>

Natural language → deterministic spreadsheet queries.

Upload a CSV/XLSX file and ask questions like:

"Top 3 office locations by total salary among non-remote employees hired after 2017"

---

## Demo

<p align="center">
  <img src="docs/landing.png?v=1" width="900">
</p>

<p align="center">
  <img src="docs/chat.png?v=1" width="900">
</p>

<p align="center">
  <img src="docs/analytics.png?v=1" width="900">
</p>

---

## Example Query

Top 3 office locations by total salary among non-remote employees hired after 2017

Execution Plan:

filter(remote=false)  
filter(hire_date > 2017)  
group_aggregate(office_location, sum(salary))  
sort(desc)  
limit(3)

---

## Tech

FastAPI
React & Vite
Tailwind CSS
Recharts
OpenAI GPT-4o-mini
Openpyxl