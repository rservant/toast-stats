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

## 🗓️ 2026-02-22 — Lesson 03: Validation Gaps in Façade Layers

**The Discovery**: `SnapshotStore.hasDistrictInSnapshot` used `path.join` with raw `districtId` input, creating a path traversal vulnerability (CodeQL #57). The downstream modules (`SnapshotReader`, `SnapshotWriter`) already validated `districtId`, but the façade method bypassed them with inline `path.join`.

**The Scientific Proof**: A test with 7 malicious `districtId` values (e.g., `../../etc/passwd`) was not rejected — all resolved to `false` instead of throwing, proving the vulnerability existed.

**The Farley Principle Applied**: Defense in Depth. Validation must happen at every layer that constructs paths, not just internal modules.

**The Resulting Rule**: When a façade delegates to sub-modules, any method that constructs paths directly (rather than delegating) must also call the shared validation utilities (`validateDistrictId`, `resolvePathUnderBase`).

**Future Warning**: If a new method is added to `SnapshotStore` that accepts `districtId` or `snapshotId` and constructs paths inline, it must validate inputs. Audit all `path.join` calls using user-supplied values.

---

## 🗓️ YYYY-MM-DD — Lesson 02: Handling Asynchronous Side-Effects

**The Discovery**: The EmailNotifier was firing inside the main OrderProcessing loop. If the email provider was slow, the entire checkout process hung.

**The Hypothesis**: Moving the notification to an Event-Driven model (Pub/Sub) would reduce checkout latency by 80%.

**The Measurement**: Verified via `time` command in the Antigravity terminal; latency dropped from 2.4s to 0.3s.

**The Farley Principle Applied**: Favor Asynchronous Feedback Loops.

**The Resulting Rule**: Business logic should emit events; side-effects (Email, Analytics) should listen to them. Do not couple the "Success" of a transaction to the "Success" of a notification.

---

## 🗓️ YYYY-MM-DD — Lesson 01: Architectural Decoupling in [Project Name]

**The Discovery**: The UserAuth service was directly importing the PostgresClient. This created a "Circular Dependency" risk and made unit testing impossible without a live database.

**The Scientific Proof**: An experiment in `tasks/experiment_01.md` showed that mocking the database required mocking the entire `pg` library, which is a "Fragile Test" anti-pattern.

**The Farley Principle Applied**: Separation of Concerns. We introduced an `IUserRepository` interface.

**The Resulting Rule**: From now on, services must depend on Interfaces, not Implementations. This allows for high-speed, deterministic unit tests.

**Future Warning**: If you see a service importing a raw database driver, STOP and refactor to an Interface/Repository pattern first.
