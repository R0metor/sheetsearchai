# SheetSearch AI

Natural language → deterministic spreadsheet queries.

Upload a CSV/XLSX file and ask questions like:

*"Top 3 office locations by total salary among non-remote employees hired after 2017"*

<p align="center">
  <img src="docs/sheetsearchaidemovideogif.gif" width="100%" alt="App Demo">
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

## Landing Page

<p align="center">
  <img src="docs/landing-v2.png" width="900">
</p>

## Chat Page

<p align="center">
  <img src="docs/chat-v2.png" width="900">
</p>

## Analytics Page

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

- FastAPI ![FastAPI](https://img.shields.io/badge/fastapi-109989?style=flat-square&logo=FASTAPI&logoColor=white)
- React & Vite ![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat-square&logo=react&logoColor=%2361DAFB) ![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=flat-square&logo=vite&logoColor=white)
- Tailwind CSS ![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)
- Recharts ![Recharts](https://img.shields.io/badge/recharts-%2322B5BF.svg?style=flat-square&logo=react&logoColor=white)
- OpenAI GPT-4o-mini ![OpenAI](https://img.shields.io/badge/chatGPT-74aa9c?style=flat-square&logo=openai&logoColor=white)
- Openpyxl ![Python](https://img.shields.io/badge/python-3670A0?style=flat-square&logo=python&logoColor=ffdd54)