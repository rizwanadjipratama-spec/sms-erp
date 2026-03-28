# CLAUDE.md
## System Architecture & Engineering Guidelines

You are working on a large-scale ERP system built with:
- Next.js
- TypeScript
- Supabase
- PostgreSQL
- Row Level Security
- Workflow Engine
- Inventory Management
- Invoice System
- Notification System
- Analytics Dashboard

This is not a small project.
This system must be built as a production-grade enterprise system similar in quality to Oracle, SAP, or large internal enterprise platforms.

The goal is to build a system that is:
- Stable
- Scalable
- Secure
- Fast
- Maintainable
- Clean architecture
- No duplicated logic
- No unused code
- No memory leaks
- No slow queries
- No conflicting logic
- No inconsistent schema
- No UI lag
- No broken workflows
- No RLS violations
- No database mismatch
- No warnings
- No runtime errors

This system must be able to handle thousands of concurrent users.

--------------------------------------------------
SYSTEM ENGINEERING PHILOSOPHY
--------------------------------------------------

Always think like a senior software engineer and system architect.

Before writing any code:
1. Understand the system
2. Understand the database
3. Understand the workflow
4. Understand the existing architecture
5. Identify dependencies
6. Design the correct solution
7. Then implement
8. Then review performance
9. Then review security
10. Then review scalability

Never implement quick hacks.
Never implement temporary fixes.
Always implement proper solutions.

Fix root causes, not symptoms.

--------------------------------------------------
SYSTEM ARCHITECTURE LAYERS
--------------------------------------------------

The system must always follow this architecture:

UI Layer (React / Next.js)
Service Layer (Business logic)
Workflow Engine (Status transitions / business rules)
Database Layer (Supabase / PostgreSQL)

Flow:
UI → Service → Workflow Engine → Database

Rules:
- UI must NEVER directly query Supabase
- UI must call service functions
- Services handle business logic
- Workflow engine handles status transitions
- Database only stores data and triggers

--------------------------------------------------
DATABASE RULES
--------------------------------------------------

All tables MUST follow this structure:

- id uuid primary key
- created_at timestamptz default now()
- updated_at timestamptz
- created_by uuid (if applicable)
- updated_by uuid (if applicable)

Always use timestamptz, never timestamp.

All foreign keys must be indexed.
All status columns must be indexed.
All frequently queried columns must be indexed.

Never store duplicated data.
Use relational structure properly.
Maintain referential integrity.

Every schema change must be accompanied by SQL migration.
Database schema must always match TypeScript types.

--------------------------------------------------
ROW LEVEL SECURITY (RLS)
--------------------------------------------------

RLS policies must be:
- Simple
- Non-overlapping
- Role-based
- Consistent with workflow permissions
- Never conflicting
- Never blocking legitimate operations
- Never allowing unauthorized access

Every time a new feature touches database access:
- Review RLS
- Update policies
- Test with each role
- Ensure no "row level security violation"

--------------------------------------------------
WORKFLOW ENGINE
--------------------------------------------------

Orders must follow strict workflow transitions.

Allowed order status flow:

submitted
priced
approved
invoice_ready
preparing
ready
on_delivery
delivered
completed
issue
resolved

Each role can only perform specific transitions.

Workflow logic must be centralized.
Never change order status directly from UI.
Always go through workflow engine.

Workflow engine must validate:
- Current status
- Target status
- User role
- Business rules
- Required data (price, invoice, stock, etc.)

--------------------------------------------------
CODE QUALITY RULES
--------------------------------------------------

All code must be:

- Modular
- Typed
- Reusable
- Maintainable
- Readable
- Consistent
- No duplicated logic
- No dead code
- No unused variables
- No console logs in production
- Proper error handling
- Proper loading states
- Proper empty states
- Proper edge case handling

File rules:
- One file = one responsibility
- Avoid very large files
- Split logic into services and modules
- Use clear naming
- Avoid magic numbers
- Avoid hardcoded values
- Use constants and enums

--------------------------------------------------
PERFORMANCE RULES
--------------------------------------------------

The system must be very fast and responsive.

Avoid:
- Fetching unnecessary data
- N+1 queries
- Full table scans
- Heavy logic in React render
- Large unpaginated queries
- Unindexed queries
- Re-render loops
- Memory leaks
- Unnecessary state updates
- Blocking operations on UI

Always:
- Use pagination
- Use indexes
- Select only required columns
- Use memoization where needed
- Move heavy logic to backend/services
- Optimize dashboard queries
- Cache analytics queries
- Use efficient joins
- Avoid repeated API calls
- Batch operations when possible

--------------------------------------------------
SECURITY RULES
--------------------------------------------------

Security must be considered at all times.

- All database access protected by RLS
- Validate all inputs
- Never trust client input
- Use role-based permissions
- Prevent unauthorized workflow transitions
- Prevent data leaks
- Prevent privilege escalation
- Log important actions
- Maintain audit logs
- Protect file storage access
- Use secure environment variables

--------------------------------------------------
UI / UX RULES
--------------------------------------------------

UI must be:
- Clean
- Consistent
- Professional
- Responsive
- Fast
- No layout shift
- No flicker
- Proper loading skeletons
- Proper empty states
- Proper error states
- Consistent spacing
- Consistent typography
- Consistent colors
- Clear hierarchy
- Easy navigation
- Dashboard must be readable and fast

--------------------------------------------------
SYSTEM STABILITY RULES
--------------------------------------------------

Before finishing any feature, always verify:

- Database schema updated
- SQL migration created
- TypeScript types updated
- Services updated
- Workflow updated
- RLS policies updated
- UI updated
- Notifications updated
- Logs updated
- No TypeScript errors
- No console errors
- No warnings
- No unused code
- No duplicated logic
- No performance issues

The system must remain clean, stable, and consistent at all times.

--------------------------------------------------
ENGINEERING MINDSET
--------------------------------------------------

Always think:

- Will this break other features?
- Is this scalable?
- Is this secure?
- Is this maintainable?
- Is this efficient?
- Is this consistent with architecture?
- Is the database schema correct?
- Are RLS policies correct?
- Are indexes needed?
- Is this the best long-term solution?

Do not aim to just make features work.
Aim to build a stable, scalable enterprise system.

This project must be built like a world-class enterprise system.