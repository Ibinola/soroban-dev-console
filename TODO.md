# TODO - BE-320 Workspace mutation API boundary

- [ ] Step 1: Inspect remaining workspace-related modules for event consumers/side effects assumptions.
- [ ] Step 2: Implement mutation boundary in `apps/api/src/modules/workspaces/` (refactor WorkspacesService to separate DB mutation from side effects).
- [ ] Step 3: Keep external API stable (controller routes + response payloads).
- [ ] Step 4: Add/adjust unit tests validating:
  - stale revision rejection remains correct
  - side effects (DomainEventBus + AuditService) are invoked via the new boundary
- [ ] Step 5: Run test/build for affected packages (api).

