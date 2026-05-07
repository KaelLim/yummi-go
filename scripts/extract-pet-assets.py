"""Extract a clean single character from the Frog PSD with transparent background."""
from pathlib import Path
from psd_tools import PSDImage

ROOT = Path(r"C:\Users\User\Desktop\yummi go\Character")
OUT = Path(r"C:\Users\User\Desktop\yummi go\_assets")
OUT.mkdir(exist_ok=True)


def find_group(psd, *path):
    """Walk into nested groups by name."""
    cur = psd
    for name in path:
        for child in cur:
            if child.name == name:
                cur = child
                break
        else:
            print(f"  ! not found: {name}")
            return None
    return cur


def render_group(group, name, max_dim=600):
    img = group.composite()
    if img is None:
        print(f"  ! could not composite {name}")
        return
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    scale = min(max_dim / w, max_dim / h, 1.0)
    if scale < 1.0:
        img = img.resize((int(w * scale), int(h * scale)))
    out = OUT / f"{name}.png"
    img.save(out, "PNG")
    print(f"  saved {out} ({img.size[0]}x{img.size[1]})")


# Frog — take the 'Full-Red > Front' group (the polished hero illustration)
print("=== frog ===")
psd = PSDImage.open(ROOT / "frog-2.psd")
g = find_group(psd, "Full-Red", "Front")
if g:
    render_group(g, "pet-frog-front")
g = find_group(psd, "Full-Red", "side")
if g:
    render_group(g, "pet-frog-side")

# Koala — take 'koala full' group (top-left clean illustration)
print("=== koala ===")
psd = PSDImage.open(ROOT / "koala-1.psd")
g = find_group(psd, "koala full")
if g:
    render_group(g, "pet-koala")

# Elephant — take 'full-elepant' (note typo in original) — final clean version
print("=== elephant ===")
psd = PSDImage.open(ROOT / "elephant-1.psd")
g = find_group(psd, "full-elepant")
if g:
    render_group(g, "pet-elephant")

print("\nDone.")
