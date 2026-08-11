#!/usr/bin/env python3
"""Guard against prose regressing out of Simplified Technical English.

Scores markdown docs and the visible copy in HTML pages, then fails if the
score rises above a threshold. Stdlib only, no network, deterministic.

Scores the SAFE SUBSET only - semicolons, passive voice, nominalizations,
complex tenses, -ing main verbs, banned words, marketing adjectives, phrasal
verbs, hedges. It deliberately does NOT count contractions or sentence length:
expanding "we're" and chopping sentences to 20 words flattens a site's voice,
and that trade is not worth making on marketing copy.

Rule set distilled from ASD-STE100 Issue 9, following the linter published at
github.com/woosal1337/blog (videos/ep01-the-cure-for-ai-slop). Unofficial and
not affiliated with ASD.

Usage:
    ste_check.py --fail-over 2.5 [PATH ...]
    ste_check.py --report            # print the score, never fail
"""
import pathlib
import re
import sys
from html.parser import HTMLParser

SKIP_DIRS = {".git", "node_modules", "dist", "build", ".venv", "venv",
             "__pycache__", "www", ".next", "coverage"}

MARKETING = ["seamless", "seamlessly", "robust", "powerful", "cutting-edge",
             "effortless", "effortlessly", "world-class", "next-generation",
             "revolutionary", "blazing", "lightning-fast", "turnkey",
             "best-in-class", "state-of-the-art", "game-changing",
             "battle-tested", "enterprise-grade", "supercharge", "unleash",
             "empower", "empowers"]
BANNED = ["commence", "commences", "initiate", "initiates", "utilize",
          "utilizes", "utilizing", "leverage", "leverages", "leveraging",
          "facilitate", "facilitates", "ensure", "ensures", "ensuring",
          "prior to", "subsequent to", "obtain", "obtains", "acquire",
          "acquires", "demonstrate", "demonstrates", "additionally",
          "furthermore", "moreover", "comprehensive", "utilization",
          "aforementioned", "henceforth", "therein", "whilst", "amongst",
          "numerous", "myriad", "plethora", "in order to", "a variety of",
          "in the event that", "due to the fact that"]
PHRASAL = ["spin up", "reach out", "dive into", "kick off", "roll out",
           "tear down", "ramp up", "circle back", "drill down"]
HEDGE = ["it is important to note", "it should be noted", "it is worth noting",
         "please note that", "as mentioned", "as noted above"]

BE = r"(?:am|is|are|was|were|be|been|being)"
PP = (r"(?:done|made|sent|read|built|kept|held|set|put|run|written|shown|"
      r"given|taken|found|got|gotten|seen|known|thrown|drawn)")
STATIVE = (r"(?:closed|opened?|damaged|completed?|installed|connected|required|"
           r"expected|configured|enabled|disabled|deprecated|supported)")


class Copy(HTMLParser):
    SKIP = {"script", "style", "svg", "noscript", "code", "pre", "template"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth, self.chunks = 0, []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.depth += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            return
        s = " ".join(data.split())
        if len(s.split()) >= 6:
            self.chunks.append(s)


def visible_text(path):
    if path.suffix.lower() == ".html":
        p = Copy()
        p.feed(path.read_text(encoding="utf-8", errors="ignore"))
        return "\n".join(p.chunks)
    t = path.read_text(encoding="utf-8", errors="ignore")
    t = re.sub(r"```.*?```", " ", t, flags=re.S)
    return re.sub(r"`[^`]*`", " ", t)


def count(text, phrases):
    low = text.lower()
    return sum(len(re.findall(r"(?<![a-z])" + re.escape(p) + r"(?![a-z])", low))
               for p in phrases)


def score(text):
    words = len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-/]*", text)) or 1
    v = {}
    v["semicolon"] = text.count(";")
    parts = re.findall(rf"\b{BE}\s+(\w+ed|{PP})\b", text, re.I)
    v["passive"] = sum(1 for p in parts if not re.fullmatch(STATIVE, p, re.I))
    v["complex_tense"] = len(re.findall(
        rf"\b(?:have|has|had)\s+(?:been\s+)?(?:\w+ed|{PP})\b", text, re.I))
    v["ing_main_verb"] = len(re.findall(rf"\b{BE}\s+\w+ing\b", text, re.I))
    v["nominalization"] = (
        len(re.findall(r"\b(?:perform(?:s|ed)?|conduct(?:s|ed)?|carry out)\b",
                       text, re.I))
        + len(re.findall(r"\b\w{4,}(?:tion|ment|ance|ence)\s+of\b", text, re.I)))
    v["banned_word"] = count(text, BANNED)
    v["marketing_adjective"] = count(text, MARKETING)
    v["phrasal_verb"] = count(text, PHRASAL)
    v["modal_hedge"] = count(text, HEDGE)
    return sum(v.values()), words, v


def main():
    args = sys.argv[1:]
    limit = None
    if "--fail-over" in args:
        i = args.index("--fail-over")
        limit = float(args[i + 1])
        del args[i:i + 2]
    args = [a for a in args if a != "--report"]
    roots = [pathlib.Path(a) for a in args] or [pathlib.Path(".")]

    files = []
    for r in roots:
        if r.is_file():
            files.append(r)
            continue
        for pat in ("*.md", "*.html"):
            files += [f for f in r.rglob(pat)
                      if not any(d in f.parts for d in SKIP_DIRS)]

    total, words, agg = 0, 0, {}
    worst = []
    for f in sorted(set(files)):
        text = visible_text(f)
        if len(text.split()) < 40:
            continue
        t, w, v = score(text)
        total += t
        words += w
        for k, n in v.items():
            agg[k] = agg.get(k, 0) + n
        if t:
            worst.append((round(t * 100 / w, 2), t, str(f)))

    per100 = round(total * 100 / max(words, 1), 2)
    print(f"STE safe-subset: {total} violations / {words} words = "
          f"{per100} per 100 words")
    for k, n in sorted(agg.items(), key=lambda kv: -kv[1]):
        if n:
            print(f"  {n:4d}  {k}")
    if worst:
        print("\nworst files:")
        for s, t, f in sorted(worst, reverse=True)[:8]:
            print(f"  {s:5.2f}  ({t:3d})  {f}")

    if limit is None:
        return 0
    if per100 > limit:
        print(f"\n::error::prose score {per100} is over the {limit} budget",
              file=sys.stderr)
        return 1
    print(f"\nwithin budget ({per100} <= {limit})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
