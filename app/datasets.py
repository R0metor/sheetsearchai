"""
In-memory dataset storage + automatic schema inference.

No database. No embeddings. Just dicts.
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

# ── In-memory store ──

DATASETS: Dict[str, Dict[str, Any]] = {}

# ── Date formats for inference ──

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
    "%d/%m/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M:%S",
]


def _is_numeric(value: str) -> bool:
    try:
        float(value.strip().replace(",", "."))
        return True
    except (ValueError, AttributeError):
        return False


def _is_date(value: str) -> bool:
    s = value.strip()
    if not s:
        return False
    for fmt in _DATE_FORMATS:
        try:
            datetime.strptime(s, fmt)
            return True
        except ValueError:
            continue
    return False


def _is_boolean(value: str) -> bool:
    return value.strip().lower() in ("true", "false", "yes", "no", "1", "0")


def infer_types(rows: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    Infer column types from row data.
    Rules:
      - If >80% of non-empty values parse as float → numeric
      - If >80% of non-empty values parse as date → date
      - If 100% of non-empty values are true/false/yes/no → boolean
      - Else → string
    """
    if not rows:
        return {}

    columns = list(rows[0].keys())
    types: Dict[str, str] = {}

    for col in columns:
        values = [str(r.get(col, "")).strip() for r in rows if str(r.get(col, "")).strip()]
        total = len(values)

        if total == 0:
            types[col] = "string"
            continue

        # Boolean check (must be 100%)
        bool_count = sum(1 for v in values if _is_boolean(v))
        if bool_count == total:
            types[col] = "boolean"
            continue

        # Numeric check (>80%)
        num_count = sum(1 for v in values if _is_numeric(v))
        if num_count / total > 0.8:
            types[col] = "numeric"
            continue

        # Date check (>80%)
        date_count = sum(1 for v in values if _is_date(v))
        if date_count / total > 0.8:
            types[col] = "date"
            continue

        types[col] = "string"

    return types


def store_dataset(
    rows: List[Dict[str, Any]],
    filename: str,
) -> str:
    """Store a parsed dataset, infer types, return dataset_id."""
    dataset_id = uuid.uuid4().hex[:12]
    columns = list(rows[0].keys()) if rows else []
    types = infer_types(rows)

    DATASETS[dataset_id] = {
        "rows": rows,
        "columns": columns,
        "types": types,
        "filename": filename,
        "row_count": len(rows),
    }

    return dataset_id


def get_dataset(dataset_id: str) -> Dict[str, Any]:
    """Retrieve a dataset by ID. Raises KeyError if not found."""
    if dataset_id not in DATASETS:
        raise KeyError(f"Dataset '{dataset_id}' not found. Upload a file first.")
    return DATASETS[dataset_id]


def list_datasets() -> List[Dict[str, Any]]:
    """Return metadata for all stored datasets."""
    return [
        {
            "dataset_id": did,
            "filename": ds["filename"],
            "columns": ds["columns"],
            "types": ds["types"],
            "row_count": ds["row_count"],
        }
        for did, ds in DATASETS.items()
    ]
