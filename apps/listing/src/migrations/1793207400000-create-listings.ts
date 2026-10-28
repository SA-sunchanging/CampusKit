import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates listings and their photos. Photos are compressed data URLs (no object storage yet);
 * search reads only the small thumbnail on the listing row.
 */
export class CreateListings1793207400000 implements MigrationInterface {
  name = 'CreateListings1793207400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE listings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL,
        owner_name text NOT NULL,
        status text NOT NULL DEFAULT 'DRAFT',
        title text NOT NULL,
        category text NOT NULL,
        description text NOT NULL,
        condition text NOT NULL,
        accessories text[] NOT NULL DEFAULT '{}',
        replacement_value integer NOT NULL,
        daily_rate integer NOT NULL,
        deposit integer NOT NULL,
        late_fee_per_day integer NOT NULL,
        max_rental_days integer NOT NULL,
        pickup_locations text[] NOT NULL,
        blackouts jsonb NOT NULL DEFAULT '[]',
        thumbnail text,
        publish_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz,
        CONSTRAINT listings_status_check CHECK (status IN ('DRAFT', 'PUBLISHED')),
        CONSTRAINT listings_category_check CHECK (category IN
          ('BOOKS', 'ELECTRONICS', 'SPORTS', 'CLOTHING', 'MUSIC', 'TOOLS', 'OTHER')),
        CONSTRAINT listings_condition_check CHECK (condition IN ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR')),
        CONSTRAINT listings_money_check CHECK (
          daily_rate > 0 AND deposit >= 0 AND late_fee_per_day >= 0 AND replacement_value >= 0
        ),
        CONSTRAINT listings_max_rental_days_check CHECK (max_rental_days BETWEEN 1 AND 30),
        CONSTRAINT listings_published_check CHECK ((status = 'PUBLISHED') = (published_at IS NOT NULL))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX listings_search_idx ON listings (status, published_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX listings_category_idx ON listings (status, category, published_at DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE listing_photos (
        listing_id uuid NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
        position smallint NOT NULL,
        data_url text NOT NULL,
        PRIMARY KEY (listing_id, position)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE listing_photos`);
    await queryRunner.query(`DROP TABLE listings`);
  }
}
