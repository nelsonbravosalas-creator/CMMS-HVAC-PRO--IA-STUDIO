# Security Specification - CMMS NBYB

## Data Invariants
1. A team (Equipo) must have a unique TAG and an ownerId matching the creator.
2. A ticket must be linked to a valid equipment TAG and have an ownerId matching the creator.
3. User profiles (users/{userId}) can only be managed by the user themselves.

## The "Dirty Dozen" Payloads (Deny Cases)
1. **Identity Spoofing**: Attempt to create an equipment with `ownerId` of another user.
2. **Ghost Update**: Attempt to update an equipment adding `isAdmin: true`.
3. **ID Poisoning**: Attempt to create an equipment with a document ID of 2KB.
4. **Terminal State Bypass**: Attempt to update a "Baja" (Terminal) equipment back to "Operativo".
5. **PII Leak**: Attempt to read user profile `users/anotherUser` as a guest.
6. **Cross-User Leak**: Attempt to list tickets where `ownerId != currentUserId`.
7. **Type Poisoning**: Sending `horasOperacion` as a string instead of a number.
8. **Size Attack**: Sending a 1MB string in the `notas` field.
9. **Role Escalation**: User `perfil: "visita"` trying to create an equipment.
10. **Orphaned Write**: Creating a ticket for a non-existent equipment TAG. (Note: Relational check)
11. **Timestamp Spoofing**: Sending a client-side `updatedAt` instead of `request.time`.
12. **Shadow Field**: Adding a `internal_rating` field not defined in the schema.

## Test Runner (Draft)
A comprehensive test suite would involve @firebase/rules-unit-testing to verify each case.
