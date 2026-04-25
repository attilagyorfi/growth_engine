CREATE TABLE `seo_audits` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`url` varchar(500) NOT NULL,
	`status` enum('pending','running','done','error') NOT NULL DEFAULT 'pending',
	`score` int,
	`report` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seo_audits_id` PRIMARY KEY(`id`)
);
