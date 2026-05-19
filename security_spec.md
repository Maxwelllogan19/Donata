# Security Specification - RentMaster

## Data Invariants
1. An equipment item must have a name, unitPrice > 0, and totalStock >= 0.
2. A rental must have a customerName, startDate, endDate, and at least one item.
3. Every document MUST have an `ownerId` matching the authenticated user's UID.
4. `ownerId` is immutable once created.
5. All amounts (subtotal, discount, totalAmount) must be numbers.

## The Dirty Dozen Payloads (Target: DENIED)
1. Create equipment with a different `ownerId`.
2. Create rental with empty items list.
3. Update someone else's equipment.
4. Update equipment's `ownerId` to a different UID.
5. List someone else's rentals.
6. Create rental with negative total amount.
7. Inject 1MB string into equipment name.
8. Delete someone else's equipment.
9. Create rental where `totalAmount` != `subtotal - discount`.
10. Update rental status from 'returned' to 'pending' (terminal state lock test - though returned isn't fully terminal, completed is).
11. Read a specific rental without being authenticated.
12. Create equipment without `ownerId` field.

## Security Rules Implementation Strategy
- Use `isValidId()` for all document IDs.
- Use `isValidEquipment()` and `isValidRental()` helpers for all writes.
- Enforce `ownerId` integrity on all operations.
- Enforce size limits on all string fields.
