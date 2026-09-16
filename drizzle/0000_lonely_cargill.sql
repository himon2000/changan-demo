CREATE TABLE `game_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`updated` integer NOT NULL,
	`seen_a` integer DEFAULT 0 NOT NULL,
	`seen_b` integer DEFAULT 0 NOT NULL
);
