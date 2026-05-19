---
description: Check whether a specific SDLC stage gate is PASSED before writing code
---

You will be given a stage number $ARGUMENTS.

Call `check_gate_status` with `stage: <number>`. If the tool returns isError:true (gate not passed), stop immediately, present the gate status to the user, read that stage's section via `read_sdlc_section` to list the missing artifacts, and ask how to proceed. Do not write any implementation code until the gate is PASSED.
