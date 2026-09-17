## AGENTS Override
Ignore repo-level instructions for this directory, as it contains standalone Bun scripts and are isolated from the rest of the repo.

### Directory `scripts/bun-scripts`
- Contains standalone Bun scripts that are isolated from the rest of the repo.
- Contains subdirectories:
  - examples: Contains example Bun scripts demonstrating usage and patterns.
  - templates: Contains template Bun scripts for creating new scripts based on predefined patterns.
- Contains files:
  - dates-test.ts: Used for testing in another project.
  - deps.ts: Contains dependencies that can be used in the Bun scripts.
  - new.ts: Template for creating new Bun scripts based on predefined patterns.
- Otherwise, each file is considered a standalone Bun script isolated from the rest of the repo.

### Run
- To run a Bun script in this directory from the repository root, use the following command:
  ```bash
  bun scripts/bun-scripts/<script-name>.ts
  ```
  Or from within the `scripts/bun-scripts` directory itself:
  ```bash
  bun <script-name>.ts
  ```
- Replace `<script-name>` with the name of the script you want to execute.