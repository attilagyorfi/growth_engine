CREATE TABLE `ai_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appUserId` varchar(64) NOT NULL,
	`action` varchar(64) NOT NULL,
	`month` varchar(7) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_usage_id` PRIMARY KEY(`id`)
);
