"""OCRs a scanned PDF to text, one page at a time.

The Current Affairs PDFs for 2020 and 2024 December carry their questions as
images, so nothing can be extracted from them directly. Rendered at 200dpi and
passed through Tesseract, they read cleanly.
"""
import subprocess, sys, pymupdf

TESS = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def ocr(path, out_path):
    doc = pymupdf.open(path)
    parts = []
    for n, page in enumerate(doc, 1):
        pix = page.get_pixmap(dpi=350)
        r = subprocess.run([TESS, "-", "-", "--psm", "6"],
                           input=pix.tobytes("png"), capture_output=True)
        parts.append(r.stdout.decode("utf-8", "replace"))
        print(f"  page {n}/{doc.page_count}", end="\r", flush=True)
    text = "\n".join(parts)
    open(out_path, "w", encoding="utf-8").write(text)
    print(f"\n  -> {out_path}  {len(text)} chars")

if __name__ == "__main__":
    ocr(sys.argv[1], sys.argv[2])
