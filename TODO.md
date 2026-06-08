# Momentum — TODO

## Completed

- [x] Light / dark mode toggle (sidebar)
- [x] Edit inventory item details (name, SKU, category, price)
- [x] Delete inventory items
- [x] Drag-and-drop between kanban columns
- [x] Date range filter (analytics)
- [x] Revenue/profit tracking (analytics)
- [x] Global toast notifications (replaced alert/confirm)
- [x] Customer search / filter in the table
- [x] Campaign status update (draft → active → completed)
- [x] Appointment price field + profit calculation
- [x] Customer edit/delete
- [x] Appointment edit/delete
- [x] Customer profile drawer improvements
- [x] Appointment notes visible in CRM

---

## Frontend

### General

- [ ] Mobile responsive layout improvements
- [ ] Empty state illustrations for all pages

### Customers (CRM)

- [ ] Bulk import customers (CSV)
- [ ] Customer tags / segmentation

### Appointments

- [ ] Calendar / week view (instead of flat table only)
- [ ] Recurring appointments support
- [ ] Appointment reminders via Telegram

### Inventory

- [ ] Inventory history log view per item
- [ ] CSV export

### Tasks

- [ ] Task due date notifications
- [ ] Task assignment (multi-user)

### Marketing

- [ ] Schedule campaign send date
- [ ] Campaign analytics (open rate, click rate placeholders)

### Analytics

- [ ] Export reports (PDF/CSV)

### Settings

- [ ] Module enable/disable toggle page (instead of DB-only)
- [ ] Profile / business info edit page
- [ ] Password change

---

## Backend

- [x] Pagination on all list endpoints
- [x] Rate limiting
- [x] Input validation (zod)
- [ ] Refresh token support
- [ ] Telegram bot — booking flow via chat
- [ ] Email notifications (appointment confirmations)
- [ ] Multi-user / team support
- [ ] Audit log for sensitive operations

---

## Infrastructure

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Production Docker Compose with postgres service
- [ ] Environment-based config management
- [ ] Database backups strategy
