"""Rebuild Loom's article graphs from their recorded English Wikipedia revisions."""

import argparse
import json
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote
from urllib.request import Request, urlopen

ATLASES = Path(__file__).resolve().parents[1] / "demo" / "atlases"
VOID = set("area base br col embed hr img input link meta param source track wbr".split())
EXCLUDE = set("aside figure footer header li nav ol sup table".split())


class Article(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.links = Counter()
        self.description = []
        self.revision = None

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        classes = (attrs.get("class") or "").split()
        if tag == "html":
            self.revision = int(attrs["about"].rsplit("/", 1)[1])
        parent = self.stack[-1] if self.stack else ("", False, False, False)
        excluded = parent[1] or tag in EXCLUDE or "hatnote" in classes or "navbox" in classes
        paragraph = parent[2] or tag == "p"
        description = parent[3] or "shortdescription" in classes
        if tag not in VOID:
            self.stack.append((tag, excluded, paragraph, description))
        if tag == "a" and paragraph and not excluded and "mw:WikiLink" in (attrs.get("rel") or "").split():
            href = (attrs.get("href") or "").split("#", 1)[0]
            if href.startswith("./"):
                self.links[unquote(href[2:]).replace("_", " ")] += 1

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.stack and self.stack[-1][3]:
            self.description.append(data)


def index_atlas(key, atlas, latest):
    path = ATLASES / (key + ".json")
    revisions = {} if latest else {n["id"]: n["wikipediaRevision"] for n in json.loads(path.read_text())["nodes"]}
    nodes, mentions = [], {}
    for section, group in atlas["sections"].items():
        for title in group["articles"]:
            node_id = title.replace(" ", "_")
            revision = None if latest else revisions[node_id]
            url = "https://en.wikipedia.org/api/rest_v1/page/html/" + quote(node_id, safe="")
            if revision:
                url += "/" + str(revision)
            request = Request(url, headers={"User-Agent": "LoomGraphStudio/0.1 (https://github.com/castlemilk/loom)"})
            article = Article()
            with urlopen(request, timeout=45) as response:
                article.feed(response.read().decode("utf-8"))
            article.close()
            if not article.revision or (revision and article.revision != revision):
                raise ValueError("Unexpected article revision for " + title)
            node = {"id": node_id, "label": re.sub(r" \([^()]*\)$", "", title), "kind": group["kind"],
                    "section": section, "wikipediaRevision": article.revision}
            summary = " ".join("".join(article.description).split())
            if summary:
                node["summary"] = summary
            nodes.append(node)
            mentions[node_id] = article.links
    links = []
    ids = {n["id"] for n in nodes}
    for node in nodes:
        # most_common breaks ties by first occurrence in the article's prose.
        candidates = [(title.replace(" ", "_"), count) for title, count in mentions[node["id"]].most_common()
                      if title.replace(" ", "_") in ids and title.replace(" ", "_") != node["id"]]
        for target, count in candidates[:4]:
            links.append({"source": node["id"], "target": target, "kind": "wikilink", "weight": count})
    graph = {"name": atlas["title"], "attribution": "English Wikipedia contributors, CC BY-SA 4.0",
             "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
             "revisionUrlTemplate": "https://en.wikipedia.org/w/index.php?oldid={wikipediaRevision}",
             "nodes": nodes, "links": links}
    path.write_text(json.dumps(graph, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{key}: {len(nodes)} articles, {len(links)} directed links", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--latest", action="store_true", help="capture current revisions instead of replaying the snapshot")
    args = parser.parse_args()
    for key, atlas in json.loads((ATLASES / "catalog.json").read_text()).items():
        index_atlas(key, atlas, args.latest)
