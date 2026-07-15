"""Document processing service.

Validates, extracts, and cleans text from uploaded files.

Supported types: PDF, DOCX, TXT, CSV, Markdown
"""

import csv
import io
import re

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "csv", "md", "markdown"}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


class DocumentProcessingError(Exception):
    """Raised for known, user-visible document problems."""


def validate_file(file_name: str, file_size: int, content_type: str | None = None) -> str:
    """Validate file name and size. Returns the lower-cased extension."""
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise DocumentProcessingError(
            f"Unsupported file type '.{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
        )
    if file_size > MAX_FILE_SIZE_BYTES:
        raise DocumentProcessingError(
            f"File is too large ({file_size // (1024 * 1024)} MB). Maximum is 20 MB."
        )
    return ext


def _clean_text(text: str) -> str:
    """Remove excess whitespace while preserving paragraph structure."""
    # Collapse runs of spaces / tabs within lines
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    # Remove runs of blank lines (keep at most one)
    cleaned_lines: list[str] = []
    prev_blank = False
    for line in lines:
        is_blank = line == ""
        if is_blank and prev_blank:
            continue
        cleaned_lines.append(line)
        prev_blank = is_blank
    return "\n".join(cleaned_lines).strip()


def extract_text(raw_bytes: bytes, extension: str) -> str:
    """Extract text from raw file bytes based on extension."""
    try:
        if extension == "pdf":
            return _extract_pdf(raw_bytes)
        elif extension == "docx":
            return _extract_docx(raw_bytes)
        elif extension in ("txt", "md", "markdown"):
            return _extract_plain(raw_bytes)
        elif extension == "csv":
            return _extract_csv(raw_bytes)
        else:
            raise DocumentProcessingError(f"Unsupported extension: {extension}")
    except DocumentProcessingError:
        raise
    except Exception as exc:
        raise DocumentProcessingError(
            f"Could not parse the document. It may be corrupted or password-protected. Details: {exc}"
        ) from exc


def _extract_pdf(raw: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(raw))
    if reader.is_encrypted:
        raise DocumentProcessingError("PDF is encrypted. Please upload an unprotected PDF.")
    parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        parts.append(text)
    combined = "\n".join(parts)
    if not combined.strip():
        raise DocumentProcessingError(
            "No text could be extracted from this PDF. It may be a scanned image."
        )
    return _clean_text(combined)


def _extract_docx(raw: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(raw))
    paragraphs = [p.text for p in doc.paragraphs]
    combined = "\n".join(paragraphs)
    if not combined.strip():
        raise DocumentProcessingError("The DOCX file appears to be empty.")
    return _clean_text(combined)


def _extract_plain(raw: bytes) -> str:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")
    if not text.strip():
        raise DocumentProcessingError("The file appears to be empty.")
    return _clean_text(text)


def _extract_csv(raw: bytes) -> str:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = [", ".join(row) for row in reader if any(cell.strip() for cell in row)]
    if not rows:
        raise DocumentProcessingError("The CSV file appears to be empty.")
    return _clean_text("\n".join(rows))


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks by word count."""
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end >= len(words):
            break
        start += chunk_size - overlap
    return chunks
