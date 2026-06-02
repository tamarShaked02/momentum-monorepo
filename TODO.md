# Momentum — TODO

## In Progress

- [ ] Batch delete for customers, appointments, inventory

---

## Frontend

### General

- [ ] Light / dark mode toggle (sidebar) ✅ added
- [ ] Mobile responsive layout improvements
- [ ] Global loading/error toast notifications (replace `alert()` calls)
- [ ] Empty state illustrations for all pages

### Customers (CRM)

- [ ] Customer search / filter in the table
- [ ] Bulk import customers (CSV)
- [ ] Customer tags / segmentation

### Appointments

- [ ] Calendar / week view (instead of flat table only)
- [ ] Recurring appointments support
- [ ] Appointment reminders via Telegram

### Inventory

- [ ] Edit inventory item details (name, SKU, category, price)
- [ ] Delete inventory items
- [ ] Inventory history log view per item
- [ ] CSV export

### Tasks

- [ ] Drag-and-drop between kanban columns
- [ ] Task due date notifications
- [ ] Task assignment (multi-user)

### Marketing

- [ ] Campaign status update (draft → active → completed)
- [ ] Schedule campaign send date
- [ ] Campaign analytics (open rate, click rate placeholders)

### Analytics

- [ ] Date range filter
- [ ] Revenue tracking
- [ ] Export reports (PDF/CSV)

### Settings

- [ ] Module enable/disable toggle page (instead of DB-only)
- [ ] Profile / business info edit page
- [ ] Password change

---

## Backend

- [ ] Pagination on all list endpoints
- [ ] Rate limiting
- [ ] Input validation (zod or class-validator)
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
