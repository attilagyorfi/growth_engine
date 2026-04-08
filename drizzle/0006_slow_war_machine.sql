ALTER TABLE `app_users` ADD `subscriptionPlan` enum('free','starter','pro','agency') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_users` ADD `contactPerson` varchar(255);--> statement-breakpoint
ALTER TABLE `app_users` ADD `phone` varchar(50);--> statement-breakpoint
ALTER TABLE `app_users` ADD `companyName` varchar(255);--> statement-breakpoint
ALTER TABLE `app_users` ADD `notes` text;