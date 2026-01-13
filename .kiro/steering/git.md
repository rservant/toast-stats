# Git Steering Document

**Status:** Authoritative  
**Applies to:** All version-controlled files in this repository  
**Audience:** All developers and automation agents (including Kiro)  
**Owner:** Repository Owner

---

## 1. Purpose

This document defines **mandatory rules and constraints for Git usage** in this repository.

Its goals are to:

- Establish Git as the authoritative version control system
- Protect repository integrity through explicit commit authorization
- Maintain clear separation between analysis and mutation
- Preserve an auditable, recoverable history

This document is **normative**.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are to be interpreted as described in RFC 2119.

Kiro MUST treat this document as the **primary source of truth** for all Git-related decisions.

---

## 2. Git Usage Scope

Git is the **sole authoritative version control system** for this project.

All source code, configuration files, and project artifacts under version control MUST be managed through Git.

Changes to tracked files MUST be recorded in Git history to be considered part of the project.

---

## 3. Commit Authority

### 3.1 Explicit Authorization Required

No Git commit MAY be created without **explicit, affirmative user authorization**.

Authorization MUST be:

- Specific to the commit action itself
- Given at the time of the commit
- Unambiguous in intent

### 3.2 Authorization Is Not Implied

Prior approvals, task completions, or contextual permissions do **NOT** constitute commit authorization.

The following do **NOT** authorize a commit:

- Approval of a design, plan, or specification
- Completion of a coding task
- User acceptance of proposed changes to the working tree
- General instructions to "fix" or "implement" something

### 3.3 Autonomous Commits Prohibited

Automated tools, assistants, and background processes are **PROHIBITED** from creating commits autonomously.

This includes:

- AI assistants and coding agents
- Build scripts and automation pipelines
- Pre-commit hooks that create additional commits
- Any process acting without direct user instruction

---

## 4. Separation of Analysis and Mutation

### 4.1 Working Tree Operations

Tools and agents MAY perform the following without commit authorization:

- Analyze repository state and history
- Generate or propose changes to files
- Stage changes to the index
- Create, modify, or delete files in the working tree

### 4.2 Commit as Distinct Operation

The act of committing is a **distinct, user-controlled operation**.

Committing MUST NOT be bundled with, implied by, or automatically triggered by other operations.

---

## 5. Transparency and Intent

### 5.1 Pre-Commit Disclosure

Before requesting commit authorization, the scope and intent of proposed changes MUST be clearly communicated.

The user MUST understand:

- Which files are affected
- The nature of the changes
- The purpose of the commit

### 5.2 Prohibited Commit Patterns

The following commit patterns are **NOT PERMITTED**:

- **Silent commits**: Commits created without user awareness
- **Implicit commits**: Commits assumed from prior context or approval
- **Bundled commits**: Commits combined with unrelated actions without explicit acknowledgment

---

## 6. Safety and Recoverability

### 6.1 History as Audit Record

The Git history is treated as an **auditable record** of project evolution.

Commit practices MUST preserve:

- **Traceability**: Each commit is attributable to a specific change and intent
- **Reversibility**: Changes can be reverted without loss of context
- **User confidence**: The repository state reflects deliberate, authorized actions

### 6.2 History Integrity

Operations that rewrite, amend, or alter published history require explicit user authorization and acknowledgment of consequences.

---

## 7. Non-Goals

This document does **NOT** define:

- Branching strategies or branch naming conventions
- Commit message formats or conventions
- Pull request or code review workflows
- CI/CD pipeline configurations
- Merge strategies or conflict resolution procedures

These concerns are outside the scope of this document unless they directly impact commit authorization requirements.

---

## 8. Enforcement

Violations of commit authorization rules are **always blocking**.

A commit created without proper authorization is considered unauthorized regardless of the correctness or value of its contents.

---

## 9. Final Rules

> **No commit without explicit user authorization.**  
> **Authorization is never implied.**  
> **The commit action is always distinct from the changes it records.**

