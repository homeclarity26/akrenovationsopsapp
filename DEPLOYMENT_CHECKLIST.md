# Deployment Checklist

Generated: 2026-04-16 02:32 UTC
Project: `mebzqfeeiciayxdetteb`

---

## 1. Migrations (118 files)

Verify each migration has been applied in the Supabase dashboard under
**Database > Migrations**. Check the box once confirmed.

| # | Migration file | Applied? |
|---|---------------|----------|
| 1 | `20260407000000_aa_base_schema.sql` | [ ] |
| 2 | `20260407000001_enable_pgvector.sql` | [ ] |
| 3 | `20260407000002_business_context.sql` | [ ] |
| 4 | `20260407000003_operational_memory.sql` | [ ] |
| 5 | `20260407000004_agent_history.sql` | [ ] |
| 6 | `20260407000005_learning_insights.sql` | [ ] |
| 7 | `20260407000006_ai_role_permissions.sql` | [ ] |
| 8 | `20260407000010_memory_triggers.sql` | [ ] |
| 9 | `20260407000011_memory_search_rpcs.sql` | [ ] |
| 10 | `20260407000020_budget_mode.sql` | [ ] |
| 11 | `20260407000021_budget_trades.sql` | [ ] |
| 12 | `20260407000022_budget_quotes.sql` | [ ] |
| 13 | `20260407000023_budget_settings.sql` | [ ] |
| 14 | `20260407000024_project_files_budget.sql` | [ ] |
| 15 | `20260407000030_drive_url_columns.sql` | [ ] |
| 16 | `20260407000031_daily_logs_pdf_url.sql` | [ ] |
| 17 | `20260407000032_documents_storage.sql` | [ ] |
| 18 | `20260407000040_agent_outputs.sql` | [ ] |
| 19 | `20260407000041_pg_cron.sql` | [ ] |
| 20 | `20260407000042_agent_triggers.sql` | [ ] |
| 21 | `20260407000050_meta_agent_conversations.sql` | [ ] |
| 22 | `20260407000051_meta_agent_preferences.sql` | [ ] |
| 23 | `20260407000052_app_usage_events.sql` | [ ] |
| 24 | `20260407000053_improvement_specs.sql` | [ ] |
| 25 | `20260407000054_agent_directives.sql` | [ ] |
| 26 | `20260407000060_f1_rename_time_entries.sql` | [ ] |
| 27 | `20260407000061_f2_new_time_entries.sql` | [ ] |
| 28 | `20260407000062_f3_work_type_rates.sql` | [ ] |
| 29 | `20260407000063_f4_profiles_field_mode.sql` | [ ] |
| 30 | `20260407000064_f5_migrate_legacy_data.sql` | [ ] |
| 31 | `20260407000065_f6_rls_new_tables.sql` | [ ] |
| 32 | `20260407000066_f23_time_entry_memory_trigger.sql` | [ ] |
| 33 | `20260407000070_h1_sub_scopes.sql` | [ ] |
| 34 | `20260407000071_h2_sub_contracts.sql` | [ ] |
| 35 | `20260407000072_h3_contract_templates.sql` | [ ] |
| 36 | `20260407000073_h4_seed_contract_template.sql` | [ ] |
| 37 | `20260407000074_h16_compliance_items.sql` | [ ] |
| 38 | `20260407000075_h17_compliance_notes.sql` | [ ] |
| 39 | `20260407000076_h18_seed_compliance_items.sql` | [ ] |
| 40 | `20260407000077_h23_compliance_cron.sql` | [ ] |
| 41 | `20260407000080_i1_profiles_payroll_columns.sql` | [ ] |
| 42 | `20260407000081_i2_compensation_components.sql` | [ ] |
| 43 | `20260407000082_i3_benefits_enrollment.sql` | [ ] |
| 44 | `20260407000083_i4_pay_periods.sql` | [ ] |
| 45 | `20260407000084_i5_payroll_records.sql` | [ ] |
| 46 | `20260407000085_i6_payroll_adjustments.sql` | [ ] |
| 47 | `20260407000086_i7_mileage_logs.sql` | [ ] |
| 48 | `20260407000087_i8_payroll_ytd.sql` | [ ] |
| 49 | `20260407000088_i9_payroll_rls.sql` | [ ] |
| 50 | `20260407000089_i10_seed_pay_periods.sql` | [ ] |
| 51 | `20260407000090_i11_seed_jeff_steven_compensation.sql` | [ ] |
| 52 | `20260407000091_i24_bonus_to_payroll_trigger.sql` | [ ] |
| 53 | `20260407000100_j1_estimate_templates.sql` | [ ] |
| 54 | `20260407000101_j2_estimate_template_actuals.sql` | [ ] |
| 55 | `20260407000102_j3_estimate_line_items.sql` | [ ] |
| 56 | `20260407000103_j4_seed_estimate_templates.sql` | [ ] |
| 57 | `20260407000110_j10_checklist_templates.sql` | [ ] |
| 58 | `20260407000111_j11_checklist_template_items.sql` | [ ] |
| 59 | `20260407000112_j12_checklist_instances.sql` | [ ] |
| 60 | `20260407000113_j13_checklist_instance_items.sql` | [ ] |
| 61 | `20260407000114_j14_seed_checklist_templates.sql` | [ ] |
| 62 | `20260407000115_j14b_seed_checklist_sops.sql` | [ ] |
| 63 | `20260407000116_j16_checklist_triggers.sql` | [ ] |
| 64 | `20260407000120_k1_schedule_events_crew_members.sql` | [ ] |
| 65 | `20260407000121_k8_tool_requests.sql` | [ ] |
| 66 | `20260407000122_k14_project_photos_portfolio.sql` | [ ] |
| 67 | `20260407000123_k19_suppliers.sql` | [ ] |
| 68 | `20260407000124_k20_expenses_supplier.sql` | [ ] |
| 69 | `20260407000125_k30_estimate_line_items_labor.sql` | [ ] |
| 70 | `20260407000126_k31_labor_benchmarks.sql` | [ ] |
| 71 | `20260407000127_k36_warranty_claims_extend.sql` | [ ] |
| 72 | `20260407000128_k47_material_specs.sql` | [ ] |
| 73 | `20260407000129_k51_inspection_reports.sql` | [ ] |
| 74 | `20260407000130_k56_projects_reel_columns.sql` | [ ] |
| 75 | `20260407000131_k63_phase_k_triggers.sql` | [ ] |
| 76 | `20260407000200_m1_backup_logs.sql` | [ ] |
| 77 | `20260407000201_m2_restore_points.sql` | [ ] |
| 78 | `20260407000202_m11_audit_log.sql` | [ ] |
| 79 | `20260407000203_m12_rate_limit_events.sql` | [ ] |
| 80 | `20260407000204_m13_user_sessions.sql` | [ ] |
| 81 | `20260407000205_m14_audit_triggers.sql` | [ ] |
| 82 | `20260407000206_m21_base_rls.sql` | [ ] |
| 83 | `20260407000207_m23_improvement_prs.sql` | [ ] |
| 84 | `20260407000208_m5_backup_crons.sql` | [ ] |
| 85 | `20260407000210_auth_profile_trigger.sql` | [ ] |
| 86 | `20260408000001_api_usage_log.sql` | [ ] |
| 87 | `20260408000100_n1_n6_alter_existing_templates.sql` | [ ] |
| 88 | `20260408000101_n7_n13_new_template_tables.sql` | [ ] |
| 89 | `20260408000102_n14_n17_instance_tracking.sql` | [ ] |
| 90 | `20260408000103_n19_n23_seed_templates.sql` | [ ] |
| 91 | `20260408000104_n28_template_improvement_cron.sql` | [ ] |
| 92 | `20260408230015_stripe_webhook_events.sql` | [ ] |
| 93 | `20260409000001_add_missing_indexes.sql` | [ ] |
| 94 | `20260409000002_employee_rls_write_policies.sql` | [ ] |
| 95 | `20260409000003_add_cascade_deletes.sql` | [ ] |
| 96 | `20260410000001_add_companies_table.sql` | [ ] |
| 97 | `20260410000002_communication_logs.sql` | [ ] |
| 98 | `20260410000003_ai_usage_logs.sql` | [ ] |
| 99 | `20260410000004_platform_admin.sql` | [ ] |
| 100 | `20260410000005_client_onboarding.sql` | [ ] |
| 101 | `20260410000006_company_onboarding.sql` | [ ] |
| 102 | `20260410000007_seed_ak_renovations.sql` | [ ] |
| 103 | `20260410000008_fix_superadmin_rls.sql` | [ ] |
| 104 | `20260410000009_reset_akr_onboarding.sql` | [ ] |
| 105 | `20260415000001_onboarding_flags.sql` | [ ] |
| 106 | `20260415000100_project_assignments_extension.sql` | [ ] |
| 107 | `20260415000200_enable_realtime_project_tables.sql` | [ ] |
| 108 | `20260415000300_project_activity.sql` | [ ] |
| 109 | `20260415000400_per_item_client_visibility.sql` | [ ] |
| 110 | `20260415000500_ai_project_suggestions.sql` | [ ] |
| 111 | `20260415000600_inventory_schema.sql` | [ ] |
| 112 | `20260415000700_shopping_inventory_link.sql` | [ ] |
| 113 | `20260415000800_inventory_alerts.sql` | [ ] |
| 114 | `20260415000900_stocktake_photos.sql` | [ ] |
| 115 | `20260415001000_wave_a_integrity_fixes.sql` | [ ] |
| 116 | `20260415001100_observability_tables.sql` | [ ] |
| 117 | `20260415001200_inventory_notification_cron.sql` | [ ] |
| 118 | `20260415001300_suppliers_reels_inspections.sql` | [ ] |

---

## 2. Edge Functions (79 deployable)

The GitHub Actions workflow (`.github/workflows/deploy-edge-functions.yml`)
dynamically deploys all function directories (skipping `_shared`).
Verify each function is deployed in **Supabase Dashboard > Edge Functions**.

| # | Function | In workflow? | Deployed? |
|---|----------|-------------|-----------|
| 1 | `agent-bonus-qualification` | Yes (dynamic) | [ ] |
| 2 | `agent-calibrate-templates` | Yes (dynamic) | [ ] |
| 3 | `agent-call-summarizer` | Yes (dynamic) | [ ] |
| 4 | `agent-cash-flow` | Yes (dynamic) | [ ] |
| 5 | `agent-change-order-drafter` | Yes (dynamic) | [ ] |
| 6 | `agent-compliance-monitor` | Yes (dynamic) | [ ] |
| 7 | `agent-conversation-transcriber` | Yes (dynamic) | [ ] |
| 8 | `agent-daily-log` | Yes (dynamic) | [ ] |
| 9 | `agent-document-classifier` | Yes (dynamic) | [ ] |
| 10 | `agent-generate-contract` | Yes (dynamic) | [ ] |
| 11 | `agent-generate-reel` | Yes (dynamic) | [ ] |
| 12 | `agent-generate-scope` | Yes (dynamic) | [ ] |
| 13 | `agent-improvement-analysis` | Yes (dynamic) | [ ] |
| 14 | `agent-inspection-analyzer` | Yes (dynamic) | [ ] |
| 15 | `agent-inventory-alerts` | Yes (dynamic) | [ ] |
| 16 | `agent-invoice-aging` | Yes (dynamic) | [ ] |
| 17 | `agent-invoice-generator` | Yes (dynamic) | [ ] |
| 18 | `agent-lead-aging` | Yes (dynamic) | [ ] |
| 19 | `agent-lead-intake` | Yes (dynamic) | [ ] |
| 20 | `agent-morning-brief` | Yes (dynamic) | [ ] |
| 21 | `agent-photo-stocktake` | Yes (dynamic) | [ ] |
| 22 | `agent-photo-tagger` | Yes (dynamic) | [ ] |
| 23 | `agent-portfolio-curator` | Yes (dynamic) | [ ] |
| 24 | `agent-proposal-writer` | Yes (dynamic) | [ ] |
| 25 | `agent-punch-list` | Yes (dynamic) | [ ] |
| 26 | `agent-quote-reader` | Yes (dynamic) | [ ] |
| 27 | `agent-receipt-processor` | Yes (dynamic) | [ ] |
| 28 | `agent-referral-intake` | Yes (dynamic) | [ ] |
| 29 | `agent-review-request` | Yes (dynamic) | [ ] |
| 30 | `agent-risk-monitor` | Yes (dynamic) | [ ] |
| 31 | `agent-schedule-optimizer` | Yes (dynamic) | [ ] |
| 32 | `agent-sms-responder` | Yes (dynamic) | [ ] |
| 33 | `agent-social-content` | Yes (dynamic) | [ ] |
| 34 | `agent-sub-insurance-alert` | Yes (dynamic) | [ ] |
| 35 | `agent-sub-invoice-matcher` | Yes (dynamic) | [ ] |
| 36 | `agent-template-improvement-suggester` | Yes (dynamic) | [ ] |
| 37 | `agent-tool-request` | Yes (dynamic) | [ ] |
| 38 | `agent-voice-transcriber` | Yes (dynamic) | [ ] |
| 39 | `agent-warranty-intake` | Yes (dynamic) | [ ] |
| 40 | `agent-warranty-tracker` | Yes (dynamic) | [ ] |
| 41 | `agent-weather-schedule` | Yes (dynamic) | [ ] |
| 42 | `agent-weekly-client-update` | Yes (dynamic) | [ ] |
| 43 | `agent-weekly-financials` | Yes (dynamic) | [ ] |
| 44 | `ai-inventory-query` | Yes (dynamic) | [ ] |
| 45 | `ai-suggest-project-action` | Yes (dynamic) | [ ] |
| 46 | `apply-project-suggestion` | Yes (dynamic) | [ ] |
| 47 | `assemble-context` | Yes (dynamic) | [ ] |
| 48 | `backup-daily` | Yes (dynamic) | [ ] |
| 49 | `backup-database` | Yes (dynamic) | [ ] |
| 50 | `backup-storage-manifest` | Yes (dynamic) | [ ] |
| 51 | `budget-ai-action` | Yes (dynamic) | [ ] |
| 52 | `calculate-payroll` | Yes (dynamic) | [ ] |
| 53 | `compare-budget-quotes` | Yes (dynamic) | [ ] |
| 54 | `deduct-shopping-item-from-stock` | Yes (dynamic) | [ ] |
| 55 | `demo-ai` | Yes (dynamic) | [ ] |
| 56 | `extract-preferences` | Yes (dynamic) | [ ] |
| 57 | `generate-checklists` | Yes (dynamic) | [ ] |
| 58 | `generate-embedding` | Yes (dynamic) | [ ] |
| 59 | `generate-estimate` | Yes (dynamic) | [ ] |
| 60 | `generate-improvement-spec` | Yes (dynamic) | [ ] |
| 61 | `generate-payroll-register` | Yes (dynamic) | [ ] |
| 62 | `generate-pdf` | Yes (dynamic) | [ ] |
| 63 | `generate-progress-reel` | Yes (dynamic) | [ ] |
| 64 | `get-usage-stats` | Yes (dynamic) | [ ] |
| 65 | `github-webhook` | Yes (dynamic) | [ ] |
| 66 | `invite-client-to-portal` | Yes (dynamic) | [ ] |
| 67 | `meta-agent-chat` | Yes (dynamic) | [ ] |
| 68 | `meta-agent-open-pr` | Yes (dynamic) | [ ] |
| 69 | `meta-agent-orchestration` | Yes (dynamic) | [ ] |
| 70 | `notify-inventory-alerts` | Yes (dynamic) | [ ] |
| 71 | `process-budget-document` | Yes (dynamic) | [ ] |
| 72 | `reject-project-suggestion` | Yes (dynamic) | [ ] |
| 73 | `send-email` | Yes (dynamic) | [ ] |
| 74 | `stripe-webhook` | Yes (dynamic) | [ ] |
| 75 | `suggest-deliverable-items` | Yes (dynamic) | [ ] |
| 76 | `sync-google-drive` | Yes (dynamic) | [ ] |
| 77 | `sync-to-drive` | Yes (dynamic) | [ ] |
| 78 | `sync-to-gusto` | Yes (dynamic) | [ ] |
| 79 | `update-operational-memory` | Yes (dynamic) | [ ] |

---

## 3. Cron Schedules

Extracted from migration files. Verify each is active in **Supabase Dashboard >
Database > Extensions > pg_cron** (or via `SELECT * FROM cron.job;`).

| # | Job name | Schedule | Target function | Migration file | Active? |
|---|----------|----------|----------------|----------------|---------|
| 1 | `morning-brief` | `0 11 * * *` | `agent-morning-brief` | `20260407000041_pg_cron.sql` | [ ] |
| 2 | `lead-aging` | `0 13 * * *` | `agent-lead-aging` | `20260407000041_pg_cron.sql` | [ ] |
| 3 | `risk-monitor` | `0 12 * * *` | `agent-risk-monitor` | `20260407000041_pg_cron.sql` | [ ] |
| 4 | `sub-insurance-alert` | `0 14 * * *` | `agent-sub-insurance-alert` | `20260407000041_pg_cron.sql` | [ ] |
| 5 | `invoice-aging` | `30 13 * * *` | `agent-invoice-aging` | `20260407000041_pg_cron.sql` | [ ] |
| 6 | `weekly-client-update` | `0 21 * * 5` | `agent-weekly-client-update` | `20260407000041_pg_cron.sql` | [ ] |
| 7 | `weekly-financials` | `0 12 * * 1` | `agent-weekly-financials` | `20260407000041_pg_cron.sql` | [ ] |
| 8 | `cash-flow` | `0 21 * * 5` | `agent-cash-flow` | `20260407000041_pg_cron.sql` | [ ] |
| 9 | `social-content` | `0 13 * * 0` | `agent-social-content` | `20260407000041_pg_cron.sql` | [ ] |
| 10 | `warranty-tracker` | `0 14 * * *` | `agent-warranty-tracker` | `20260407000041_pg_cron.sql` | [ ] |
| 11 | `weather-schedule` | `30 11 * * *` | `agent-weather-schedule` | `20260407000041_pg_cron.sql` | [ ] |
| 12 | `daily-log` | `30 22 * * *` | `agent-daily-log` | `20260407000041_pg_cron.sql` | [ ] |
| 13 | `meta-agent-orchestration` | `0 11 * * 1` | `meta-agent-orchestration` | `20260407000041_pg_cron.sql` | [ ] |
| 14 | `improvement-analysis` | `0 3 * * 1` | `agent-improvement-analysis` | `20260407000041_pg_cron.sql` | [ ] |
| 15 | `compliance-monitor` | `0 12 * * *` | `agent-compliance-monitor` | `20260407000077_h23_compliance_cron.sql` | [ ] |
| 16 | `inventory-alerts` | `22 13 * * *` | `agent-inventory-alerts` | `20260415000800_inventory_alerts.sql` | [ ] |
| 17 | `inventory-alerts-digest` | `37 13 * * *` | `notify-inventory-alerts` | `20260415001200_inventory_notification_cron.sql` | [ ] |

---

## 4. Rate Limit Coverage

Functions with an explicit entry in `_shared/rate-limit.ts` RATE_LIMITS.
Functions without an entry fall back to the default (60 req / 3600s).

| # | Function | Has rate limit? | Config |
|---|----------|----------------|--------|
| 1 | `agent-bonus-qualification` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 2 | `agent-calibrate-templates` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 3 | `agent-call-summarizer` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 4 | `agent-cash-flow` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 5 | `agent-change-order-drafter` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 6 | `agent-compliance-monitor` | Yes |  maxRequests: 5, windowSeconds: 3600  |
| 7 | `agent-conversation-transcriber` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 8 | `agent-daily-log` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 9 | `agent-document-classifier` | Yes |  maxRequests: 50, windowSeconds: 3600  |
| 10 | `agent-generate-contract` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 11 | `agent-generate-reel` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 12 | `agent-generate-scope` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 13 | `agent-improvement-analysis` | Yes |  maxRequests: 5, windowSeconds: 86400  |
| 14 | `agent-inspection-analyzer` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 15 | `agent-inventory-alerts` | Yes |  maxRequests: 2, windowSeconds: 86400  |
| 16 | `agent-invoice-aging` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 17 | `agent-invoice-generator` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 18 | `agent-lead-aging` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 19 | `agent-lead-intake` | Yes |  maxRequests: 50, windowSeconds: 3600  |
| 20 | `agent-morning-brief` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 21 | `agent-photo-stocktake` | Yes |  maxRequests: 50, windowSeconds: 3600  |
| 22 | `agent-photo-tagger` | Yes |  maxRequests: 100, windowSeconds: 3600  |
| 23 | `agent-portfolio-curator` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 24 | `agent-proposal-writer` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 25 | `agent-punch-list` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 26 | `agent-quote-reader` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 27 | `agent-receipt-processor` | Yes |  maxRequests: 100, windowSeconds: 3600  |
| 28 | `agent-referral-intake` | Yes |  maxRequests: 50, windowSeconds: 3600  |
| 29 | `agent-review-request` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 30 | `agent-risk-monitor` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 31 | `agent-schedule-optimizer` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 32 | `agent-sms-responder` | Yes |  maxRequests: 100, windowSeconds: 3600  |
| 33 | `agent-social-content` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 34 | `agent-sub-insurance-alert` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 35 | `agent-sub-invoice-matcher` | Yes |  maxRequests: 50, windowSeconds: 3600  |
| 36 | `agent-template-improvement-suggester` | Yes |  maxRequests: 5, windowSeconds: 86400  |
| 37 | `agent-tool-request` | Yes |  maxRequests: 50, windowSeconds: 3600  |
| 38 | `agent-voice-transcriber` | Yes |  maxRequests: 50, windowSeconds: 3600  |
| 39 | `agent-warranty-intake` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 40 | `agent-warranty-tracker` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 41 | `agent-weather-schedule` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 42 | `agent-weekly-client-update` | Yes |  maxRequests: 5, windowSeconds: 3600  |
| 43 | `agent-weekly-financials` | Yes |  maxRequests: 5, windowSeconds: 3600  |
| 44 | `ai-inventory-query` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 45 | `ai-suggest-project-action` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 46 | `apply-project-suggestion` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 47 | `assemble-context` | Yes |  maxRequests: 200, windowSeconds: 3600  |
| 48 | `backup-daily` | Yes |  maxRequests: 3, windowSeconds: 86400  |
| 49 | `backup-database` | Yes |  maxRequests: 5, windowSeconds: 86400  |
| 50 | `backup-storage-manifest` | Yes |  maxRequests: 3, windowSeconds: 86400  |
| 51 | `budget-ai-action` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 52 | `calculate-payroll` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 53 | `compare-budget-quotes` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 54 | `deduct-shopping-item-from-stock` | Yes |  maxRequests: 50, windowSeconds: 3600  |
| 55 | `demo-ai` | Yes |  maxRequests: 60, windowSeconds: 3600  |
| 56 | `extract-preferences` | Yes |  maxRequests: 100, windowSeconds: 3600  |
| 57 | `generate-checklists` | Yes |  maxRequests: 100, windowSeconds: 3600  |
| 58 | `generate-embedding` | Yes |  maxRequests: 500, windowSeconds: 3600  |
| 59 | `generate-estimate` | Yes |  maxRequests: 20, windowSeconds: 3600  |
| 60 | `generate-improvement-spec` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 61 | `generate-payroll-register` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 62 | `generate-pdf` | Yes |  maxRequests: 50, windowSeconds: 3600  |
| 63 | `generate-progress-reel` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 64 | `get-usage-stats` | Yes |  maxRequests: 60, windowSeconds: 3600  |
| 65 | `github-webhook` | Yes |  maxRequests: 500, windowSeconds: 3600  |
| 66 | `invite-client-to-portal` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 67 | `meta-agent-chat` | Yes |  maxRequests: 100, windowSeconds: 3600  |
| 68 | `meta-agent-open-pr` | Yes |  maxRequests: 10, windowSeconds: 3600  |
| 69 | `meta-agent-orchestration` | Yes |  maxRequests: 5, windowSeconds: 86400  |
| 70 | `notify-inventory-alerts` | Yes |  maxRequests: 5, windowSeconds: 86400  |
| 71 | `process-budget-document` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 72 | `reject-project-suggestion` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 73 | `send-email` | Yes |  maxRequests: 50, windowSeconds: 3600  |
| 74 | `stripe-webhook` | Yes |  maxRequests: 500, windowSeconds: 3600  |
| 75 | `suggest-deliverable-items` | Yes |  maxRequests: 60, windowSeconds: 3600  |
| 76 | `sync-google-drive` | Yes |  maxRequests: 30, windowSeconds: 3600  |
| 77 | `sync-to-drive` | Yes |  maxRequests: 100, windowSeconds: 3600  |
| 78 | `sync-to-gusto` | Yes |  maxRequests: 5, windowSeconds: 3600  |
| 79 | `update-operational-memory` | Yes |  maxRequests: 500, windowSeconds: 3600  |

---

## Summary

- **Migrations**: 118 files to verify
- **Edge functions**: 79 deployable directories
- **Cron jobs**: 23 scheduled jobs
- **Rate limits**: 0 functions using default rate limit

> Run `bash scripts/verify-deployment.sh` to regenerate this file.
