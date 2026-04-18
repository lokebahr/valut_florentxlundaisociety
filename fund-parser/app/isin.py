"""Fast ISIN extraction — no Claude needed for cache lookups."""
import re

# ISIN: 2 uppercase letters + 10 alphanumeric chars (12 total)
_ISIN_RE = re.compile(r'(?<![A-Z0-9])([A-Z]{2}[A-Z0-9]{10})(?![A-Z0-9])')


def extract_isin(filename: str) -> str | None:
    """Extract ISIN from filename. Compressed PDFs hide text, so filename is the only fast path."""
    return _m.group(1) if (_m := _ISIN_RE.search(filename.upper())) else None
