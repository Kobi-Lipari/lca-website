-- 0039_ticket_numbers.sql
--
-- Short, human ticket numbers. Tickets are keyed by ids like
-- "ticket-1727301234567-k3j9xq", which is what people were being shown in
-- emails and on the site. The id stays the key (URLs and foreign keys use
-- it); `number` is what people see: #1001, #1002, ...
--
-- Existing tickets are numbered in the order they were opened, starting at
-- 1001, so the oldest ticket keeps the lowest number.

ALTER TABLE support_tickets ADD COLUMN number INTEGER;

UPDATE support_tickets
   SET number = 1000 + (
     SELECT COUNT(*) FROM support_tickets t2
      WHERE t2.created_at < support_tickets.created_at
         OR (t2.created_at = support_tickets.created_at AND t2.id <= support_tickets.id)
   );

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_number ON support_tickets(number);
