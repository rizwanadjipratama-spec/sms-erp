sms2.md — ORION ERP SYSTEM (FINAL SPECIFICATION)

PROJECT: ORION ERP SYSTEM

ORION adalah sistem ERP multi-branch untuk:

- Inventory
- Sales
- Service / Technician
- Delivery / Logistics
- Finance
- Purchasing
- Expense Claim
- Faktur Tracking
- Employee Management
- Analytics
- CMS Website
- Internal Company System

System harus scalable untuk banyak cabang.

---

1. CORE SYSTEM RULES (WAJIB)

Rules ini tidak boleh dilanggar.

1. Semua transaksi harus punya branch_id
2. Semua transaksi harus punya created_by
3. Semua transaksi penting harus punya approval
4. Semua perubahan status masuk activity_logs
5. Semua uang masuk/keluar masuk financial_transactions
6. Semua perubahan stock masuk inventory_logs
7. Semua delivery punya delivery_team
8. Semua issue punya issue_logs
9. Semua claim punya ledger / running balance
10. Setiap bulan harus ada closing
11. Tidak boleh delete transaksi → hanya cancel / reverse
12. Role permission harus ketat
13. Data antar cabang tidak boleh bocor
14. Semua sistem harus audit-able
15. Semua workflow pakai status flow
16. Semua perubahan database lewat migration
17. Semua query harus filter branch
18. Semua user punya branch
19. Semua log harus tersimpan
20. Jika tidak tercatat di sistem = tidak terjadi

---

2. REGION & BRANCH SYSTEM

Region:

- Indonesia
- Asia (future)
- Europe (future)

Branch Indonesia:

- Bogor
- Cirebon
- Purwokerto

Rules:

- User punya branch_id
- Client punya branch_id
- Stock per branch
- Harga per branch
- Delivery per branch
- Issue per branch
- Finance per branch
- Purchasing per branch
- Claim per branch

GLOBAL ROLES:

- Owner
- Admin
- Boss
- Director

BRANCH ROLES:

- Manager
- Finance
- Warehouse
- Marketing
- Technician
- Courier
- Faktur
- Purchasing
- Claim Officer
- Tax
- Client

---

3. ROLE PERMISSION RULE

Semua role BOLEH kirim barang dan tukar faktur
KECUALI:

- Owner
- Admin

Director boleh delivery & tukar faktur tapi default branch dia.

---

4. PROFILE SYSTEM (WAJIB SETUP)

User harus isi:

- Name
- Company / RS / Klinik
- Address lengkap
- City
- Province
- Phone
- PIC Name
- Client Type
- Branch

Client Type:

- Regular
- KSO
- Cost Per Test

Jika profile belum lengkap:

- Tidak bisa request
- Tidak bisa order
- Tidak bisa save profile
- Tidak bisa submit apapun

---

5. PRODUCT & STOCK PER BRANCH

Stock tidak global.

Struktur:

- products
- product_branch_stock
- inventory_logs
- stock_transfers
- stock_transfer_items

Harga per client type:

- price_regular
- price_kso
- price_cpt

Client hanya lihat harga sesuai type.

---

6. STOCK TRANSFER ANTAR CABANG

Flow:
Warehouse Bogor → Transfer ke Cirebon / Purwokerto
→ Create Stock Transfer
→ Delivery
→ Warehouse Cirebon Receive
→ Stock masuk Cirebon

Status:

- draft
- approved
- preparing
- shipped
- in_transit
- arrived
- received
- completed

---

7. REQUEST / ORDER FLOW

Flow:
Client submit request
→ Marketing pricing
→ Boss approve
→ Finance create invoice
→ Warehouse prepare
→ Delivery
→ Client confirm
→ Completed

Status:

- submitted
- priced
- approved
- invoice_ready
- preparing
- ready
- on_delivery
- delivered
- completed
- cancelled
- rejected

---

8. DELIVERY SYSTEM

Delivery harus punya:

- branch_id
- invoice_id
- client_id
- delivery_team
- proof photo
- signature
- status
- notes

Delivery team:

- courier
- technician
- marketing
- warehouse
- faktur
- finance
- manager
- director
- purchasing
- claim officer

---

9. ISSUE / TECHNICIAN SYSTEM

Flow:
Client report error
→ Issue dibuat
→ Technician assigned
→ Status progress
→ Technician lain bisa join
→ Completed + report
→ Knowledge base

Status:

- reported
- assigned
- on_the_way
- arrived
- working
- waiting_parts
- testing
- completed
- cancelled

---

10. PURCHASING SYSTEM

Purchasing:

- Beli reagen
- Beli consumables
- Beli barang inventory
- Beli barang untuk dijual

Flow:
Purchase Request → Approval → PO → Barang datang → Inventory → Supplier Invoice → Finance bayar

---

11. CLAIM / OPERATIONAL EXPENSE

Untuk:

- Bensin
- Tol
- Parkir
- Hotel
- Konsumsi
- Tools
- Sparepart kecil
- Operasional

Flow:
Submit claim → Approval → Claim Officer → Payment → Ledger → Closing → Reset bulan berikutnya

---

12. APPROVAL SYSTEM

Perlu approval:

- Expense claim
- Purchase request
- Discount
- Stock transfer
- Cash advance
- Maintenance cost
- Large purchase

Approve oleh:

- Owner
- Director
- Admin
- Boss
- Manager

---

13. FINANCIAL FLOW

Client bayar → Finance
Supplier payment → Finance
Expense claim → Claim Officer
Purchasing → Purchasing + Finance

Semua uang masuk:
financial_transactions

---

14. ADMIN & OWNER CONTROL

Admin dan Owner bisa:

- Create branch
- Edit branch
- Pindah user ke branch lain
- Ganti role user
- Disable user
- Reset password
- Lihat semua data semua branch
- CMS edit website
- News
- Announcement
- Analytics global
- Employee performance
- Active users
- System logs

---

15. DATABASE RULES (WAJIB)

Semua table transaksi wajib punya:

- id
- branch_id
- created_by
- created_at
- updated_at
- status

Semua query wajib:
WHERE branch_id = current_user.branch_id

Kecuali:
Owner
Admin
Boss
Director

---

16. AGENT DEVELOPMENT RULES

Jika AI mulai kerja:
[WORKING] Task name

Jika selesai:
[DONE]
Files changed
Migration added
Notes

Jika limit:
[PAUSED]
Next tasks

Jika lanjut:
[CONTINUE]

Tidak boleh:

- Duplicate table
- Duplicate migration
- Rewrite existing logic
- Break working features

---

17. DEVELOPMENT TASK CHECKLIST

MULTI BRANCH

[ ] Create regions table
[ ] Create branches table
[ ] Add branch_id to profiles
[ ] Add branch_id to clients
[ ] Add branch_id to inventory
[ ] Add branch_id to requests
[ ] Add branch_id to deliveries
[ ] Add branch_id to issues
[ ] Add branch_id to invoices
[ ] Filter all queries by branch
[ ] Branch switcher for global roles

INVENTORY

[ ] product_branch_stock
[ ] inventory_logs
[ ] stock_transfer
[ ] stock_transfer_items
[ ] stock_transfer_logs

DELIVERY

[ ] deliveries
[ ] delivery_items
[ ] delivery_team
[ ] delivery_logs
[ ] delivery_proof_upload

ISSUE

[ ] issues
[ ] issue_technicians
[ ] issue_logs
[ ] knowledge_base

FINANCE

[ ] invoices
[ ] payments
[ ] financial_transactions
[ ] monthly_closing

CLAIM

[ ] expense_claims
[ ] claim_ledger
[ ] claim_payments

PURCHASING

[ ] purchase_requests
[ ] purchase_orders
[ ] supplier_invoices

CMS

[ ] cms_sections
[ ] cms_media
[ ] cms_news
[ ] cms_announcements

ANALYTICS

[ ] revenue chart
[ ] employee performance
[ ] branch performance
[ ] active users
[ ] open issues
[ ] delivery stats

---

FINAL SYSTEM STRUCTURE

COMPANY
→ REGION
→ BRANCH
→ USERS
→ CLIENTS
→ INVENTORY
→ REQUESTS
→ DELIVERY
→ ISSUES
→ FINANCE
→ CLAIM
→ PURCHASING
→ FAKTUR

Semua data selalu punya branch.

---

FINAL RULE ORION

Semua barang harus bisa dilacak
Semua uang harus bisa dilacak
Semua service harus bisa dilacak
Semua delivery harus bisa dilacak
Semua approval harus ada record
Semua perubahan harus ada log
Semua cabang harus terpisah
Semua bulan harus closing
Tidak boleh ada transaksi tanpa branch
Tidak boleh ada transaksi tanpa user
Tidak boleh ada transaksi tanpa log