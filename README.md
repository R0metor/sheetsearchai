# SheetSearch AI

Natural language → deterministic spreadsheet queries.

Upload a CSV/XLSX file and ask questions like:

"Top 3 office locations by total salary among non-remote employees hired after 2017"

---

## Demo

![Landing](docs/landing.png)
![Chat](docs/chat.png)
![Analytics](docs/analytics.png)

---

## How It Works

<p align="center">
  <img src="docs/pipeline.png" width="48%" />
  <img src="docs/query_transform.png" width="48%" />
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
Pandas  
React  
Tailwind  
OpenAI GPT-4o-mini