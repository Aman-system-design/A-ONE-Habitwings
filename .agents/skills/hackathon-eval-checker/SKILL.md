---
name: hackathon-eval-checker
description: >-
  Audits the workspace before deployment to ensure all hackathon evaluation criteria (Code Quality, Security, Efficiency, Testing, Accessibility) are met, checks for GitHub remote configuration, validates README sections, and runs local tests.
---

# Hackathon Evaluation Checker

## Overview
This skill provides an automated pre-deployment auditor that scans your project files, Git remote repository, README sections, security leaks, accessibility compliance, and test suites. It compiles a structured markdown report (`audit_report.md`) detailing compliance with High, Medium, and Low Impact evaluation guidelines.

## Quick Start
Run the checker from the project root:
```bash
python .agents/skills/hackathon-eval-checker/scripts/verify_deployment.py verify
```

To output the details to a custom report file:
```bash
python .agents/skills/hackathon-eval-checker/scripts/verify_deployment.py verify --output audit_report.md
```

## Utility Scripts
The skill is driven by a Python validator script located at:
`[verify_deployment.py](file:///.agents/skills/hackathon-eval-checker/scripts/verify_deployment.py)`

### Commands
- `verify`: Runs all verification subroutines (Git Remote, README, Security, Accessibility, and Test execution) and calculates the final compliance scores.
  - `--output`: *(Optional)* Path to write the detailed markdown audit report.

## Common Mistakes
- **Running from wrong directory**: Ensure you run the command from the root of the project so paths to `package.json`, `README.md`, and `src/` are parsed correctly.
- **Unstaged changes**: Make sure you stage and commit all modified files in git before running verification so the Git Status check passes.
- **API Key Leak**: Do not write your Google AI Studio keys directly in source files; set them strictly in Vercel or local `.env` variables. The scanner will detect and block any keys beginning with `AIzaSy`.
