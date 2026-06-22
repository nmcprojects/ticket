-- Creates a separate database per microservice (data isolation).
-- Runs automatically on first Postgres startup.
CREATE DATABASE event_db;
CREATE DATABASE ticket_db;

-- Future services (created ahead of time so the same Postgres can host them):
CREATE DATABASE auth_db;
CREATE DATABASE booking_db;
CREATE DATABASE payment_db;
CREATE DATABASE notification_db;
