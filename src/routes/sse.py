import json


def sse_frame(event: dict) -> str:
    """
    Serialises one protocol event as a Server-Sent Events frame.

    The payload is JSON-encoded, which matters for more than tidiness: a token
    containing a blank line would otherwise terminate the frame early and split
    one answer into two events. ensure_ascii is off so non-Latin answers (the
    template parser ships an Arabic locale) travel as themselves.
    """
    payload = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
    return f"data: {payload}\n\n"
