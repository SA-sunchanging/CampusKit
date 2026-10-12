CREATE USER identity_app WITH PASSWORD 'identity_demo';
CREATE USER listing_app WITH PASSWORD 'listing_demo';
CREATE USER booking_app WITH PASSWORD 'booking_demo';
CREATE USER rental_app WITH PASSWORD 'rental_demo';
CREATE USER payment_app WITH PASSWORD 'payment_demo';
CREATE DATABASE identity_db OWNER identity_app;
CREATE DATABASE listing_db OWNER listing_app;
CREATE DATABASE booking_db OWNER booking_app;
CREATE DATABASE rental_db OWNER rental_app;
CREATE DATABASE payment_db OWNER payment_app;
REVOKE CONNECT ON DATABASE identity_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE listing_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE booking_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE rental_db FROM PUBLIC;
REVOKE CONNECT ON DATABASE payment_db FROM PUBLIC;
\connect booking_db
CREATE EXTENSION btree_gist;
