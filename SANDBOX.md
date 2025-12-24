# E2B Sandbox Lifecycle & API Documentation

This document describes how sandboxes are created, managed, and persisted in the system using the `e2b_code_interpreter` package.

## Overview

The service uses `AsyncSandbox` to provide isolated environments for code execution, keyed by `project_id` or `chat_id`.

## Sandbox Lifecycle

### 1. Creation on Demand

Sandboxes are created when a project/chat requires one. The `Service.get_e2b_sandbox(id)` method handles this:

- **Template**: Uses a predefined `TEMPLATE_ID`.
- **Timeout**: Default creation timeout is 30 minutes (1800s).
- **Initialization**:
  ```python
  self.sandboxes[id] = await AsyncSandbox.create(template=TEMPLATE_ID, timeout=1800)
  ```

### 2. Management & Reuse

To optimize performance, sandboxes are cached in memory:

- **Reuse**: If a valid sandbox exists in `self.sandboxes`, its timeout is extended using `set_timeout(1800)`.
- **Expiry**: If a sandbox is expired or its last access exceeds `self.sandbox_timeout`, it is killed (`await sandbox.kill()`) and a new one is created.

### 3. State Persistence (Snapshot & Restore)

Project files are synchronized between local storage and the sandbox:

- **Restore**: On creation, `_restore_files_from_disk` writes files from the `projects/{id}` directory to the sandbox using `await sandbox.files.write(path, content)`.
- **Snapshot**: `snapshot_project_files` reads files from the sandbox and persists them to disk to ensure state is not lost when the sandbox is killed.

## Key Behaviors

- **In-Memory Storage**: `self.sandboxes: Dict[str, AsyncSandbox]` tracks active sessions.
- **Port Mapping**: The sandbox provides host access via `get_host(port=...)`.
- **Command Execution**: Uses `sandbox.commands.run(...)` for terminal operations.

## Repository Locations

- **Lifecycle Logic**: `service.py:1-120`
- **Sandbox Tools**: `tools.py:1-120`
- **State Integration**: `graph_nodes.py`, `graph_state.py`
- **Config**: `e2b.toml`
