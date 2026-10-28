import { Column, Entity, PrimaryColumn } from 'typeorm';

/** One compressed photo of a listing, stored as a data URL. */
@Entity('listing_photos')
export class ListingPhoto {
  @PrimaryColumn('uuid', { name: 'listing_id' })
  listingId: string;

  /** 0 is the cover photo. */
  @PrimaryColumn('smallint')
  position: number;

  @Column('text', { name: 'data_url' })
  dataUrl: string;
}
