"""Convert PSD files to PNG previews and dump their layer trees."""
from pathlib import Path
from psd_tools import PSDImage

ROOT = Path(r"C:\Users\User\Desktop\yummi go\Character")
OUT = Path(r"C:\Users\User\Desktop\yummi go\_previews")
OUT.mkdir(exist_ok=True)

MAX_DIM = 1200


def list_layers(layer, depth=0, lines=None):
    if lines is None:
        lines = []
    indent = "  " * depth
    kind = "GROUP" if layer.is_group() else "LAYER"
    visible = "v" if layer.visible else "h"
    bbox = layer.bbox if hasattr(layer, "bbox") else None
    lines.append(f"{indent}{kind}[{visible}] {layer.name!r} bbox={bbox}")
    if layer.is_group():
        for child in layer:
            list_layers(child, depth + 1, lines)
    return lines


def downscale(img, max_dim=MAX_DIM):
    w, h = img.size
    scale = min(max_dim / w, max_dim / h, 1.0)
    if scale < 1.0:
        img = img.resize((int(w * scale), int(h * scale)))
    return img


for psd_path in sorted(ROOT.glob("*.psd")):
    print(f"\n=== {psd_path.name} ===")
    psd = PSDImage.open(psd_path)
    print(f"size: {psd.width}x{psd.height}, mode: {psd.color_mode}, layers: {len(list(psd))}")
    composite = psd.composite()
    if composite.mode != "RGBA":
        composite = composite.convert("RGBA")
    composite = downscale(composite)
    out_png = OUT / f"{psd_path.stem}.png"
    composite.save(out_png, "PNG")
    print(f"saved -> {out_png} ({composite.size[0]}x{composite.size[1]})")
    layer_lines = []
    for top in psd:
        list_layers(top, 0, layer_lines)
    layer_txt = OUT / f"{psd_path.stem}_layers.txt"
    layer_txt.write_text("\n".join(layer_lines), encoding="utf-8")
    print(f"layers -> {layer_txt} ({len(layer_lines)} entries)")

print("\nDone.")
