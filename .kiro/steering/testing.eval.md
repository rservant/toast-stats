# Testing Evaluation Checklist

This document defines **how changes are judged**.

It is governed by `testing.md`.  
No rule here supersedes steering intent.

This evaluation MUST be applied to any non-trivial change.

---

## 1. Behavioural Impact

- What behaviour changed?
- Is the change user-visible, derived, or internal?
- Does it affect classification, thresholds, or timing?

---

## 2. Risk Assessment

If this change breaks:

- Will it be obvious?
- Will data be corrupted?
- Could it silently misclassify or mislead?

Classify risk as:

- Low
- Medium
- High

---

## 3. Protection

- What test(s) would fail if this broke?
- Do the tests fail for the _right reason_?
- Do test names explain _why_ the rule exists?

If no test exists:

- Is that acceptable in this scope?
- Why?

---

## 4. Edge and Boundary Coverage

- Are thresholds tested?
- Are boundary values explicit?
- Are invalid or unexpected inputs considered?

---

## 5. Trustworthiness

- Are tests deterministic?
- Would future-you trust these tests in 6–12 months?
- Are tests readable without context?

---

## 6. Justified Gaps

- What is intentionally _not_ tested?
- Why is that acceptable?
- What would prompt adding tests later?

---

## 7. Final Assessment

One of the following MUST be chosen:

- ✅ **Acceptable**
- ⚠️ **Acceptable with documented risk**
- ❌ **Unsafe without additional protection**

Include rationale referencing steering principles.

---

This evaluation is executed by Kiro, not merely read.
