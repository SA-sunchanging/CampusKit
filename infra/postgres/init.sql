-- Runs once, when the postgres volume is first created.
-- One logical database and one user per service (database per service). Demo credentials only.
CREATE USER identity_user WITH PASSWORD 'identity_pass';
CREATE DATABASE identity_db OWNER identity_user;
REVOKE CONNECT ON DATABASE identity_db FROM PUBLIC;

CREATE USER listing_user WITH PASSWORD 'listing_pass';
CREATE DATABASE listing_db OWNER listing_user;
REVOKE CONNECT ON DATABASE listing_db FROM PUBLIC;

CREATE USER booking_user WITH PASSWORD 'booking_pass';
CREATE DATABASE booking_db OWNER booking_user;
REVOKE CONNECT ON DATABASE booking_db FROM PUBLIC;

CREATE USER rental_user WITH PASSWORD 'rental_pass';
CREATE DATABASE rental_db OWNER rental_user;
REVOKE CONNECT ON DATABASE rental_db FROM PUBLIC;

CREATE USER payment_user WITH PASSWORD 'payment_pass';
CREATE DATABASE payment_db OWNER payment_user;
REVOKE CONNECT ON DATABASE payment_db FROM PUBLIC;

-- Booking's exclusion constraint needs btree_gist, which only a superuser can install.
\connect booking_db
CREATE EXTENSION IF NOT EXISTS btree_gist;
