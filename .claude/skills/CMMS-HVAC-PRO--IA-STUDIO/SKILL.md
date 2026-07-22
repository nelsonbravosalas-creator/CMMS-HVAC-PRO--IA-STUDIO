```markdown
# CMMS-HVAC-PRO--IA-STUDIO Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the CMMS-HVAC-PRO--IA-STUDIO TypeScript codebase. It covers file naming, import/export styles, commit conventions, and testing patterns, providing practical examples and step-by-step workflows to streamline development and collaboration.

## Coding Conventions

### File Naming
- **Pattern:** `snake_case`
- **Example:**  
  ```plaintext
  hvac_controller.ts
  maintenance_schedule.ts
  ```

### Import Style
- **Pattern:** Relative imports
- **Example:**
  ```typescript
  import { getStatus } from './status_utils';
  import { MaintenanceTask } from '../models/maintenance_task';
  ```

### Export Style
- **Pattern:** Named exports
- **Example:**
  ```typescript
  // In maintenance_task.ts
  export function scheduleTask(task: MaintenanceTask) { ... }
  export const TASK_TYPES = ['inspection', 'repair'];
  ```

### Commit Patterns
- **Type:** Freeform (no enforced prefix)
- **Average Length:** 71 characters
- **Example:**
  ```
  Add new endpoint for HVAC system diagnostics
  ```

## Workflows

### Adding a New Feature
**Trigger:** When implementing a new feature or module  
**Command:** `/add-feature`

1. Create a new file using `snake_case` (e.g., `new_feature.ts`).
2. Implement the feature using relative imports for dependencies.
3. Export functions or constants using named exports.
4. Write corresponding tests in a `*.test.ts` file.
5. Commit changes with a clear, descriptive message.

### Writing and Running Tests
**Trigger:** When validating new or existing code  
**Command:** `/run-tests`

1. Create or update test files matching the pattern `*.test.ts`.
2. Implement test cases for all exported functions and modules.
3. Run the test suite using the project's test runner (framework unknown; check project docs or package scripts).
4. Review and fix any failing tests before committing.

### Refactoring Code
**Trigger:** When improving code readability or structure  
**Command:** `/refactor`

1. Identify files or modules needing improvement.
2. Rename files using `snake_case` if necessary.
3. Update import paths to maintain relative import style.
4. Ensure all exports remain named.
5. Update or add tests as needed.
6. Commit with a descriptive message summarizing the refactor.

## Testing Patterns

- **Test File Pattern:** Files are named with the `*.test.ts` pattern.
- **Framework:** Not explicitly detected; check project documentation for specifics.
- **Example:**
  ```typescript
  // In maintenance_task.test.ts
  import { scheduleTask } from './maintenance_task';

  describe('scheduleTask', () => {
    it('should schedule a task correctly', () => {
      // test implementation
    });
  });
  ```

## Commands
| Command       | Purpose                                   |
|---------------|-------------------------------------------|
| /add-feature  | Scaffold and implement a new feature      |
| /run-tests    | Run the test suite for the codebase       |
| /refactor     | Refactor code following conventions       |
```
