DELETE FROM payments WHERE type='tournament' AND reference_id IN (SELECT id FROM registrations);
DELETE FROM payments WHERE type='tournament' AND reference_id IN (SELECT id FROM tournaments);
DELETE FROM tournament_games;
DELETE FROM tournament_reminders;
DELETE FROM registrations;
DELETE FROM tournaments;
