import csv
import requests
import json
import random
import time
import sys

API = "http://localhost:8001"

# ── Generate Dataset ──
DEPARTMENTS = ["Engineering", "Marketing", "Sales", "HR", "Finance", "Operations", "Legal", "Product"]
LOCATIONS = ["New York", "San Francisco", "Chicago", "Austin", "Seattle", "Berlin", "London", "Tokyo"]
EMPLOYMENT_TYPES = ["Full-Time", "Part-Time", "Contract"]

random.seed(42)

rows = []
for i in range(500):
    dept = random.choice(DEPARTMENTS)
    year = random.randint(2010, 2024)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    salary = random.randint(45000, 200000)
    rows.append({
        "id": i + 1,
        "name": f"Employee_{i+1:04d}",
        "department": dept,
        "salary": salary,
        "hire_date": f"{year}-{month:02d}-{day:02d}",
        "is_remote": random.choice([True, False]),
        "office_location": random.choice(LOCATIONS),
        "employment_type": random.choice(EMPLOYMENT_TYPES),
        "performance_score": round(random.uniform(1.0, 5.0), 1),
        "bonus_pct": round(random.uniform(0, 30), 1),
        "projects": random.randint(1, 20),
        "sick_days_taken": random.randint(0, 15),
    })

csv_path = "final_50_stress_test_data.csv"
with open(csv_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

# ── Upload Dataset ──
with open(csv_path, "rb") as f:
    r = requests.post(f"{API}/upload", files={"file": (csv_path, f, "text/csv")})
upload = r.json()
did = upload["dataset_id"]

# ── Queries ──
QUERIES = [
    ("Basic Filters", "Employees with salary above 120000"),
    ("Basic Filters", "Employees with salary below 60000"),
    ("Basic Filters", "Employees with bonus_pct above 20"),
    ("Basic Filters", "Employees with bonus_pct below 5"),
    ("Basic Filters", "Employees with performance_score above 4"),
    ("Basic Filters", "Employees with more than 10 projects"),
    ("Basic Filters", "Employees with more than 15 sick_days_taken"),
    ("Basic Filters", "Employees in the Engineering department"),
    ("Basic Filters", "Employees in Sales with salary above 90000"),
    ("Basic Filters", "Employees with performance_score below 2"),
    ("Boolean Filters", "Count remote employees"),
    ("Boolean Filters", "Average salary of remote employees"),
    ("Boolean Filters", "Highest salary among non-remote employees"),
    ("Boolean Filters", "Non-remote employees in the Marketing department"),
    ("Boolean Filters", "Remote employees with performance_score above 3"),
    ("Date Filters", "Employees hired after 2020"),
    ("Date Filters", "Employees hired before 2015"),
    ("Date Filters", "Count employees hired between 2016 and 2020"),
    ("Date Filters", "Average salary of employees hired after 2018"),
    ("Date Filters", "Employees hired after 2022 with bonus_pct above 10"),
    ("Sorting + Limits", "Top 10 highest paid employees"),
    ("Sorting + Limits", "Top 5 employees by performance_score"),
    ("Sorting + Limits", "Lowest 10 salaries in the company"),
    ("Sorting + Limits", "Top 7 employees by bonus_pct"),
    ("Sorting + Limits", "Top 5 employees by project_count"),
    ("Group Aggregations", "Average salary by department"),
    ("Group Aggregations", "Count employees per department"),
    ("Group Aggregations", "Average performance_score by office_location"),
    ("Group Aggregations", "Total salary by office_location"),
    ("Group Aggregations", "Average bonus_pct by employment_type"),
    ("HAVING-style Queries", "Departments with average salary above 110000"),
    ("HAVING-style Queries", "Departments with more than 40 employees"),
    ("HAVING-style Queries", "Office locations with average performance_score above 3"),
    ("HAVING-style Queries", "Departments with average bonus_pct above 15"),
    ("HAVING-style Queries", "Office locations with more than 200 employees"),
    ("Multi-Step Queries", "Top 5 highest paid remote employees"),
    ("Multi-Step Queries", "Top 5 employees by project_count with salary above 100000"),
    ("Multi-Step Queries", "Remote employees hired after 2020 with bonus_pct above 10"),
    ("Multi-Step Queries", "Engineering employees with performance_score above 4 sorted by salary"),
    ("Multi-Step Queries", "Marketing employees sorted by performance_score descending"),
    ("Multi-Step Queries", "Top 3 departments by total salary"),
    ("Multi-Step Queries", "Top 3 office locations by average salary"),
    ("Multi-Step Queries", "Lowest salary in each department"),
    ("Multi-Step Queries", "Highest performance_score in each department"),
    ("Multi-Step Queries", "Average salary of remote employees by department"),
    ("Edge Cases", "Employees with salary below 0"),
    ("Edge Cases", "Employees with performance_score above 10"),
    ("Edge Cases", "Employees hired after 2030"),
    ("Edge Cases", "Employees where department equals Unknown"),
    ("Edge Cases", "Count employees with bonus_pct above 100"),
]

# ── Execute Queries ──
results = []
for i, (cat, q) in enumerate(QUERIES):
    sys.stdout.write(f"\rProcess {i+1}/{len(QUERIES)}: {q[:40]}...")
    sys.stdout.flush()
    try:
        r = requests.post(f"{API}/agent/ask", json={"question": q, "dataset_id": did}, timeout=60)
        d = r.json()
        results.append((cat, q, d.get("ok", False), d.get("answer", "")))
    except Exception as e:
        results.append((cat, q, False, f"CRASH: {e}"))

print("\n\nFINAL 50-QUERY STRESS TEST RESULTS\n" + "="*40)
for i, (cat, q, ok, ans) in enumerate(results):
    status = "PASS" if ok else "FAIL"
    print(f"{i+1:02d}. [{status}] {q}")

with open("final_50_stress_test_results.txt", "w") as f:
    f.write("FINAL 50-QUERY STRESS TEST RESULTS\n" + "="*40 + "\n")
    for i, (cat, q, ok, ans) in enumerate(results):
        status = "PASS" if ok else "FAIL"
        f.write(f"{i+1:02d}. [{status}] {q}\n")
