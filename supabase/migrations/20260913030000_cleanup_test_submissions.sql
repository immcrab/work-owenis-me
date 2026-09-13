-- Removes the two rows inserted while manually testing submit_game.
delete from public.games where slug in ('test-submission-game', 'ui-test-game');
delete from public.game_submission_log where slug in ('test-submission-game', 'ui-test-game');
