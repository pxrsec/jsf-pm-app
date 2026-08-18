-- =============================================================================
-- Joya Star Films PM App — Static Configuration Seed Data
-- =============================================================================
-- This file contains strictly Auth-independent, idempotent static configuration
-- records required by the application runtime.
--
-- Non-negotiable boundaries:
-- - No Auth users
-- - No user profiles
-- - No business data (clients, projects, tasks, deliverables, comments, audits)
-- - No passwords, tokens, API keys, or real identities
-- =============================================================================

INSERT INTO public.whatsapp_templates (
  logical_name,
  version,
  meta_template_name,
  category,
  language_code,
  status,
  body_preview,
  variable_schema,
  is_active
) VALUES
(
  'onboarding_invitation',
  1,
  'jsf_onboarding_invitation_v1',
  'UTILITY',
  'es_MX',
  'draft',
  'Hola {{1}}, has sido invitado al portal de proyectos de Joya Star Films. Accede aquí: {{2}}',
  '{"variables": ["recipient_name", "invite_url"]}'::jsonb,
  true
),
(
  'new_deliverable_review',
  1,
  'jsf_new_deliverable_review_v1',
  'UTILITY',
  'es_MX',
  'draft',
  'Hola {{1}}, hay un nuevo entregable listo para revisión en el proyecto {{2}}: {{3}}. Revisa los detalles aquí: {{4}}',
  '{"variables": ["recipient_name", "project_name", "deliverable_title", "review_url"]}'::jsonb,
  true
),
(
  'changes_requested_alert',
  1,
  'jsf_changes_requested_alert_v1',
  'UTILITY',
  'es_MX',
  'draft',
  'Hola {{1}}, se han solicitado cambios en el entregable {{2}} del proyecto {{3}}. Comentarios: {{4}}',
  '{"variables": ["recipient_name", "deliverable_title", "project_name", "comments_summary"]}'::jsonb,
  true
),
(
  'final_delivery_confirmation',
  1,
  'jsf_final_delivery_confirmation_v1',
  'UTILITY',
  'es_MX',
  'draft',
  'Hola {{1}}, el entregable final {{2}} del proyecto {{3}} ha sido entregado exitosamente.',
  '{"variables": ["recipient_name", "deliverable_title", "project_name"]}'::jsonb,
  true
)
ON CONFLICT (logical_name, version) WHERE deleted_at IS NULL DO NOTHING;
