# 📚 Lessons Learned

<!-- Each lesson follows this structure. Newest entries go at the top. -->
<!-- The agent reads the last 5 entries before starting any task. -->

<!--
## 🗓️ [YYYY-MM-DD] — Lesson NN: [Title]

**The Discovery**: [What unexpected behavior or coupling was found]

**The Scientific Proof**: [How the hypothesis was tested — link to experiment if applicable]

**The Farley Principle Applied**: [Which engineering principle this reinforces]

**The Resulting Rule**: [The new rule or constraint going forward]

**Future Warning**: [What to watch for — a tripwire for the agent]
-->

---

## 🗓️ 2026-02-22 — Lesson 01: Validation Gaps in Façade Layers

**The Discovery**: `SnapshotStore.hasDistrictInSnapshot` used `path.join` with raw `districtId` input, creating a path traversal vulnerability (CodeQL #57). The downstream modules (`SnapshotReader`, `SnapshotWriter`) already validated `districtId`, but the façade method bypassed them with inline `path.join`.

**The Scientific Proof**: A test with 7 malicious `districtId` values (e.g., `../../etc/passwd`) was not rejected — all resolved to `false` instead of throwing, proving the vulnerability existed.

**The Farley Principle Applied**: Defense in Depth. Validation must happen at every layer that constructs paths, not just internal modules.

**The Resulting Rule**: When a façade delegates to sub-modules, any method that constructs paths directly (rather than delegating) must also call the shared validation utilities (`validateDistrictId`, `resolvePathUnderBase`).

**Future Warning**: If a new method is added to `SnapshotStore` that accepts `districtId` or `snapshotId` and constructs paths inline, it must validate inputs. Audit all `path.join` calls using user-supplied values.
