#!/usr/bin/env python3
"""Helpers for .github/workflows/recover-board-seats.yml.

  bookmark <file>          print the D1 bookmark found in wrangler output
  seats-sql <json> <sql>   turn the exported seats into safe INSERTs
  report <json>            print the recovered seats as a readable list
"""
import json
import re
import sys

BOOKMARK = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}\b")


def rows(path):
    data = json.load(open(path))
    if isinstance(data, list):
        out = []
        for part in data:
            out.extend(part.get("results", []))
        return out
    return data.get("results", [])


def q(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


cmd = sys.argv[1]
if cmd == "bookmark":
    found = BOOKMARK.findall(open(sys.argv[2]).read())
    if not found:
        sys.exit("no bookmark in wrangler output")
    print(found[0])
elif cmd == "seats-sql":
    seats = rows(sys.argv[2])
    lines = []
    for r in seats:
        cols = "(id, seat_id, member_id, started_at, ended_at, appointed_by, note)"
        vals = ", ".join(q(r.get(k)) for k in ["id", "seat_id", "member_id", "started_at", "ended_at", "appointed_by", "note"])
        # Only for seats and accounts that still exist. A current holder is
        # only put back if nobody has been placed in that seat since
        # (shared seats allow several holders, so they always go back).
        current_ok = (
            "1" if r.get("ended_at") else
            f"(NOT EXISTS (SELECT 1 FROM board_seat_assignments x WHERE x.seat_id = {q(r['seat_id'])} AND x.ended_at IS NULL)"
            f" OR (SELECT is_shared FROM board_members WHERE id = {q(r['seat_id'])}) = 1)"
        )
        lines.append(
            f"INSERT OR IGNORE INTO board_seat_assignments {cols} SELECT {vals} "
            f"WHERE EXISTS (SELECT 1 FROM members WHERE id = {q(r['member_id'])}) "
            f"AND EXISTS (SELECT 1 FROM board_members WHERE id = {q(r['seat_id'])}) "
            f"AND {current_ok};"
        )
    open(sys.argv[3], "w").write("\n".join(lines) + "\n")
    print(f"{len(lines)} seat assignment(s) to put back")
elif cmd == "report":
    seats = rows(sys.argv[2])
    if not seats:
        print("No board seat assignments existed at that time.")
    for r in seats:
        status = "current" if not r.get("ended_at") else f"ended {r['ended_at']}"
        print(f"- {r.get('seat_role') or r['seat_id']}: {r.get('member_name') or r['member_id']} ({status}, since {r.get('started_at')})")
else:
    sys.exit(f"unknown command {cmd}")
