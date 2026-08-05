"""Prepare browser-ready cinematic assets from the supplied source artwork.

This script only reads from ALL ART ASSETS and writes generated runtime files
under public/assets. It never modifies or deletes supplied source artwork.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "ALL ART ASSETS"
FRIEND_DIR = ROOT / "public" / "assets" / "friend"
CAFE_DIR = ROOT / "public" / "assets" / "cafe"

PORTRAITS = {
    "blink.png": "blink.webp",
    "connected-closed.png": "connected-closed.webp",
    "Connected-open.png": "connected-open.webp",
    "defensive-closed.png": "defensive-closed.webp",
    "Defensive-open.png": "defensive-open.webp",
    "MasterCopy.png": "distant-closed.webp",
    "Distant_open.png": "distant-open.webp",
    "hurt_exposed-closed.png": "hurt_exposed-closed.webp",
    "Hurt-exposed-open(1).png": "hurt_exposed-open.webp",
}


def save_webp(image: Image.Image, destination: Path, quality: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=quality, method=4, exact=True)


def prepare_portraits() -> list[Path]:
    outputs: list[Path] = []
    for source_name, output_name in PORTRAITS.items():
        source = SOURCE_DIR / source_name
        if not source.exists():
            raise FileNotFoundError(f"Missing portrait source: {source}")

        with Image.open(source) as image:
            reduced = image.reduce(4).convert("RGBA")
            portrait = reduced.resize((800, 1200), Image.Resampling.LANCZOS)
            alpha = portrait.getchannel("A")
            if alpha.getextrema()[0] != 0:
                raise ValueError(f"Portrait has no transparent pixels: {source.name}")
            destination = FRIEND_DIR / output_name
            save_webp(portrait, destination, quality=86)
            outputs.append(destination)
    return outputs


def prepare_cafe() -> Path:
    source = SOURCE_DIR / "Cafe.jpg"
    if not source.exists():
        raise FileNotFoundError(f"Missing cafe source: {source}")

    with Image.open(source) as image:
        background = ImageOps.fit(
            image.convert("RGB"),
            (1920, 1080),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.35),
        )
        destination = CAFE_DIR / "cafe-window-afternoon.webp"
        save_webp(background, destination, quality=82)
        return destination


def validate(outputs: list[Path]) -> None:
    expected = {
        "blink.webp",
        "connected-closed.webp",
        "connected-open.webp",
        "defensive-closed.webp",
        "defensive-open.webp",
        "distant-closed.webp",
        "distant-open.webp",
        "hurt_exposed-closed.webp",
        "hurt_exposed-open.webp",
        "cafe-window-afternoon.webp",
    }
    if {output.name for output in outputs} != expected:
        raise ValueError("Generated asset names do not match the cinematic contract")

    for output in outputs:
        with Image.open(output) as image:
            expected_size = (1920, 1080) if output.name.startswith("cafe-") else (800, 1200)
            if image.size != expected_size:
                raise ValueError(f"Unexpected size for {output.name}: {image.size}")
            if not output.name.startswith("cafe-"):
                if image.mode != "RGBA" or image.getchannel("A").getextrema()[0] != 0:
                    raise ValueError(f"Transparency was not preserved for {output.name}")


def main() -> None:
    portrait_outputs = prepare_portraits()
    cafe_output = prepare_cafe()
    outputs = [*portrait_outputs, cafe_output]
    validate(outputs)
    for output in outputs:
        print(f"{output.relative_to(ROOT)} ({output.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
