"""Index hyperlink evidence from the 2007 Schools Wikipedia Selection.

Run with uv run --with lxml scripts/index-wiki-connections.py wikispeedia_articles_html.tar.gz
The original HTML archive is available from https://snap.stanford.edu/data/wikispeedia.html.
"""

import argparse
import hashlib
import json
import posixpath
import re
import tarfile
from collections import defaultdict
from pathlib import Path, PurePosixPath
from urllib.parse import quote, unquote, urlsplit

from lxml import html

ROOT = Path(__file__).resolve().parents[1] / "web/public/examples/wikispeedia"
DIGEST = "dcb152a882726f4accd42d5906260731dcc4e530d1937628a51c03c7f3b578df"
SPACE = re.compile(r"\s+")
SENTENCE_BREAK = re.compile(r"""[.!?][)"”’]*\s+(?=[A-Z“"])""")


def clean(text):
    return SPACE.sub(" ", text).strip()


def passage(paragraph, anchor):
    text = clean(paragraph.text_content())
    if not anchor or len(anchor.split()) > 10 or text.count(anchor) != 1:
        return 0, ""
    start = text.index(anchor)
    end = start + len(anchor)
    left, right = 0, len(text)
    for boundary in SENTENCE_BREAK.finditer(text):
        if boundary.end() <= start:
            left = boundary.end()
        elif boundary.start() >= end - 1:
            right = boundary.end()
            break
    sentence = text[left:right].strip()
    if 4 <= len(sentence.split()) <= 25:
        return 3, sentence
    before = list(re.finditer(r"\S+", text[left:start]))
    after = list(re.finditer(r"\S+", text[end:right]))
    if len(before) + len(after) < 3:
        return 0, ""
    first = left + before[-9].start() if len(before) > 9 else left
    last = end + after[8].end() if len(after) > 9 else right
    return 2, ("…" if first > left else "") + text[first:last].strip() + ("…" if last < right else "")


def heading_fragment(heading):
    previous = heading.getprevious()
    # In this edition headings commonly follow <p><a id="..." name="..."></a></p>.
    if previous is not None:
        anchors = [a for a in previous.iter("a") if (a.get("name") or a.get("id")) and not a.get("href")]
        if anchors:
            return anchors[-1].get("name") or anchors[-1].get("id")
    return heading.get("id") or next(iter(heading.xpath(".//*[@id]/@id")), "")


def hyperlink_target(link, source_path, ids):
    url = urlsplit(link.get("href", ""))
    if url.scheme or url.netloc or not url.path.endswith(".htm"):
        return None
    target = PurePosixPath(posixpath.normpath(posixpath.join(str(source_path.parent), unquote(url.path))))
    if len(target.parts) != 4 or target.parts[:2] != ("wpcd", "wp"):
        return None
    # The title attribute sometimes names a different article; the original href is authoritative.
    return ids.get(unquote(target.stem).replace("_", " "))


def index_article(page, path, source, targets, ids, proofs):
    heading, fragment = "Introduction", ""
    for element in page.iter("a", "h2", "h3", "h4", "h5"):
        if element.tag != "a":
            if element.get("id") != "siteSub":
                heading = clean(element.text_content())
                fragment = heading_fragment(element)
            continue
        target = hyperlink_target(element, path, ids)
        if target not in targets:
            continue
        anchor = clean(element.text_content())
        if not anchor:
            anchor = clean(" ".join(element.xpath(".//img/@alt")))
        if not anchor:
            continue
        parent = next(
            (p for p in element.iterancestors() if p.tag in ("p", "li", "td", "dd", "dt", "caption")), None
        )
        score, text = passage(parent, anchor) if parent is not None and parent.tag == "p" else (0, "")
        key = source, target
        if key not in proofs or proofs[key][0] < score:
            proofs[key] = score, [heading, fragment, anchor, text]


def build(archive, root):
    with archive.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != DIGEST:
            raise ValueError("HTML archive differs from the recorded Wikispeedia edition")
    manifest = json.loads((root / "manifest.json").read_text())
    blocks = json.loads((root / manifest["full"]).read_text())
    ids = {title: i for block in blocks for i, title, _ in block["articles"]}
    topics = {i: block["topic"] for block in blocks for i, _, _ in block["articles"]}
    wanted = defaultdict(set)
    for block in blocks:
        for a, b in block["edges"]:
            if topics[a] != topics[b]:
                wanted[a].add(b)

    proofs, pages = {}, {}
    parser = html.HTMLParser(encoding="utf-8", recover=True)
    with tarfile.open(archive, mode="r|gz") as bundle:
        for member in bundle:
            path = PurePosixPath(member.name)
            if (
                len(path.parts) != 4
                or path.parts[:2] != ("wpcd", "wp")
                or path.suffix != ".htm"
                or path.parts[2] == "index"
            ):
                continue
            source = ids.get(unquote(path.stem).replace("_", " "))
            if source is None:
                continue
            pages[source] = quote(str(path.relative_to("wpcd")), safe="/")
            dom = html.fromstring(bundle.extractfile(member).read(), parser=parser)
            # text_content() includes script and stylesheet contents. Remove non-reader text before ranking
            # passages, and preserve the article text following each element through lxml's drop_tree().
            for element in dom.xpath("//script|//style|//noscript|//template|//*[@hidden or @aria-hidden='true']"):
                element.drop_tree()
            content = dom.xpath('//*[@id="bodyContent"]')
            if content:
                index_article(content[0], path, source, wanted[source], ids, proofs)

    groups = defaultdict(lambda: {"pages": {}, "links": {}})
    for a, targets in wanted.items():
        for b in sorted(targets):
            pair = tuple(sorted((topics[a], topics[b])))
            group = groups[pair]
            for node in (a, b):
                group["pages"][str(node)] = pages[node]
            if (a, b) in proofs:
                group["links"][f"{a}:{b}"] = proofs[a, b][1]
    total = sum(map(len, wanted.values()))
    if len(pages) != len(ids) or len(proofs) < total * 0.99:
        raise ValueError("Insufficient source coverage")
    out = root / "evidence"
    out.mkdir(exist_ok=True)
    for (a, b), payload in sorted(groups.items()):
        (out / f"{a}-{b}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    print(
        f"{len(pages)} articles; {len(proofs)} of {total} crossing hyperlinks traced to their HTML anchors; {len(groups)} topic pairs"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    build(parser.parse_args().archive, ROOT)
