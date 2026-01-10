# Distinguished Area and Division Recognition Criteria

**Status:** Authoritative  
**Applies to:** Area and Division recognition calculations  
**Audience:** Developers, Analytics Engine  
**Owner:** Development Team

---

## 1. Purpose

This document defines the **formal recognition rules** for evaluating Area and Division Distinguished status in Toastmasters International.

These rules are **normative** and MUST be implemented exactly as specified.

---

## 2. Distinguished Area Program (DAP)

### 2.1 Eligibility Gates

An Area is eligible for recognition **only if ALL** of the following are true:

1. **Club Visits**: At least two club visits per club are completed and submitted using the official Area Director Club Visit Report.

If this condition is false, the Area is **ineligible**, regardless of all other metrics.

### 2.2 Scored Metrics

Once eligible, recognition is determined by two independent percentage thresholds:

#### Paid Clubs Percentage

- ≥ 75% of clubs in the Area must be paid clubs
- A "paid club" is a club in good standing with Toastmasters International (dues paid)

#### Distinguished Clubs Percentage

- Percentage is calculated **only against paid clubs**
- Required thresholds vary by recognition level (see below)

### 2.3 Recognition Levels (Area)

| Recognition Level              | Paid Clubs | Distinguished Clubs (of paid clubs) |
| ------------------------------ | ---------- | ----------------------------------- |
| Distinguished Area             | ≥ 75% paid | ≥ 50% Distinguished                 |
| Select Distinguished Area      | ≥ 75% paid | ≥ 75% Distinguished                 |
| President's Distinguished Area | ≥ 75% paid | 100% Distinguished                  |

---

## 3. Distinguished Division Program (DDP)

### 3.1 Eligibility Gates

A Division is eligible for recognition **only if ALL** of the following are true:

1. **Area Club Visits**: Areas in the Division have completed required Area Director club visits (two per club).

If this condition is false, the Division is **ineligible**, regardless of all other metrics.

### 3.2 Scored Metrics

Once eligible, recognition is determined by two independent percentage thresholds:

#### Paid Areas Percentage

- ≥ 85% of Areas in the Division must be paid Areas
- A "paid Area" is an Area not suspended due to unpaid clubs

#### Distinguished Areas Percentage

- Percentage is calculated **only against paid Areas**
- Required thresholds vary by recognition level (see below)

### 3.3 Recognition Levels (Division)

| Recognition Level                  | Paid Areas | Distinguished Areas (of paid areas) |
| ---------------------------------- | ---------- | ----------------------------------- |
| Distinguished Division             | ≥ 85% paid | ≥ 50% Distinguished                 |
| Select Distinguished Division      | ≥ 85% paid | ≥ 75% Distinguished                 |
| President's Distinguished Division | ≥ 85% paid | 100% Distinguished                  |

---

## 4. Canonical Dependency Rules

These rules MUST be enforced:

1. **Paid status is a prerequisite**, not a score multiplier
2. **Distinguished percentages are always calculated against paid units only**
3. **Eligibility gates hard-block recognition**
4. **Recognition levels are ordinal**: Distinguished < Select Distinguished < President's Distinguished

---

## 5. Data Availability Notes

### Club Visit Data

- Club visit completion data is **not currently available** from the Toastmasters dashboard CSV exports
- Until this data becomes available, eligibility gates based on club visits **cannot be evaluated**
- Implementation SHOULD track eligibility as "unknown" when visit data is unavailable

### Paid Status

- Club paid status can be inferred from club status fields in dashboard data
- A club with status "Active" is considered paid
- Clubs with status "Suspended", "Ineligible", or "Low" are not considered paid

---

## 6. Implementation Requirements

1. Recognition calculations MUST follow the exact thresholds specified
2. Percentage calculations MUST use the correct denominator (paid units only for distinguished %)
3. Eligibility gates MUST be evaluated before scoring metrics
4. Recognition level MUST be the highest level for which all criteria are met
5. When eligibility cannot be determined, recognition MUST be marked as "Unknown"

---

## 7. Final Rules

> **Eligibility gates are hard blockers.**  
> **Distinguished percentages use paid units as denominator.**  
> **Recognition levels are ordinal and mutually exclusive.**
