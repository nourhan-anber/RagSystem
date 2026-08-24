import json

from routes.sse import sse_frame


def test_frame_is_a_data_line_terminated_by_a_blank_line():
    assert sse_frame({"type": "done"}) == 'data: {"type":"done"}\n\n'


def test_payload_round_trips_as_json():
    frame = sse_frame({"type": "token", "value": "Hello"})

    payload = json.loads(frame[len("data: "):].strip())
    assert payload == {"type": "token", "value": "Hello"}


def test_a_token_containing_blank_lines_cannot_split_the_frame():
    """A raw newline in the payload would otherwise terminate the frame early."""
    frame = sse_frame({"type": "token", "value": "para one\n\npara two"})

    assert frame.count("\n\n") == 1
    assert frame.endswith("\n\n")
    assert json.loads(frame[len("data: "):].strip())["value"] == "para one\n\npara two"


def test_non_ascii_survives_intact():
    """The template parser ships an Arabic locale, so answers are not ASCII-only."""
    frame = sse_frame({"type": "token", "value": "مرحبا"})

    assert "مرحبا" in frame
    assert json.loads(frame[len("data: "):].strip())["value"] == "مرحبا"
