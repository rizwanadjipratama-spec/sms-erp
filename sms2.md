sms2.md — ORION ERP SYSTEM SPECIFICATION & AGENT RULES
PROJECT: ORION ENTERPRISE SYSTEM
ORION adalah sistem Enterprise Resource Planning + Service + Logistics + Finance + Multi Branch Management yang mengelola seluruh operasional perusahaan dalam satu sistem.
Tujuan system:
Semua barang ke-track
Semua uang ke-track
Semua service ke-track
Semua delivery ke-track
Semua cabang terpisah tapi dalam satu sistem
Semua aktivitas bisa diaudit
Sistem scalable untuk banyak cabang
Tidak ada data yang hilang atau tidak tercatat
Rule utama:
Jika tidak tercatat di sistem, berarti tidak terjadi.
1. CORE SYSTEM RULES (WAJIB)
Rules ini tidak boleh dilanggar oleh developer atau agent manapun.
Semua transaksi harus punya branch_id
Semua transaksi harus punya created_by
Semua transaksi penting harus punya approval
Semua perubahan status harus masuk activity_logs
Semua uang masuk/keluar harus masuk financial_transactions
Semua perubahan stock harus masuk inventory_logs
Semua delivery harus punya delivery_team
Semua issue harus punya issue_logs
Semua claim harus punya ledger / running balance
Setiap bulan harus ada financial closing
Tidak boleh delete transaksi → hanya cancel / reverse
Role permission harus ketat
Data antar cabang tidak boleh bocor
Semua sistem harus audit-able
Semua upload file harus validasi file type
Semua sistem harus responsive dan mobile compatible
Semua workflow harus pakai status flow
Semua perubahan database harus lewat migration
Tidak boleh duplicate table atau duplicate logic
Semua system harus pakai branch-based access
2. REGION & BRANCH SYSTEM
System harus support multi region dan multi branch.
Region
Indonesia
Asia (future)
Europe (future)
Branch Indonesia
Bogor
Purwokerto
Cirebon
Rules Branch
Semua user punya branch_id
Semua client punya branch_id
Semua transaksi punya branch_id
Warehouse hanya lihat stock branch sendiri
Technician hanya lihat job branch sendiri
Courier hanya lihat delivery branch sendiri
Marketing hanya lihat client branch sendiri
Data antar branch tidak boleh terlihat
Kecuali Owner, Admin (global access)
3. PROFILE SYSTEM
User wajib setup profile sebelum bisa menggunakan sistem.
Field wajib:
Name
Company / RS / Klinik / Lab
Address lengkap
City
Province
Phone
PIC Name
Client Type
Branch
Client Type:
Regular
KSO
Cost Per Test
Jika profile belum lengkap:
Tidak bisa request
Tidak bisa order
Tidak bisa submit apapun
Gunakan:

profile_completed = true/false
4. NAVBAR & UI RULES
Navbar layout:

[ LOGO ]     About   Products   Services   Contact     [🔔] [Profile Pic]
Rules:
Logo kiri
Menu tengah
Notification + Profile kanan
Tidak ada tombol Sign Out di navbar
Sign Out ada di dropdown profile
Profile dropdown:
My Profile
Settings
Region / Branch
Language
Notifications
Help
Sign Out
5. PRODUCT & STOCK PER BRANCH
Products tidak punya stock global.
Struktur:
products (master)
product_branch_stock
inventory_logs
stock_transfer_between_branches
Per branch:
Stock beda
Harga beda
Availability beda
Harga per client type:
price_regular
price_kso
price_cost_per_test
Client hanya boleh lihat harga sesuai type mereka.
6. REQUEST / ORDER FLOW
Flow request:

Client submit request
→ Marketing price
→ Boss approve
→ Finance create invoice
→ Warehouse prepare items
→ Delivery created
→ Delivery assigned
→ Delivered
→ Client confirm
→ Completed
Status request:
submitted
priced
approved
invoice_ready
preparing
ready
on_delivery
delivered
completed
cancelled
rejected
7. DELIVERY & FAKTUR TRACKING SYSTEM
Semua role boleh:
Delivery
Tukar faktur
Kecuali:
Owner
Admin
Boss
Delivery harus bisa track:
Invoice number
Client
Barang
Dikirim oleh siapa
Tanggal
Status
Proof foto
Tanda tangan client
Struktur delivery:
deliveries
delivery_items
delivery_team
delivery_status_logs
delivery_proofs
Delivery team:

delivery_id
user_id
role
Finance harus bisa lihat siapa yang bawa invoice dan barang.
8. ISSUE / ERROR / TECHNICIAN SYSTEM
Flow issue:

Client report error
→ Issue dibuat
→ Assigned technician
→ Status progress
→ Technician lain bisa join
→ Completed + report
→ Masuk knowledge base
Status issue:
reported
assigned
on_the_way
arrived
working
waiting_parts
testing
completed
cancelled
Issue bisa dikerjakan beberapa teknisi:
Primary technician
Supporting technicians
Client bisa lihat progress issue.
General dashboard juga bisa lihat semua issue.
9. GENERAL DASHBOARD (OPERATIONS CENTER)
General dashboard isi:
Open Issues
Active Deliveries
Requests Pipeline
Employee Performance
Best Employee Month
Company News
Announcements
Active Users
Branch Activity
Revenue
Stock Alerts
General dashboard bisa dilihat:
Client
Technician
Internal roles
10. MARKETING CLIENT SYSTEM
Marketing pegang client masing-masing.
Contoh:
RS Hermina → Marketing Ritha
RS PMI → Marketing Anton
Marketing bisa:
Submit request
Set discount client
Handle client
Boss bisa lihat:
Marketing handle berapa client
Marketing performance
11. COURIER SYSTEM
Courier dashboard:
Ready Deliveries
My Active Delivery
Delivery History
Upload Proof
Delivery Route
Delivery bisa dibawa:
Courier
Technician
Marketing
Manager
Warehouse
Finance
Faktur
Purchasing
Claim Officer
12. PURCHASING SYSTEM (UNTUK BARANG DIJUAL / INVENTORY)
Purchasing tugas:
Beli reagen
Beli consumables
Beli barang stock
Beli barang untuk dijual
Flow:

Warehouse / Marketing / Manager request barang
→ Purchase Request
→ Approval
→ Purchasing buat PO
→ Barang datang
→ Masuk inventory
→ Supplier invoice
→ Finance bayar
Purchasing tidak mengurus expense claim.
13. CLAIM / OPERATIONAL EXPENSE SYSTEM
Claim officer mengurus:
Bensin
Tol
Parkir
Tools kecil
Sparepart kecil
Hotel
Konsumsi
Service mobil
Operasional
Flow:

User submit claim
→ Approval
→ Masuk Claim Officer
→ Dibayar (full / partial)
→ Running balance
→ Closing bulanan
→ Reset ledger bulan berikutnya
Dashboard claim officer:

Nama
Total Claim
Paid
Remaining
Claim ledger reset setiap closing bulan.
14. APPROVAL SYSTEM
Semua pengajuan harus lewat approval system:
Expense Claim
Purchase Request
Cash Advance
Discount
Stock Transfer
Branch Override
Maintenance Cost
Large Purchase
Yang bisa approve:
Owner
Director
Admin
Boss
Manager (optional)
Jika reject harus ada alasan.
15. FINANCIAL FLOW SYSTEM
Flow uang:

Client bayar invoice → Finance
Supplier payment → Finance
Expense claim → Claim Officer
Cash advance → Claim Officer
Purchasing → Purchasing + Finance
Semua uang masuk:

financial_transactions
16. SYSTEM LOGGING (WAJIB)
Semua aktivitas harus masuk log:
activity_logs
system_logs
inventory_logs
financial_logs
delivery_logs
issue_logs
Tidak boleh ada transaksi tanpa log.
17. AGENT COLLABORATION RULES (UNTUK CLAUDE / AI AGENTS)
Karena project dikerjakan beberapa agent, harus ada aturan kerja.
Saat Agent Mulai Kerja
Agent harus tulis:

[WORKING] Working on: <task>
Saat Selesai
Agent harus tulis:

[DONE] Completed by <agent name>

Files changed:
- file1
- file2

Database changes:
- migration added
- table updated

Notes:
<penjelasan perubahan>
Jika Belum Selesai Karena Limit
Agent harus tulis:

[PAUSED] Work paused due to limit.

Next tasks:
- ...
- ...
Jika Lanjut Oleh Agent Lain
Agent berikutnya harus tulis:

[CONTINUE] Continuing work from previous agent.
Tujuan rules ini:
Tidak overwrite kerja agent lain
Tidak duplicate code
Tidak duplicate table
Tidak konflik migration
Progress jelas
18. FINAL SYSTEM MODULE ORION
Module ORION:
Authentication
Users & Roles
Regions
Branches
Clients
Products
Inventory
Requests / Orders
Pricing
Delivery / Logistics
Technician / Service
Maintenance
Finance
Purchasing
Expense Claim
Cash Advance
Faktur Tracking
Approval System
Notifications
Internal Chat
CMS Website
Analytics
Employee Performance
Activity Logs
Knowledge Base
Automation
Monthly Closing
FINAL NOTE
ORION bukan hanya ERP biasa.
ORION adalah:

Enterprise Operations System
Multi Branch Management System
Service Management System
Logistics System
Finance System
Internal Company Platform.

---

### AGENT WORK LOG

[DONE] Completed by Antigravity

Files changed:
- src/components/layout/Navbar.tsx (rewritten — Orion layout)
- src/types/types.ts (added Region, Branch interfaces + branch_id/profile_completed/city/province)
- src/lib/services/auth-service.ts (updated isProfileComplete)
- supabase/migrations/00018_region_branch_system.sql (new)

Database changes:
- regions table created (seeded: Indonesia)
- branches table created (seeded: Bogor, Purwokerto, Cirebon)
- branch_id added to: profiles, requests, products, delivery_logs, invoices, issues, activity_logs, inventory_logs
- profile_completed, city, province added to profiles
- price_cost_per_test added to price_list
- Helper functions: auth_user_branch_id(), has_global_access()

Notes:
- Navbar now follows sms2.md Section 4 layout (About/Products/Services/Contact center, NotificationBell + Profile Dropdown right)
- Profile completeness now requires name + phone + branch for all roles, plus full company info for clients
- Build: 0 TypeScript errors

[DONE] Completed by Antigravity — Batch 2

Files changed:
- src/types/types.ts (added 12 new enums + 15 new entity interfaces)
- supabase/migrations/00019_orion_business_systems.sql (new)

Database changes:
- product_branch_stock, stock_transfers, stock_transfer_items (Section 5)
- branch_price_overrides (Section 5)
- approvals (Section 14 — universal approval system)
- suppliers, purchase_requests, purchase_request_items, purchase_orders, purchase_order_items (Section 12)
- expense_claims, claim_ledger, cash_advances (Section 13)
- financial_transactions (Section 15)
- branch_id added to monthly_closing

Notes:
- All new tables are branch-aware with proper FK constraints and indexes
- Build: 0 TypeScript errors