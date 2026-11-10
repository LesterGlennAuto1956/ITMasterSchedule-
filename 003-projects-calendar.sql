-- Run this in the D1 Console to move items onto the new item types.
-- Safe to run more than once.
UPDATE inventory SET category = 'PCs' WHERE category = 'Desktops';
UPDATE inventory_signouts SET category = 'PCs' WHERE category = 'Desktops';
UPDATE inventory SET category = 'Keyboards' WHERE category = 'Keyboards & Mice';
UPDATE inventory_signouts SET category = 'Keyboards' WHERE category = 'Keyboards & Mice';
UPDATE inventory SET category = 'IP Phones' WHERE category = 'Phones';
UPDATE inventory_signouts SET category = 'IP Phones' WHERE category = 'Phones';
UPDATE inventory SET category = 'Printers' WHERE category = 'Printers & Toner';
UPDATE inventory_signouts SET category = 'Printers' WHERE category = 'Printers & Toner';
