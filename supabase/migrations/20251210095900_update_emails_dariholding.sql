/*
  # Update Emails for DARI HOLDING

  1. Changes
    - Replace all sigtb.gn emails with dariholding.gn in drivers table
    - Replace all sigtb.gn emails with dariholding.gn in employees table
  
  2. Tables Updated
    - drivers (email field)
    - employees (email field)
  
  3. Security
    - Maintains all existing security policies
    - Only updates email domains
*/

-- Update driver emails from sigtb.gn to dariholding.gn
UPDATE drivers
SET email = REPLACE(email, '@sigtb.gn', '@dariholding.gn')
WHERE email LIKE '%@sigtb.gn';

-- Update employee emails from sigtb.gn to dariholding.gn
UPDATE employees
SET email = REPLACE(email, '@sigtb.gn', '@dariholding.gn')
WHERE email LIKE '%@sigtb.gn';
