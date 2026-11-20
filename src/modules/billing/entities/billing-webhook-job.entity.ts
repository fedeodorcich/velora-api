import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('billing_webhook_jobs')
@Index('IDX_billing_webhook_jobs_due', ['pending', 'nextAttemptAt'])
export class BillingWebhookJob {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  id: string;

  @Column({ type: 'varchar', length: 48 })
  topic: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 64 })
  resourceId: string;

  @Column({ default: true })
  pending: boolean;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz' })
  nextAttemptAt: Date;
}
