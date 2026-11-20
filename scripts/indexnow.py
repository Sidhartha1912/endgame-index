#!/usr/bin/env python3
"""Tell Bing (and other IndexNow engines) which pages changed. Run after a successful push.

Usage: python3 scripts/indexnow.py            -> today's pages (home, latest day, hubs, endings)
       python3 scripts/indexnow.py --all      -> every URL in sitemap.xml (first release)
Never fails the nightly run: errors are printed and the exit code stays 0.
"""
import json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = "82e14ba1225e02f33b69f884de12fe6e"
HOST = "endgameindex.com"


def main():
    sm = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
    urls = re.findall(r"<loc>([^<]+)</loc>", sm)
    if "--all" not in sys.argv:
        day_urls = sorted(u for u in urls if re.search(r"/day/\d{4}-\d\d-\d\d/$", u))
        urls = [u for u in urls if "/day/" not in u] + day_urls[-2:]
    body = json.dumps({"host": HOST, "key": KEY, "keyLocation": f"https://{HOST}/{KEY}.txt", "urlList": urls[:10000]}).encode()
    req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"indexnow: {r.status} for {len(urls)} urls")
    except Exception as ex:
        print(f"indexnow: not sent ({ex})")


if __name__ == "__main__":
    main()
