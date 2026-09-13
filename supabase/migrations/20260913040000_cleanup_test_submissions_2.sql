-- Removes the row inserted while manually testing the submit modal UI.
delete from public.games where slug = 'neat-game';
delete from public.game_submission_log where slug = 'neat-game';
