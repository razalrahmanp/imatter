---
name: sdlc-gate
description: Use when about to write code for an SDLC stage, or when the user asks about a gate's status — checks whether the gate is PASSED and lists missing artifacts if not.
---

You will be given a stage number $ARGUMENTS.

Call `check_gate_status` with `stage: <number>`. If the tool returns isError:true (gate not passed), stop immediately, present the gate status to the user, read that stage's section via `read_sdlc_section` to list the missing artifacts, and ask how to proceed. Do not write any implementation code until the gate is PASSED.
