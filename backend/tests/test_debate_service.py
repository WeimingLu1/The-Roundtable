import pytest
from app.services.debate import parse_turn_response, Stance, Action


def test_parse_valid_turn_response():
    text = "AGREE||4||I strongly believe this is the right approach.||CONTINUE"
    stance, intensity, message, action = parse_turn_response(text)
    assert stance == Stance.AGREE
    assert intensity == 4
    assert message == "I strongly believe this is the right approach."
    assert action == Action.CONTINUE


def test_parse_disagree_turn():
    text = "DISAGREE||5||This completely misses the point.||WAIT"
    stance, intensity, message, action = parse_turn_response(text)
    assert stance == Stance.DISAGREE
    assert intensity == 5
    assert action == Action.WAIT


def test_parse_partial_turn():
    text = "PARTIAL||3||There are merits on both sides.||CONTINUE"
    stance, intensity, message, action = parse_turn_response(text)
    assert stance == Stance.PARTIAL
    assert intensity == 3
    assert action == Action.CONTINUE


def test_parse_pivot_turn():
    text = "PIVOT||2||Let us consider the economic implications.||WAIT"
    stance, intensity, message, action = parse_turn_response(text)
    assert stance == Stance.PIVOT
    assert intensity == 2
    assert action == Action.WAIT


def test_parse_fallback_on_invalid():
    text = "Some random text without proper format"
    stance, intensity, message, action = parse_turn_response(text)
    assert stance == Stance.NEUTRAL
    assert intensity == 3
    assert message == "Some random text without proper format"
    assert action == Action.CONTINUE


def test_parse_strips_whitespace():
    text = "  AGREE||4||My message.||CONTINUE  "
    stance, intensity, message, action = parse_turn_response(text)
    assert stance == Stance.AGREE
    assert message == "My message."
