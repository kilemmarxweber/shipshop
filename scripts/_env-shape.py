from pathlib import Path


def parse(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip().strip("\"'")
    return data


def shape(value: str) -> str:
    if not value:
        return "empty"
    lower = value.lower()
    if "localhost" in lower or "127.0.0.1" in lower:
        return "localhost"
    if value.startswith("https://"):
        host = value.split("/")[2]
        return f"https:{host}"
    if value.startswith("http://"):
        host = value.split("/")[2]
        return f"http:{host}"
    if len(value) >= 2 and value[1] == ":":
        return "winpath"
    if value.startswith("/"):
        return "unixpath"
    if value.startswith("postgresql://"):
        rest = value.split("@", 1)[-1]
        return f"postgres:{rest.split('/')[0]}"
    if any(token in lower for token in ("sk_live", "sk_test")):
        return "cinetpay-key"
    if len(value) > 24:
        return f"long:{len(value)}"
    return value[:48]


root = parse(Path(r"C:\Users\kilemmarxweber\Desktop\shop\.env"))
pub = parse(Path(r"C:\Users\kilemmarxweber\Desktop\shop\public\.env"))
for key in sorted(set(root) | set(pub)):
    a = root.get(key)
    b = pub.get(key)
    if a is None:
        print(f"{key}: ROOT=MISSING PUB={shape(b or '')}")
    elif b is None:
        print(f"{key}: ROOT={shape(a)} PUB=MISSING")
    elif a == b:
        print(f"{key}: SAME {shape(a)}")
    else:
        print(f"{key}: DIFF root={shape(a)} pub={shape(b)}")
