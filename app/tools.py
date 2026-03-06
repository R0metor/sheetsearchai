"""
Deterministic execution tools for the structured query engine.
Supports: filter, sort, aggregate, group_aggregate.
Type-aware: numeric, string, date, boolean.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime
import re


# ── Parsing helpers ──

def _to_float(x):
    if x is None:
        return None
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).strip()
    if not s:
        return None
    s = s.replace("€", "").replace(",", ".")
    s = re.sub(r"[^\d.\-]", "", s)
    try:
        return float(s)
    except:
        return None


def safe_float(value):
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        value = value.strip().replace(",", ".")
        if value == "":
            return 0.0
        try:
            return float(value)
        except ValueError:
            return 0.0
    return 0.0


_DATE_FORMATS = [
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d-%m-%Y",
    "%m-%d-%Y",
    "%Y/%m/%d",
    "%d.%m.%Y",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
]


def _parse_date(value) -> Optional[datetime]:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None

    # Support year-only strings like "2020" -> "2020-01-01"
    if len(s) == 4 and s.isdigit():
        try:
            return datetime(int(s), 1, 1)
        except:
            return None

    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _to_bool(value) -> Optional[bool]:
    if value is None:
        return None
    s = str(value).strip().lower()
    if s in ("true", "yes", "1"):
        return True
    if s in ("false", "no", "0"):
        return False
    return None


# ── Filter (type-aware) ──

def filter_rows(
    rows: List[Dict[str, Any]],
    *,
    equals: Optional[Dict[str, Any]] = None,
    contains: Optional[Dict[str, str]] = None,
    min_value: Optional[Dict[str, float]] = None,  # >=
    max_value: Optional[Dict[str, float]] = None,  # <=
    gt: Optional[Dict[str, float]] = None,         # >
    lt: Optional[Dict[str, float]] = None,         # <
    before: Optional[Dict[str, str]] = None,       # < date
    after: Optional[Dict[str, str]] = None,        # > date
    types: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    equals = equals if isinstance(equals, dict) else {}
    contains = contains if isinstance(contains, dict) else {}
    min_value = min_value if isinstance(min_value, dict) else {}
    max_value = max_value if isinstance(max_value, dict) else {}
    gt = gt if isinstance(gt, dict) else {}
    lt = lt if isinstance(lt, dict) else {}
    before = before if isinstance(before, dict) else {}
    after = after if isinstance(after, dict) else {}
    types = types or {}

    out = []
    for row in rows:
        ok = True

        # exact match (works for string, numeric, boolean)
        for k, v in equals.items():
            col_type = types.get(k, "string")

            if col_type == "boolean":
                row_val = _to_bool(row.get(k))
                target = _to_bool(v)
                if row_val is None or row_val != target:
                    ok = False
                    break
            else:
                if str(row.get(k, "")).strip().lower() != str(v).strip().lower():
                    ok = False
                    break
        if not ok:
            continue

        # substring match (string columns)
        for k, v in contains.items():
            if str(v).strip().lower() not in str(row.get(k, "")).strip().lower():
                ok = False
                break
        if not ok:
            continue

        # numeric constraints
        for k, v in min_value.items():
            row_val = row.get(k)
            # Support both numeric and date comparison
            rd = _parse_date(row_val)
            vd = _parse_date(v)
            if rd and vd:
                if rd < vd: ok = False; break
            else:
                x = _to_float(row_val)
                if x is None or x < float(v):
                    ok = False; break
        if not ok:
            continue

        for k, v in max_value.items():
            row_val = row.get(k)
            rd = _parse_date(row_val)
            vd = _parse_date(v)
            if rd and vd:
                if rd > vd: ok = False; break
            else:
                x = _to_float(row_val)
                if x is None or x > float(v):
                    ok = False; break
        if not ok:
            continue

        for k, v in gt.items():
            x = _to_float(row.get(k))
            if x is None or x <= float(v):
                ok = False
                break
        if not ok:
            continue

        for k, v in lt.items():
            x = _to_float(row.get(k))
            if x is None or x >= float(v):
                ok = False
                break
        if not ok:
            continue

        # date constraints
        for k, v in before.items():
            row_date = _parse_date(row.get(k))
            target_date = _parse_date(v)
            if row_date is None or target_date is None or row_date >= target_date:
                ok = False
                break
        if not ok:
            continue

        for k, v in after.items():
            row_date = _parse_date(row.get(k))
            target_date = _parse_date(v)
            if row_date is None or target_date is None or row_date <= target_date:
                ok = False
                break
        if not ok:
            continue

        out.append(row)

    return out


# ── Sort ──

def sort_rows(rows: List[Dict[str, Any]], *, by: str, direction: str = "desc") -> List[Dict[str, Any]]:
    direction = (direction or "desc").lower()

    def safe_val(r):
        v = _to_float(r.get(by))
        return v if v is not None else float("-inf")

    # We must copy rows to avoid mutating the original
    result = list(rows)

    try:
        # Try full numeric sort first
        # Verify all elements can be compared via safe_val (this always works due to safe_val definition)
        if direction == "desc":
            result.sort(key=lambda r: (-safe_val(r), r.get("_row_index", 0)))
        else:
            result.sort(key=lambda r: (safe_val(r), r.get("_row_index", 0)))
        return result
    except TypeError:
        # Fallback for strings
        result.sort(key=lambda r: r.get("_row_index", 0))
        result.sort(key=lambda r: str(r.get(by, "")), reverse=(direction == "desc"))
        return result


# ── Aggregate ──

def aggregate(rows: List[Dict[str, Any]], *, op: str, column: str) -> Dict[str, Any]:
    op = op.lower()
    if op in ["average", "mean"]:
        op = "avg"
    if op in ["total"]:
        op = "sum"
    if op in ["number", "count"]:
        op = "count"

    # Count works on any column type — no numeric parsing needed
    if op == "count":
        return {"op": op, "column": column, "value": len(rows), "count": len(rows)}

    # For sum/avg/min/max, parse numerics
    nums = [_to_float(r.get(column)) for r in rows]
    nums = [n for n in nums if n is not None]
    if not nums:
        return {"op": op, "column": column, "value": None, "count": 0}

    if op == "sum":
        return {"op": op, "column": column, "value": round(sum(nums), 4), "count": len(nums)}
    if op == "avg":
        return {"op": op, "column": column, "value": round(sum(nums) / len(nums), 4), "count": len(nums)}
    if op == "min":
        return {"op": op, "column": column, "value": min(nums), "count": len(nums)}
    if op == "max":
        return {"op": op, "column": column, "value": max(nums), "count": len(nums)}

    return {"op": op, "column": column, "value": None, "count": len(nums)}
