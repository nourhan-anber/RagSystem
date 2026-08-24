# Test documents

Sample documents for exercising the RAG pipeline end to end.

## These are fictional

Every document describes the **Kestrel County Building Code**, a jurisdiction that
does not exist. Nothing here is real regulatory guidance and none of it should be
used for actual construction work.

That is deliberate, and not only for safety. If these were extracts from a real
code, the model could answer correctly from its training data without retrieval
working at all, and a passing test would tell you nothing. Because every value
below is invented, a correct answer proves the chunk was actually retrieved and
placed in the prompt.

## Files

| File | Covers | Tests |
| --- | --- | --- |
| `structural-loads.txt` | live loads, snow, wind, seismic, deflection | plain text ingestion |
| `fire-safety.txt` | occupant load, travel distance, ratings, sprinklers | plain text ingestion |
| `accessibility.txt` | routes, doors, ramps, sanitary, parking | plain text ingestion |
| `building-services.pdf` | electrical, ventilation, emergency power, energy | **PDF path** (PyMuPDF) |
| `unsupported-floorplan.png` | — | file type rejection |

## Verification questions

### Single fact

| Ask | Expected |
| --- | --- |
| What is the minimum live load for light storage? | 6.2 kN/m² |
| What is the basic wind speed for Kestrel County? | 42 m/s |
| How long must emergency lighting operate after a power loss? | 90 minutes |
| What is the maximum running slope of a ramp? | 1 in 12 |
| How much outdoor air is required per person? | 7.5 L/s per person, plus 0.35 L/s per m² |

### Retrieval discrimination

These have deliberate near-collisions across documents. If retrieval is weak, the
wrong chunk surfaces and the answer quietly cites the wrong rule.

| Ask | Expected | The trap |
| --- | --- | --- |
| What is the minimum clear width of a doorway on an accessible route? | 850 mm (Part 7) | `fire-safety.txt` says fire doors need a 900 mm leaf |
| What is the maximum travel distance to an exit in a sprinklered building? | 45 m (Part 5) | `accessibility.txt` also uses 45 m, for parking distance |
| What fire resistance rating does an exit stair enclosure need? | 2 h for 4+ storeys, 1 h below | ratings also appear for shafts and dwelling separations |

### Cross-document

Needs chunks from more than one file in the same answer:

- *A five storey office building of 3,000 m² — does it need sprinklers, and what stair rating applies?*
  (Both from Part 5: yes, over 1,200 m² and over three storeys; 2 hour enclosure.)
- *What is the office live load, and what is the maximum lighting power density for offices?*
  (2.7 kN/m² from `structural-loads.txt`; 8.5 W/m² from the PDF.)

### Grounding

The system should decline rather than invent:

- *What is the minimum ceiling height for a basement?* — not in any document.
- *What does Part 12 say about heritage structures?* — referenced but never included.

### Follow-ups

Tests that conversation history reaches the model:

1. *What is the maximum rise of a single ramp run?* → 760 mm
2. *And what landing size does it need?* → 1,500 mm — only resolvable if turn 1 is in context.

### Error paths

- Upload `unsupported-floorplan.png` → rejected as `file_type_not_supported`.
- Ask a question in a workspace with nothing uploaded → should say there is nothing
  to answer from, not invent an answer.
