# JSON question bank

The bank has `version: 1`, an `outcomes` catalog, and a `questions` array. Learning outcomes are the question-relative **kazanımlar**, independent of exam-specific question IDs. Questions link to one or more outcomes; wrong choices can link to a subset of those outcomes.

```json
{
  "version": 1,
  "outcomes": [
    {
      "id": "bio.cell",
      "subject": "Biology",
      "title": "Cell organelles",
      "remember": "Mitochondria produce most aerobic ATP; ribosomes build proteins."
    }
  ],
  "questions": [
    {
      "id": "imat-cell-example-v1",
      "exam": "IMAT",
      "type": "single_choice",
      "subject": "Biology",
      "difficulty": "easy",
      "prompt": "Which organelle produces most ATP during aerobic respiration?",
      "options": [
        {
          "id": "A",
          "text": "Ribosome",
          "misconception": "Ribosomes synthesise proteins, not ATP.",
          "outcome_ids": ["bio.cell"]
        },
        { "id": "B", "text": "Mitochondrion" }
      ],
      "answer": { "option_id": "B" },
      "explanation": "The electron transport chain and ATP synthase are in the inner mitochondrial membrane.",
      "outcome_ids": ["bio.cell"]
    }
  ]
}
```

The real file includes five-option exam-style examples. The renderer supports two or more options. Distractor mappings are authored diagnostic hints, **not automatic proof of the student’s thought process**. Students record their own mistake reason and note separately. If a distractor has no mapping, the question’s full outcome list is used; if it has no hint, the app asks the student to review the explanation.

Numeric example (add its referenced outcome to the catalog):

```json
{
  "id": "tolcf-current-example-v1",
  "exam": "TOLC-F",
  "type": "numeric",
  "subject": "Physics",
  "difficulty": "medium",
  "prompt": "A 10 Ω resistor has 5 V across it. What is the current in amperes?",
  "answer": { "value": 0.5, "tolerance": 0.001 },
  "explanation": "I = V / R = 5 / 10 = 0.5 A.",
  "outcome_ids": ["phys.electricity"]
}
```

## Supported fields

| Field | Rules |
| --- | --- |
| `version` | Currently `1` |
| Outcome `id` | Unique, non-empty, durable identifier |
| Outcome `subject`, `title`, `remember` | Required human-readable text |
| Question `id` | Globally unique; do not reuse for a changed question |
| `exam` | `IMAT`, `TOLC-I`, `TOLC-F` |
| `type` | `single_choice` or `numeric` |
| `difficulty` | `easy`, `medium`, `hard` |
| `prompt`, `subject`, `explanation` | Required text |
| Question `outcome_ids` | One or more valid, distinct catalog IDs |
| `options` | Required for choices, two or more unique option IDs; omitted for numeric |
| Option `misconception` | Optional plain-text explanation of the wrong choice |
| Option `outcome_ids` | Optional subset of the parent question’s kazanımlar |
| `answer.option_id` | Must match an option; choice questions only |
| `answer.value` | A finite JSON number; numeric questions only |
| `answer.tolerance` | Optional non-negative absolute tolerance, default zero |

The bank must be **server-only**. Do not copy answer JSON into mobile assets, import it in the React Native bundle, or publish a hosted answer-bank download. Public GitHub sample answers are examples; keep your eventual private question content in a private bank file or private repository.

Validation rejects unknown properties, unsupported types/exams, duplicate IDs and missing references. A question with multiple kazanımlar contributes its latest correctness result to each linked outcome. The narrower wrong-option mapping appears in feedback and the notebook.

## Review behaviour

Wrong answers are due after one day. Consecutive correct answers to the same question use intervals of 1, 3, 7 and then 14 days. An immediate retry can resolve the notebook entry, but the history still records the earlier wrong answer. Daily sessions draw at most five questions. When there is insufficient new/due content, future review questions fill the set, so sample banks remain usable every day. Daily completion and streaks use the account timezone; notifications use the phone timezone.

No official IMAT/TOLC penalties, weighted exam totals or predicted scores are implemented. Those rules should be added as separately validated exam configurations if full mock exams are introduced later.
