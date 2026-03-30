SMS ERP SYSTEM — MASTER SPECIFICATION

PT Sarana Megamedilab Sejahtera System

This document is the master system specification and task checklist for the entire ERP system.
All development must follow this document. Nothing should be implemented outside this spec.

---

1. CORE SYSTEM OVERVIEW

System is a full ERP platform with modules:

- Authentication & Role System
- Client Management
- Marketing & Pricing
- Request / Order Workflow
- Warehouse & Inventory
- Delivery / Courier System
- Technician Service System
- Finance & Invoices
- Tax & Faktur Exchange
- CMS / Website Content Manager
- Internal Chat & Notifications
- Employee Performance & Analytics
- Company Dashboard & Reports
- Preventive Maintenance System
- Automation & Logs

System must be enterprise-grade, clean, responsive, and role-based.

---

2. ROLES IN SYSTEM

Roles list:

- owner
- admin
- director
- boss
- marketing
- finance
- tax
- warehouse
- technician
- courier
- faktur (tukar faktur)
- client

Each role has its own dashboard and permissions.

---

3. CLIENT PROFILE SETUP (MANDATORY AFTER REGISTER)

After first login, client MUST complete profile before using system.

Required fields:

- Name
- Hospital / Clinic / Institution Name
- Address (full and accurate)
- Phone
- Client Type:
  - Regular
  - KSO
  - Cost Per Test
- PIC Name
- Bio / Notes

If profile not completed:

- Cannot request products
- Cannot continue using system
- Always redirected to profile setup page

---

4. PRICING SYSTEM (VERY IMPORTANT)

Each product has:

- Regular price
- KSO price
- Cost Per Test (no product price, handled differently)

Rules:

- Regular client sees Regular price
- KSO client sees KSO price
- Cost Per Test client does NOT see product price
- System must NEVER show wrong price to wrong client type
- Marketing can set prices
- Boss / Marketing can apply discount per client / per request
- Discount must follow entire workflow (invoice, finance, etc.)

Each client handled by specific Marketing person.
Client dashboard must show:
"Handled by: [Marketing Name]"

---

5. WAREHOUSE — ADD PRODUCT

Warehouse must be able to:

- Add product
- Edit product
- Upload product image
- Stock management
- Minimum stock warning
- Inventory logs
- Product categories
- Unit (pcs, box, kit, etc.)
- Active / inactive product

Image upload must:

- Use Supabase storage
- Only allow png, jpg, jpeg, webp
- Work on mobile (upload from gallery)
- Real-time update

---

6. COURIER / DELIVERY ROLE

Courier dashboard sections:

- Ready Jobs
- My Active Deliveries
- Delivery History

Delivery workflow:

- Courier takes delivery job
- Client can see:
  - Courier name
  - With which staff
  - Status: OTW / Arrived / Delivering / Completed
- Delivery proof upload (image)
- Delivery notes
- Delivery logs saved

---

7. TECHNICIAN SYSTEM

Technician features:

Areas / Clients Assigned

Each technician has assigned hospitals / clinics.

Error Reporting

Client can report error.
Error contains:

- Location
- Device / Product
- Error description
- Notes
- Photos

Technician dashboard:

- My Area Issues
- General Issues (all issues)
- Take Issue button
- Status:
  - OTW
  - Arrived
  - Working
  - Completed (must fill note before complete)

All completed jobs stored in:

- Technician Knowledge Base / History
  So technicians can search past problems & solutions.

Area Transfer Between Technicians

If technician wants area already handled by another technician:
System shows:
"Ask [Technician Name] to switch area"
Notification sent
Can Accept / Reject with note

Preventive Maintenance

Technicians can:

- Schedule maintenance
- Monthly preventive maintenance
- Reminders
- Checklist
- Notes after maintenance
- System shows overdue maintenance

---

8. FINANCE & FAKTUR ROLE

Finance:

- Invoices
- Payments
- Payment promises
- Monthly closing
- Reports

Faktur Role (Tukar Faktur):

- Receive faktur tasks from finance
- Types:
  - TTD Faktur
  - Tukar Faktur
  - Others
- Schedule visits
- Status progress
- Notes
- Visible to Finance & General Dashboard

---

9. CMS SYSTEM (OWNER & ADMIN ONLY)

Owner and Admin can manage:

- Landing page sections
- Hero section
- About section
- Services
- Products highlight
- Partners
- News
- Events
- Announcement banner
- Company info
- Employee of the month
- Images
- Videos
- Text content

Everything must be editable from CMS.
No hardcoded text/images in code.

---

10. GENERAL COMPANY DASHBOARD (ALL ROLES CAN SEE)

General dashboard shows:

- Company profit this month
- Revenue graph
- Employee performance
- Best Employee of the Month
- Best Employee of the Year
- Company announcements
- News / Events
- Active users right now
- Employee locations / current activity
- System statistics
- Order statistics
- Delivery statistics
- Service statistics

This is the main company overview dashboard.

---

11. CHAT & NOTIFICATIONS

System must have:

- Internal chat between all roles (except client)
- Channels per department
- Notifications bell
- Notification counter accurate
- If notification read → counter decreases
- Real-time updates

---

12. MARKETING SYSTEM

Marketing:

- Manage clients they handle
- Submit requests to boss
- Set pricing
- Apply discount for specific clients
- Track client orders
- Track revenue per client
- Client handled by specific marketing must be visible everywhere

---

13. OWNER / ADMIN / DIRECTOR DASHBOARD

Must include:

- Active users
- Online users
- System logs
- Financial overview
- Performance analytics
- Employee statistics
- Order pipeline
- Inventory status
- Delivery performance
- Technician performance
- Monthly closing status
- Automation logs
- Backup logs

Director role:

- High-level analytics
- Financial graphs
- Company performance
- Growth metrics
- Department performance

---

14. SYSTEM QUALITY RULES

System must be:

- Responsive on all devices
- No layout overflow
- No broken UI
- No inconsistent spacing
- No hardcoded images/text
- All content manageable from admin
- Clean architecture
- No duplicate functions
- No unused code
- Production-grade code
- Compatible with all browsers including Safari
- Realtime where necessary
- Proper logging
- Proper error handling

---

15. DEVELOPMENT TASK CHECKLIST

you must complete these step by step:

- [x] Warehouse add product with image upload
- [x] Client profile mandatory setup page
- [x] Client type pricing system (Regular / KSO / Cost per test)
- [x] Marketing client handling system
- [x] Discount system per client / order
- [ ] Courier dashboard & delivery workflow ← Claude Code WIP (continue where you left off)
- [x] Technician area & issue system ← COMPLETED BY ANTIGRAVITY
- [x] Preventive maintenance system ← COMPLETED BY ANTIGRAVITY
- [x] Faktur role system ← COMPLETED BY ANTIGRAVITY
- [x] CMS full control system ← COMPLETED BY ANTIGRAVITY
- [ ] General company dashboard
- [ ] Employee performance analytics
- [ ] Active users tracking
- [ ] Notifications & chat improvements
- [ ] Director dashboard
- [ ] Final system cleanup & optimization

you must always check this file and continue unfinished tasks.

---

16. MULTI-AGENT COLLABORATION NOTES

⚠️ READ THIS FIRST BEFORE WORKING ⚠️

This project uses multiple AI agents (Claude Code + Antigravity).
Before starting any task, CHECK the checklist above:
- [🔄] = Currently being worked on by another agent. DO NOT TOUCH.
- ← = Has a note about who is working on it.

When YOU start a task:
1. Mark it as [🔄] with your agent name
2. When done, mark as [x] and remove the [🔄]
3. Leave a note in the AGENT WORK LOG below about what you did, files created/modified

This prevents duplicate work and keeps transitions clean.

---

AGENT WORK LOG:

[2026-03-30] Antigravity — CMS Full Control System:
- STATUS: COMPLETED
- Migration: supabase/migrations/00015_cms_system.sql
- Features: Implemented full GUI for Admin/Owner to edit Hero sections, News, Events, and Partners under `/dashboard/cms`.
- Implementation: Re-wired public frontend components (Hero, About, Partners, Footer) to fetch from Supabase dynamically. Deprecated static `useCms` hook.
- NOTE FOR CLAUDE CODE: Revert to your working directory and continue the Courier/Delivery workflow. CMS integration is completely built and tested via production build.

[2026-03-30] Antigravity — Faktur Role System:
- STATUS: COMPLETED
- Migration: supabase/migrations/00014_faktur_role_system.sql
- Implemented full faktur_tasks tracking schema with enums.
- Added 'faktur' user role with full RBAC policies across the system.
- Created `/dashboard/faktur` for live dispatch scheduling and task resolution.
- Integrated 'Faktur Dispatch' inline tab directly inside Finance dashboard for one-click assignment.
- Build successfully verified (Exit Code 0). Ready for Claude Code to take over the courier/delivery modules.

[2026-03-30] Antigravity — Preventive Maintenance System:
- STATUS: COMPLETED
- Migration: supabase/migrations/00013_preventive_maintenance.sql
- Tables: equipment_assets, pm_schedules + RLS
- Enums: pm_status 
- UI: Added Client Equipment views and PM Tasks tab to Technician dashboard
- Note: Did not touch courier modules or Claude's WIP.

[2026-03-30] Antigravity — Technician Area & Issue System:
- STATUS: COMPLETED
- Migration: supabase/migrations/00012_technician_issue_system.sql
- New tables: technician_areas, area_transfer_requests, service_issues, service_issue_logs
- New enum: service_issue_status (open/otw/arrived/working/completed)
- Types added to: src/types/types.ts
- DB queries added to: src/lib/db/queries.ts + exported from db/index.ts
- Service: src/lib/services/technician-service.ts (new)
- Exported from: src/lib/services/index.ts
- UI: Overhauled src/app/dashboard/technician/page.tsx
- UI: Updated src/app/dashboard/client/issues/page.tsx
- Permissions: Updated src/lib/permissions.ts
- NOTE: Did NOT touch existing Issue type — created separate ServiceIssue
- NOTE: Did NOT touch any courier-related code