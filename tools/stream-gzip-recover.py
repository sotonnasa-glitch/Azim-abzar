import base64, io, re, zlib, json
from pathlib import Path
text = Path('/tmp/azim-catalog-data.js').read_text(encoding='utf-8')
m = re.search(r"const b='([^']+)'", text)
assert m
payload = base64.b64decode(m.group(1), validate=True)
d = zlib.decompressobj(16 + zlib.MAX_WBITS)
raw = d.decompress(payload) + d.flush()
print('RAW_BYTES:', len(raw))
products = json.loads(raw)
print('PRODUCTS:', len(products))
