# RBAC Rules

## Core Rule
All permission enforcement is server-side.

## Mandatory Controls
- APIs and Server Actions must enforce role checks before data access.
- Service layer methods must assume hostile clients and validate authorization.
- Client-side checks are non-authoritative.

## Architecture Sequence
Frontend -> API/Server Action -> RBAC middleware -> Service layer -> Database
