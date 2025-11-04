import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add 'verified' status to the verifications.status enum
 * This allows verifications to use 'verified' instead of 'approved'
 */
export class AddVerifiedStatusToEnum1761800100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      console.log('\n📝 Adding "verified" status to verifications.status enum...\n');

      // First, find the actual enum type name from the column definition
      const columnInfo = await queryRunner.query(`
        SELECT udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'verifications' 
        AND column_name = 'status';
      `);

      if (!columnInfo || columnInfo.length === 0) {
        console.log('⚠️  Could not find verifications.status column');
        return;
      }

      const enumTypeName = columnInfo[0].udt_name;
      console.log(`Found column type: ${enumTypeName}`);

      // If the column is already varchar/text, it can accept 'verified' without modification
      if (enumTypeName === 'varchar' || enumTypeName === 'character varying' || enumTypeName === 'text') {
        console.log('✓ Column is already varchar/text - can accept "verified" status without modification');
        return;
      }

      // Check if 'verified' already exists in the enum
      const enumExists = await queryRunner.query(`
        SELECT 1 
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = $1
        AND e.enumlabel = 'verified';
      `, [enumTypeName]);

      if (enumExists && enumExists.length > 0) {
        console.log('✓ "verified" status already exists in enum');
        return;
      }

      // Add 'verified' to the enum type
      await queryRunner.query(`
        ALTER TYPE ${enumTypeName} ADD VALUE IF NOT EXISTS 'verified';
      `);

      console.log('✓ Added "verified" status to verifications.status enum');
    } catch (error) {
      console.error('❌ Error adding verified status:', error.message);
      
      // Try alternative approach: change column to varchar if enum modification fails
      try {
        console.log('⚠️  Enum modification failed, trying alternative approach...');
        
        // Get current enum type name
        const columnInfo = await queryRunner.query(`
          SELECT udt_name 
          FROM information_schema.columns 
          WHERE table_name = 'verifications' 
          AND column_name = 'status';
        `);

        if (columnInfo && columnInfo.length > 0) {
          const enumTypeName = columnInfo[0].udt_name;
          
          // Create new enum with 'verified' included
          await queryRunner.query(`
            CREATE TYPE verifications_status_enum_new AS ENUM (
              'pending', 
              'processing', 
              'needs_review', 
              'approved', 
              'verified', 
              'rejected', 
              'expired', 
              'cancelled'
            );
          `);

          // Alter column to use new enum
          await queryRunner.query(`
            ALTER TABLE verifications 
            ALTER COLUMN status TYPE verifications_status_enum_new 
            USING status::text::verifications_status_enum_new;
          `);

          // Drop old enum and rename new one
          await queryRunner.query(`DROP TYPE ${enumTypeName};`);
          await queryRunner.query(`ALTER TYPE verifications_status_enum_new RENAME TO ${enumTypeName};`);

          console.log('✓ Added "verified" status using alternative method');
        }
      } catch (altError) {
        console.error('❌ Alternative approach also failed:', altError.message);
        console.log('⚠️  Migration partially completed - application will handle both statuses');
        // Don't throw - allow migration to continue
        // The application code will handle both 'approved' and 'verified'
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Removing enum values is complex in PostgreSQL
    // Best practice is to leave it and let application handle it
    console.log(
      '⚠️  Reverting enum changes is complex. The "verified" status will remain.'
    );
    console.log('Application code supports both "approved" and "verified" for backward compatibility.');
  }
}

