#!/usr/bin/env python3
"""Build what Marius needs from the source files (index.html, styles.css, main.js).

Run:  python3 build.py

Writes:
  paste-into-systeme.txt   the whole page as one block for a systeme.io "Raw HTML" element
  go-live.html             Marius's step-by-step page, with that block behind a Copy button
  test/systeme-sim.html    a rough stand-in for a systeme.io page, for checking the block locally
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent

index = (ROOT / "index.html").read_text()
css = (ROOT / "styles.css").read_text()
js = (ROOT / "main.js").read_text()

# Only the part of index.html between the markers goes into systeme.io.
markup = re.search(r"<!-- mpm:start.*?-->(.*?)<!-- mpm:end -->", index, re.S).group(1)
markup = re.sub(r"<!--.*?-->", "", markup, flags=re.S).strip()

# systeme.io's Raw HTML element does not accept these tags.
for tag in ("<head", "<body", "<html", "<footer"):
    assert tag not in markup, f"{tag}> is not allowed inside a systeme.io Raw HTML element"
assert "</script" not in js, "main.js would close its own <script> tag"

fonts = re.search(r'<link href="(https://fonts\.googleapis\.com/[^"]+)"', index).group(1)

# Light CSS squeeze: comments and extra whitespace only.
css_min = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
css_min = re.sub(r"\s+", " ", css_min)
css_min = re.sub(r"\s*([{};])\s*", r"\1", css_min).strip()

block = f"""<!-- MP Move page. Paste this whole block into one Raw HTML element. To undo, delete the element. -->
<script>document.documentElement.classList.add('js')</script>
<style>@import url('{fonts.replace("&amp;", "&")}');{css_min}</style>
{markup}
<script>
{js}</script>
"""

(ROOT / "paste-into-systeme.txt").write_text(block)

template = (ROOT / "go-live.template.html").read_text()
(ROOT / "go-live.html").write_text(template.replace("{{CODE}}", html.escape(block)))

sim = (ROOT / "test" / "systeme-sim.template.html").read_text()
(ROOT / "test" / "systeme-sim.html").write_text(sim.replace("{{BLOCK}}", block))

# For trying the block against a real systeme.io page without saving anything there: loading this
# script in the browser console drops the block into the page in front of you, for that tab only.
inject = """(() => {
  const host = document.createElement('div');
  host.id = 'rawhtml-localtest';
  host.innerHTML = %s;
  const firstRow = document.querySelector('[id^="row-"]');
  firstRow.parentElement.insertBefore(host, firstRow);
  // Scripts added through innerHTML do not run, so recreate them.
  host.querySelectorAll('script').forEach((old) => {
    const s = document.createElement('script');
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
})();
""" % json.dumps(block)
(ROOT / "test" / "inject.js").write_text(inject)

print(f"paste-into-systeme.txt  {len(block) / 1024:.0f} KB")
print("go-live.html")
print("test/systeme-sim.html")
