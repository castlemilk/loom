"""Build a revision-locked, offline-reproducible pair of atlas transports."""
import argparse
from collections import Counter, defaultdict
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import tarfile
import tempfile
from urllib.parse import unquote
from urllib.request import urlopen

SOURCE = "https://snap.stanford.edu/data/wikispeedia/wikispeedia_paths-and-graph.tar.gz"
DIGEST = "97697096f5d2dcb77aa69e3992305c6c561de89edb9fb10b5ad9feaf8ba534d5"
OUT = Path(__file__).resolve().parents[1] / "web/public/examples/wikispeedia"
TOPICS = [
    ("Art", "Art", "#b46d52"), ("Music", "Music", "#8e6091"), ("Language_and_literature", "Language & literature", "#a25b75"), ("Religion", "Religion", "#946d37"),
    ("Design_and_Technology", "Design & technology", "#527a8d"), ("People", "People", "#ae593a"), ("History", "History", "#8a7456"), ("Citizenship", "Citizenship", "#657748"),
    ("Mathematics", "Mathematics", "#575f9b"), ("Science", "Science", "#377d72"), ("Geography", "Geography", "#527c9a"), ("Countries", "Countries", "#767246"),
    ("IT", "Computing", "#656f99"), ("Business_Studies", "Business", "#9c6d41"), ("Everyday_life", "Everyday life", "#608050"), ("Other", "Unclassified", "#75767c"),
]

def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()

def build(archive, out):
    if hashlib.sha256(archive).hexdigest() != DIGEST:
        raise ValueError("Source archive differs from the recorded Wikispeedia edition")
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        def rows(table):
            raw = bundle.extractfile("wikispeedia_paths-and-graph/" + table + ".tsv").read().decode()
            return [line.split("\t") for line in raw.splitlines() if line and not line.startswith("#")]
        titles, categories, links = rows("articles"), rows("categories"), rows("links")
    first = {}
    for title, category in categories:
        first.setdefault(title, category.split(".")[1])
    groups = defaultdict(list)
    for title, in titles:
        groups[first.get(title, "Other")].append(title)
    assert set(groups) == {key for key, _, _ in TOPICS}
    degree = Counter(v for edge in links for v in edge)
    topics, blocks, lookup = [], [], {}
    for i, (key, label, color) in enumerate(TOPICS):
        names = sorted(groups[key])
        start = len(lookup)
        articles = []
        for j, name in enumerate(names, start):
            lookup[name] = (j, i)
            articles.append([j, unquote(name).replace("_", " "), degree[name]])
        topics.append(dict(id=i, label=label, color=color, first=start, count=len(names),
                           x=190*(i % 4-1.5) + (i//4 % 2)*36, y=149*(i//4-1.5)))
        blocks.append(dict(topic=i, articles=articles, edges=[]))
    totals = Counter()
    for a, b in links:
        source, left = lookup[a]
        target, right = lookup[b]
        blocks[left]["edges"].append([source, target])
        totals[left, right] += 1
    for block in blocks:
        block["edges"].sort()
    out.mkdir(parents=True, exist_ok=True)
    def store(suffix, data):
        name = "graph-" + hashlib.sha256(data).hexdigest()[:16] + "." + suffix
        (out/name).write_bytes(data)
        return name
    full = store("json", encode(blocks))
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory)/"graph.sqlite"
        db = sqlite3.connect(path)
        db.executescript("""
            PRAGMA page_size=16384;
            PRAGMA user_version=1;
            CREATE TABLE articles(topic INTEGER, id INTEGER, title TEXT NOT NULL, degree INTEGER NOT NULL, PRIMARY KEY(topic,id)) WITHOUT ROWID;
            CREATE TABLE edges(topic INTEGER, source INTEGER, target INTEGER, PRIMARY KEY(topic,source,target)) WITHOUT ROWID;
        """)
        for b in blocks:
            db.executemany("INSERT INTO articles VALUES(?,?,?,?)", ((b["topic"], *n) for n in b["articles"]))
            db.executemany("INSERT INTO edges VALUES(?,?,?)", ((b["topic"], *e) for e in b["edges"]))
        db.execute("CREATE INDEX incoming ON edges(target,source)")
        db.commit()
        db.execute("VACUUM")
        assert db.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        db.close()
        sql = path.read_bytes()
    manifest = dict(version=1, name="Wikispeedia", articles=len(titles), links=len(links), pageSize=16384,
                    database=store("sqlite", sql), databaseBytes=len(sql), full=full, fullBytes=(out/full).stat().st_size,
                    topics=topics, connections=[[a,b,n] for (a,b),n in sorted(totals.items())],
                    source="https://snap.stanford.edu/data/wikispeedia.html", archiveSha256=DIGEST)
    (out/"manifest.json").write_bytes(encode(manifest)+b"\n")
    print(f'{len(titles):,} articles, {len(links):,} hyperlinks, {len(topics)} topics; {len(sql):,} SQLite bytes')

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="Use a local copy of the SNAP archive")
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    build(args.archive.read_bytes() if args.archive else urlopen(SOURCE, timeout=90).read(), args.out)
