import base64, gzip, json, re
from pathlib import Path
text = Path('/tmp/azim-catalog-data.js').read_text(encoding='utf-8')
m = re.search(r"const b='([^']+)'", text)
assert m, 'compressed catalog payload not found'
payload = base64.b64decode(m.group(1), validate=True)
print('PAYLOAD_BYTES:', len(payload))
try:
    raw = gzip.decompress(payload)
except EOFError:
    # Try a repairable truncated stream only for diagnostics; do not silently accept it.
    raw = gzip.GzipFile(fileobj=__import__('io').BytesIO(payload)).read()
products = json.loads(raw)
print('PRODUCTS:', len(products))
