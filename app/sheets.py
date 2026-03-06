from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from datetime import datetime
from app.config import settings


SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

# Common date formats Google Sheets might export
_DATE_FORMATS = [
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d-%m-%Y",
    "%m-%d-%Y",
    "%Y/%m/%d",
    "%d.%m.%Y",
    "%m.%d.%Y",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M:%S",
]

def _normalize_date(value: str) -> str:
    """Try to parse a date string and return ISO format (YYYY-MM-DD).
    Falls back to the stripped original string if no format matches."""
    s = value.strip()
    if not s:
        return s
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return s

def get_sheet_data(spreadsheet_id: str, range_name: str):
    creds = Credentials.from_service_account_file(
        settings.GOOGLE_SERVICE_ACCOUNT_FILE,
        scopes=SCOPES,
    )

    service = build("sheets", "v4", credentials=creds)
    sheet = service.spreadsheets()

    result = sheet.values().get(
        spreadsheetId=spreadsheet_id,
        range=range_name,
    ).execute()

    return result.get("values", [])

def sheet_to_objects(values: list[list[str]]):
    if not values or len(values) < 2:
        return []

    headers = values[0]
    rows = values[1:]

    out = []
    for r in rows:
        obj = {}
        for i, h in enumerate(headers):
            raw = r[i].strip() if i < len(r) else None
            if raw and h.lower() in ("created_at", "date", "updated_at"):
                raw = _normalize_date(raw)
            obj[h] = raw
        out.append(obj)

    return out

