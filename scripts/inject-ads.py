#!/usr/bin/env python3
"""Post-process the assembled ``_site`` directory to add advertising.

Run by ``.github/workflows/deploy.yml`` after the upstream repo is rsynced in,
so every 6-hour sync of ``ghostlinksinglefile.html`` (and the rest of the
upstream site) gets the ad code re-applied automatically.

What it does:
  1. Adds the AdSense account meta tag + loader + Auto Ads to every page head.
  2. Drops a couple of ``<ins class="adsbygoogle">`` units into each page body.
  3. Injects ``popunder.js`` (opens a sponsor page on some clicks) before
     ``</body>``. Inert unless POPUNDER_URL is set for the build.
  4. Un-blocks the Google ad hosts in the service workers, which otherwise
     answer the AdSense script with HTTP 204 and no ad ever loads.
"""
from __future__ import annotations

import os
import pathlib
import re

SITE = pathlib.Path(os.environ.get("SITE_DIR", "_site"))
PUB = "ca-pub-3679522337620689"
POPUNDER_URL = os.environ.get("POPUNDER_URL", "").strip()

HERE = pathlib.Path(__file__).resolve().parent

HEAD_SNIPPET = (
    f'<meta name="google-adsense-account" content="{PUB}">\n'
    f'<script async src="https://pagead2.googlesyndication.com/pagead/js/'
    f'adsbygoogle.js?client={PUB}" crossorigin="anonymous"></script>\n'
    '<script>window.addEventListener("load",function(){'
    '(adsbygoogle=window.adsbygoogle||[]).push('
    f'{{google_ad_client:"{PUB}",enable_page_level_ads:true}});}});</script>\n'
)

AD_UNIT = (
    f'<ins class="adsbygoogle" style="display:block;margin:12px auto" '
    f'data-ad-client="{PUB}" data-ad-slot="0000000000" '
    'data-ad-format="auto" data-full-width-responsive="true"></ins>'
    '<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>\n'
)

# Ad hosts the upstream service worker blocks that AdSense actually needs.
SW_UNBLOCK = ("googlesyndication.com", "googleadservices.com", "doubleclick.net")


def popunder_snippet() -> str:
    js = (HERE / "popunder.js").read_text(encoding="utf-8")
    js = js.replace("__POPUNDER_URL__", POPUNDER_URL)
    return f"<script>\n{js}\n</script>\n"


def inject_html(html: str) -> str:
    if PUB in html:
        return html  # already processed
    if "</head>" not in html:
        return html
    html = html.replace("</head>", HEAD_SNIPPET + "</head>", 1)
    html = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + "\n" + AD_UNIT * 2,
                  html, count=1)
    close = html.rfind("</body>")
    if close != -1:
        html = html[:close] + popunder_snippet() + html[close:]
    return html


def unblock_sw(js: str) -> str:
    for host in SW_UNBLOCK:
        js = re.sub(rf'^[^\n]*"{re.escape(host)}"[^\n]*\n', "", js, flags=re.M)
    return js


def main() -> None:
    changed = 0
    for path in sorted(SITE.rglob("*.html")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        new = inject_html(text)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
    print(f"inject-ads: patched {changed} html file(s)")

    for sw in sorted(SITE.rglob("*.js")):
        if sw.name not in ("sw.js", "bareworker.js"):
            continue
        text = sw.read_text(encoding="utf-8", errors="ignore")
        new = unblock_sw(text)
        if new != text:
            sw.write_text(new, encoding="utf-8")
            print(f"inject-ads: un-blocked ad hosts in {sw.relative_to(SITE)}")

    print("inject-ads: popunder", "ENABLED" if POPUNDER_URL else "disabled (no POPUNDER_URL)")


if __name__ == "__main__":
    main()
