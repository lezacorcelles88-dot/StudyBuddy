import re
from pypdf import PdfReader
import docx

def extract_text_from_pdf(file_stream_or_path):
    """
    Extracts and cleans text from an uploaded PDF reviewer.
    """
    try:
        reader = PdfReader(file_stream_or_path)
        extracted_pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                extracted_pages.append(text)
        
        full_text = "\n\n".join(extracted_pages)
        return clean_extracted_text(full_text)
    except Exception as e:
        raise RuntimeError(f"Failed to extract text from PDF: {str(e)}")

def extract_text_from_docx(file_stream_or_path):
    """
    Extracts text from uploaded Microsoft Word documents (.docx).
    """
    try:
        doc = docx.Document(file_stream_or_path)
        paragraphs = []
        for p in doc.paragraphs:
            txt = p.text.strip()
            if txt:
                paragraphs.append(txt)
        # Also extract from tables if any
        for table in doc.tables:
            for row in table.rows:
                row_txt = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_txt:
                    paragraphs.append(row_txt)

        full_text = "\n\n".join(paragraphs)
        return clean_extracted_text(full_text)
    except Exception as e:
        raise RuntimeError(f"Failed to extract text from Word document: {str(e)}")

def extract_text_from_image(file_stream, ext):
    """
    Extracts text from scanned lecture notes or handwritten reviewer images using Gemini Vision OCR.
    """
    import os
    import base64
    import requests
    from models import SystemSetting

    api_key = SystemSetting.get_value('gemini_api_key') or os.environ.get('GEMINI_API_KEY')
    if not api_key:
        raise ValueError(
            "Image OCR requires a configured Gemini API key to recognize handwritten notes and scanned images. "
            "Please configure your Gemini key in Voice Reader Settings, or upload a PDF/DOCX/TXT file."
        )

    content = file_stream.read() if hasattr(file_stream, 'read') else open(file_stream, 'rb').read()
    b64_img = base64.b64encode(content).decode('utf-8')
    mime = 'image/jpeg' if ext in ['jpg', 'jpeg'] else f'image/{ext}'

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    prompt = (
        "You are an expert OCR transcription engine for academic reviewers and handwritten student notes. "
        "Extract all readable text, titles, headings, bullet points, definitions, terms, formulas, and paragraphs verbatim. "
        "Do not invent or assume unclear words. Return only the extracted text."
    )
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": mime, "data": b64_img}}
            ]
        }],
        "generationConfig": {"temperature": 0.05}
    }
    resp = requests.post(url, json=payload, timeout=35)
    if resp.status_code == 200:
        data = resp.json()
        raw_text = data['candidates'][0]['content']['parts'][0]['text']
        return clean_extracted_text(raw_text)
    else:
        raise RuntimeError(f"OCR failed (Gemini status {resp.status_code}): {resp.text}")

def extract_document_text(file_stream, filename):
    """
    Universal document extractor for PDF, DOCX, TXT, and scanned image notes.
    """
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext == 'pdf':
        return extract_text_from_pdf(file_stream)
    elif ext in ['docx', 'doc']:
        return extract_text_from_docx(file_stream)
    elif ext in ['txt', 'md']:
        content = file_stream.read()
        if isinstance(content, bytes):
            content = content.decode('utf-8', errors='ignore')
        return clean_extracted_text(content)
    elif ext in ['png', 'jpg', 'jpeg', 'webp']:
        return extract_text_from_image(file_stream, ext)
    else:
        raise ValueError(f"Unsupported file format: .{ext}. Please upload a PDF, DOCX, TXT, or Image (PNG/JPG/WEBP).")

def clean_extracted_text(text):
    """
    Cleans raw text by removing excessive whitespaces and fixing broken line breaks.
    """
    if not text:
        return ""
    # Normalize line breaks
    text = re.sub(r'\r\n|\r', '\n', text)
    # Remove repeated spaces
    text = re.sub(r'[ \t]+', ' ', text)
    # Remove repeated blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()
