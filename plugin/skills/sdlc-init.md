---
description: Initialize a new project by copying the SDLC_VALIDATION.md template into the current project root
---

Call `init_project` with `project_root` set to the current working directory.

If the file is created successfully, immediately call `get_project_identity` to confirm it loaded, then tell the user:
1. The file has been created at their project root
2. They should now describe their project (what it does, who uses it, must-have features for v1) so you can fill in Section 1 (Project Identity)
3. No code will be written until Stage 1 is PASSED

If the file already exists, report that and ask if they want to run `/sdlc-status` instead.
