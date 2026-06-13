# Workflow Semantics

Status: Partial.

`packages/doctor-workflow` defines local durable workflow concepts: runs, checkpoints, signals, human tasks, retry policy, idempotency keys, in-memory storage, and SQLite storage.

The current worker app exposes the local worker surface. It proves restart/resume storage semantics without introducing Temporal, queues, or production infrastructure.
