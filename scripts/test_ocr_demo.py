"""Generate an explicitly synthetic label and exercise the real HTTP OCR endpoint.

Run after scripts/run-ocr-demo.sh. This is integration evidence, not a benchmark
on real bottle photography. The image is deliberately labelled as a demo.
"""

import json
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
output = root / ".local" / "ocr-demo"
output.mkdir(parents=True, exist_ok=True)
image = Image.new("RGB", (1000, 1100), "#fffdf4")
draw = ImageDraw.Draw(image)
font_path = Path("/System/Library/Fonts/Supplemental/Arial.ttf")


def font(size):
    return ImageFont.truetype(str(font_path), size) if font_path.is_file() else ImageFont.load_default(size=size)


draw.rounded_rectangle((50, 50, 950, 1050), radius=30, outline="#23433a", width=8)
for text, y, size in [
    ("SIPAWARE DEMO", 170, 78),
    ("PALE ALE", 330, 72),
    ("375 mL", 580, 66),
    ("4.5% ALC/VOL", 740, 62),
    ("SAMPLE - NOT FOR SALE", 945, 25),
]:
    draw.text((500, y), text, fill="#162c24", font=font(size), anchor="mt")
path = output / "sample-label.png"
image.save(path)
print(f"Synthetic demo image: {path}", flush=True)
with httpx.Client(timeout=180) as client:
    response = client.post("http://127.0.0.1:8000/api/ocr/drink-label",
                           content=path.read_bytes(), headers={"Content-Type": "image/png"})
    print(response.status_code, response.text, flush=True)
    response.raise_for_status()
    result = response.json()
    assert result["fields"]["containerVolumeMl"] == 375, result
    assert result["fields"]["abvPercent"] == 4.5, result
    assert result["fields"]["drinkType"] == "beer", result
    assert "PALE ALE" in (result["fields"]["drinkName"] or ""), result
    (output / "last-result.json").write_text(json.dumps(result, indent=2) + "\n")
print("PASS: real CPU model -> HTTP endpoint -> parsed fields", flush=True)
