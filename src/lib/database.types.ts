export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"] | null
          changed_fields: Json
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: number
          ip_address: unknown
          new_status: string | null
          old_status: string | null
          project_id: string | null
          request_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          changed_fields?: Json
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: never
          ip_address?: unknown
          new_status?: string | null
          old_status?: string | null
          project_id?: string | null
          request_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          changed_fields?: Json
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: never
          ip_address?: unknown
          new_status?: string | null
          old_status?: string | null
          project_id?: string | null
          request_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          color_override: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          ends_at: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id: string
          is_all_day: boolean
          project_id: string
          starts_at: string
          task_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color_override?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          is_all_day?: boolean
          project_id: string
          starts_at: string
          task_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color_override?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          is_all_day?: boolean
          project_id?: string
          starts_at?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "client_task_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "operator_agenda_view"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_primary: boolean
          job_title: string | null
          phone_e164: string | null
          profile_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          full_name: string
          id?: string
          is_primary?: boolean
          job_title?: string | null
          phone_e164?: string | null
          profile_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_primary?: boolean
          job_title?: string | null
          phone_e164?: string | null
          profile_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          created_by: string | null
          default_drive_folder_url: string | null
          deleted_at: string | null
          display_name: string
          id: string
          is_active: boolean
          legal_name: string
          notes: string | null
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_drive_folder_url?: string | null
          deleted_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          legal_name: string
          notes?: string | null
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_drive_folder_url?: string | null
          deleted_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          legal_name?: string
          notes?: string | null
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      collaboration_comments: {
        Row: {
          author_capacity_snapshot: Database["public"]["Enums"]["collaboration_author_capacity"]
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          project_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["collaboration_target_type"]
        }
        Insert: {
          author_capacity_snapshot: Database["public"]["Enums"]["collaboration_author_capacity"]
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          project_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["collaboration_target_type"]
        }
        Update: {
          author_capacity_snapshot?: Database["public"]["Enums"]["collaboration_author_capacity"]
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          project_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["collaboration_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "collaboration_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_feedback: {
        Row: {
          comments: string | null
          created_at: string
          decision: Database["public"]["Enums"]["review_decision"]
          deliverable_id: string
          id: string
          reviewed_at: string
          reviewed_by: string
          stage: Database["public"]["Enums"]["review_stage"]
          version_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          decision: Database["public"]["Enums"]["review_decision"]
          deliverable_id: string
          id?: string
          reviewed_at?: string
          reviewed_by: string
          stage: Database["public"]["Enums"]["review_stage"]
          version_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["review_decision"]
          deliverable_id?: string
          id?: string
          reviewed_at?: string
          reviewed_by?: string
          stage?: Database["public"]["Enums"]["review_stage"]
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_feedback_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "client_deliverable_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_feedback_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "client_submission_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_feedback_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverable_cycle_metrics_view"
            referencedColumns: ["deliverable_id"]
          },
          {
            foreignKeyName: "deliverable_feedback_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_feedback_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "operator_agenda_view"
            referencedColumns: ["deliverable_id"]
          },
          {
            foreignKeyName: "deliverable_feedback_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "deliverable_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_link_reports: {
        Row: {
          created_at: string
          deliverable_id: string
          id: string
          reason: string | null
          reported_by: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["link_report_status"]
          updated_at: string
          version_id: string | null
        }
        Insert: {
          created_at?: string
          deliverable_id: string
          id?: string
          reason?: string | null
          reported_by: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["link_report_status"]
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          created_at?: string
          deliverable_id?: string
          id?: string
          reason?: string | null
          reported_by?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["link_report_status"]
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_link_reports_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "client_deliverable_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_link_reports_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "client_submission_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_link_reports_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverable_cycle_metrics_view"
            referencedColumns: ["deliverable_id"]
          },
          {
            foreignKeyName: "deliverable_link_reports_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_link_reports_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "operator_agenda_view"
            referencedColumns: ["deliverable_id"]
          },
          {
            foreignKeyName: "deliverable_link_reports_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "deliverable_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_versions: {
        Row: {
          created_at: string
          deliverable_id: string
          id: string
          submission_note: string | null
          submission_provider: Database["public"]["Enums"]["submission_provider"]
          submission_url: string
          submitted_at: string
          submitted_by: string
          version_number: number
        }
        Insert: {
          created_at?: string
          deliverable_id: string
          id?: string
          submission_note?: string | null
          submission_provider: Database["public"]["Enums"]["submission_provider"]
          submission_url: string
          submitted_at?: string
          submitted_by: string
          version_number: number
        }
        Update: {
          created_at?: string
          deliverable_id?: string
          id?: string
          submission_note?: string | null
          submission_provider?: Database["public"]["Enums"]["submission_provider"]
          submission_url?: string
          submitted_at?: string
          submitted_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_versions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "client_deliverable_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_versions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "client_submission_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_versions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverable_cycle_metrics_view"
            referencedColumns: ["deliverable_id"]
          },
          {
            foreignKeyName: "deliverable_versions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverable_versions_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "operator_agenda_view"
            referencedColumns: ["deliverable_id"]
          },
        ]
      }
      deliverables: {
        Row: {
          approved_at: string | null
          assignee_id: string
          client_delivery_deadline_at: string | null
          created_at: string
          created_by: string
          current_version_number: number
          deleted_at: string | null
          delivered_at: string | null
          id: string
          internal_review_deadline_at: string | null
          is_stalled: boolean
          last_activity_at: string
          project_id: string
          specifications: string
          stalled_at: string | null
          status: Database["public"]["Enums"]["deliverable_status"]
          submission_deadline_at: string | null
          task_id: string
          title: string
          updated_at: string
          updated_by: string | null
          workflow_type: Database["public"]["Enums"]["deliverable_workflow_type"]
        }
        Insert: {
          approved_at?: string | null
          assignee_id: string
          client_delivery_deadline_at?: string | null
          created_at?: string
          created_by: string
          current_version_number?: number
          deleted_at?: string | null
          delivered_at?: string | null
          id?: string
          internal_review_deadline_at?: string | null
          is_stalled?: boolean
          last_activity_at?: string
          project_id: string
          specifications: string
          stalled_at?: string | null
          status?: Database["public"]["Enums"]["deliverable_status"]
          submission_deadline_at?: string | null
          task_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
          workflow_type?: Database["public"]["Enums"]["deliverable_workflow_type"]
        }
        Update: {
          approved_at?: string | null
          assignee_id?: string
          client_delivery_deadline_at?: string | null
          created_at?: string
          created_by?: string
          current_version_number?: number
          deleted_at?: string | null
          delivered_at?: string | null
          id?: string
          internal_review_deadline_at?: string | null
          is_stalled?: boolean
          last_activity_at?: string
          project_id?: string
          specifications?: string
          stalled_at?: string | null
          status?: Database["public"]["Enums"]["deliverable_status"]
          submission_deadline_at?: string | null
          task_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          workflow_type?: Database["public"]["Enums"]["deliverable_workflow_type"]
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "client_task_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "operator_agenda_view"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_tokens: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          client_id: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          project_id: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invite_status"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          client_id?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at: string
          id?: string
          project_id?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          project_id?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invite_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          actor_id: string | null
          created_at: string
          deduplication_key: string
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          occurred_at: string
          payload: Json
          project_id: string | null
          trigger: Database["public"]["Enums"]["notification_trigger"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          deduplication_key: string
          entity_id?: string | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          occurred_at?: string
          payload?: Json
          project_id?: string | null
          trigger: Database["public"]["Enums"]["notification_trigger"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          deduplication_key?: string
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          occurred_at?: string
          payload?: Json
          project_id?: string | null
          trigger?: Database["public"]["Enums"]["notification_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notification_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_recipients: {
        Row: {
          attempt_count: number
          channel: Database["public"]["Enums"]["notification_channel"]
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: Database["public"]["Enums"]["notification_delivery_status"]
          event_id: string
          failed_at: string | null
          id: string
          next_attempt_at: string | null
          provider_error_code: string | null
          provider_error_message: string | null
          provider_message_id: string | null
          read_at: string | null
          sent_at: string | null
          suppressed_at: string | null
          suppression_reason: string | null
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          channel: Database["public"]["Enums"]["notification_channel"]
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          event_id: string
          failed_at?: string | null
          id?: string
          next_attempt_at?: string | null
          provider_error_code?: string | null
          provider_error_message?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          suppressed_at?: string | null
          suppression_reason?: string | null
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          event_id?: string
          failed_at?: string | null
          id?: string
          next_attempt_at?: string | null
          provider_error_code?: string | null
          provider_error_message?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          suppressed_at?: string | null
          suppression_reason?: string | null
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          email_notifications_enabled: boolean
          full_name: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          phone_e164: string | null
          preferred_locale: string
          role: Database["public"]["Enums"]["app_role"]
          timezone: string
          updated_at: string
          whatsapp_consent_at: string | null
          whatsapp_consent_ip: unknown
          whatsapp_consent_source: string | null
          whatsapp_opt_in: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email_notifications_enabled?: boolean
          full_name: string
          id: string
          is_active?: boolean
          last_seen_at?: string | null
          phone_e164?: string | null
          preferred_locale?: string
          role: Database["public"]["Enums"]["app_role"]
          timezone?: string
          updated_at?: string
          whatsapp_consent_at?: string | null
          whatsapp_consent_ip?: unknown
          whatsapp_consent_source?: string | null
          whatsapp_opt_in?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email_notifications_enabled?: boolean
          full_name?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          phone_e164?: string | null
          preferred_locale?: string
          role?: Database["public"]["Enums"]["app_role"]
          timezone?: string
          updated_at?: string
          whatsapp_consent_at?: string | null
          whatsapp_consent_ip?: unknown
          whatsapp_consent_source?: string | null
          whatsapp_opt_in?: boolean
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          is_primary: boolean
          joined_at: string
          member_type: Database["public"]["Enums"]["project_member_type"]
          project_id: string
          receives_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          joined_at?: string
          member_type: Database["public"]["Enums"]["project_member_type"]
          project_id: string
          receives_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          joined_at?: string
          member_type?: Database["public"]["Enums"]["project_member_type"]
          project_id?: string
          receives_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          client_id: string | null
          client_scope: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          deadline_at: string
          deleted_at: string | null
          drive_folder_url: string | null
          id: string
          internal_description: string
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          client_id?: string | null
          client_scope?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          deadline_at: string
          deleted_at?: string | null
          drive_folder_url?: string | null
          id?: string
          internal_description: string
          name: string
          project_type?: Database["public"]["Enums"]["project_type"]
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          client_id?: string | null
          client_scope?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deadline_at?: string
          deleted_at?: string | null
          drive_folder_url?: string | null
          id?: string
          internal_description?: string
          name?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      task_resources: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          name: string
          sort_order: number
          task_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          name: string
          sort_order?: number
          task_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          name?: string
          sort_order?: number
          task_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_resources_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "client_task_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_resources_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "operator_agenda_view"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "task_resources_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_at: string
          assignee_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          deadline_at: string
          deleted_at: string | null
          description: string
          has_deliverables: boolean
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_at?: string
          assignee_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          deadline_at: string
          deleted_at?: string | null
          description: string
          has_deliverables?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_at?: string
          assignee_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deadline_at?: string
          deleted_at?: string | null
          description?: string
          has_deliverables?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_preview: string | null
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          language_code: string
          logical_name: string
          meta_template_id: string | null
          meta_template_name: string
          status: Database["public"]["Enums"]["whatsapp_template_status"]
          updated_at: string
          updated_by: string | null
          variable_schema: Json
          version: number
        }
        Insert: {
          body_preview?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          language_code?: string
          logical_name: string
          meta_template_id?: string | null
          meta_template_name: string
          status?: Database["public"]["Enums"]["whatsapp_template_status"]
          updated_at?: string
          updated_by?: string | null
          variable_schema?: Json
          version?: number
        }
        Update: {
          body_preview?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          language_code?: string
          logical_name?: string
          meta_template_id?: string | null
          meta_template_name?: string
          status?: Database["public"]["Enums"]["whatsapp_template_status"]
          updated_at?: string
          updated_by?: string | null
          variable_schema?: Json
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      calendar_feed_view: {
        Row: {
          color_override: string | null
          ends_at: string | null
          entity_id: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"] | null
          is_all_day: boolean | null
          project_id: string | null
          starts_at: string | null
          title: string | null
        }
        Relationships: []
      }
      client_deliverable_view: {
        Row: {
          approved_at: string | null
          client_delivery_deadline_at: string | null
          client_feedback_history: Json | null
          created_at: string | null
          current_submission_note: string | null
          current_submission_provider:
            | Database["public"]["Enums"]["submission_provider"]
            | null
          current_submission_url: string | null
          current_submitted_at: string | null
          current_version_number: number | null
          delivered_at: string | null
          id: string | null
          project_id: string | null
          project_name: string | null
          specifications: string | null
          status: Database["public"]["Enums"]["deliverable_status"] | null
          task_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "client_task_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "operator_agenda_view"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_project_view: {
        Row: {
          archived_at: string | null
          client_id: string | null
          client_name: string | null
          client_scope: string | null
          completed_at: string | null
          created_at: string | null
          deadline_at: string | null
          drive_folder_url: string | null
          id: string | null
          last_deliverable_activity_at: string | null
          name: string | null
          status: Database["public"]["Enums"]["project_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_submission_view: {
        Row: {
          assignee_id: string | null
          correction_history: Json | null
          created_at: string | null
          current_submission_note: string | null
          current_submission_provider:
            | Database["public"]["Enums"]["submission_provider"]
            | null
          current_submission_url: string | null
          current_submitted_at: string | null
          current_version_number: number | null
          id: string | null
          last_activity_at: string | null
          project_id: string | null
          project_name: string | null
          specifications: string | null
          status: Database["public"]["Enums"]["deliverable_status"] | null
          submission_deadline_at: string | null
          task_id: string | null
          task_title: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "client_task_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "operator_agenda_view"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_task_view: {
        Row: {
          assignee_id: string | null
          child_submission_count: number | null
          completed_at: string | null
          created_at: string | null
          deadline_at: string | null
          description: string | null
          id: string | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          project_id: string | null
          project_name: string | null
          resources: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_cycle_metrics_view: {
        Row: {
          client_acted_at: string | null
          client_review_hours: number | null
          client_review_started_at: string | null
          current_version_number: number | null
          deliverable_id: string | null
          delivered_at: string | null
          first_submitted_at: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["deliverable_status"] | null
          title: string | null
          workflow_type:
            | Database["public"]["Enums"]["deliverable_workflow_type"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_unread_counts_view: {
        Row: {
          unread_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_agenda_view: {
        Row: {
          assigned_at: string | null
          client_delivery_deadline_at: string | null
          current_version_number: number | null
          deliverable_id: string | null
          deliverable_specifications: string | null
          deliverable_status:
            | Database["public"]["Enums"]["deliverable_status"]
            | null
          deliverable_title: string | null
          deliverable_workflow_type:
            | Database["public"]["Enums"]["deliverable_workflow_type"]
            | null
          internal_review_deadline_at: string | null
          project_id: string | null
          project_name: string | null
          submission_deadline_at: string | null
          task_deadline_at: string | null
          task_description: string | null
          task_id: string | null
          task_priority: Database["public"]["Enums"]["task_priority"] | null
          task_resources: Json | null
          task_started_at: string | null
          task_status: Database["public"]["Enums"]["task_status"] | null
          task_title: string | null
          urgency_category: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_project_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_completion_cycles_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_completion_cycles_view: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          current_completed_at: string | null
          current_project_status:
            | Database["public"]["Enums"]["project_status"]
            | null
          cycle_duration_days: number | null
          cycle_number: number | null
          override_confirmed: boolean | null
          project_id: string | null
          project_name: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          unfinished_deliverable_count: number | null
          unfinished_task_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invite: { Args: { p_token_hash: string }; Returns: Json }
      acknowledge_notification_and_navigate: {
        Args: { p_notification_recipient_id: string }
        Returns: boolean
      }
      create_calendar_milestone: {
        Args: {
          p_color_override?: string
          p_description?: string
          p_ends_at?: string
          p_is_all_day?: boolean
          p_project_id: string
          p_starts_at?: string
          p_task_id?: string
          p_title?: string
        }
        Returns: {
          color_override: string
          ends_at: string
          entity_id: string
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          is_all_day: boolean
          project_id: string
          project_name: string
          starts_at: string
          task_id: string
          title: string
        }[]
      }
      create_collaboration_comment: {
        Args: {
          p_body: string
          p_project_id: string
          p_target_id: string
          p_target_type: Database["public"]["Enums"]["collaboration_target_type"]
        }
        Returns: Json
      }
      evaluate_notification_alerts: {
        Args: { p_project_id?: string }
        Returns: Json
      }
      get_calendar_milestone_for_edit: {
        Args: { p_event_id: string }
        Returns: {
          color_override: string
          description: string
          ends_at: string
          entity_id: string
          is_all_day: boolean
          project_id: string
          project_name: string
          starts_at: string
          task_id: string
          title: string
        }[]
      }
      get_project_completion_readiness: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_scoped_operations_metrics: {
        Args: { p_from?: string; p_project_id?: string; p_to?: string }
        Returns: {
          active_task_count: number
          average_client_review_hours: number
          average_completion_cycle_duration_days: number
          client_review_cycle_count: number
          completion_cycle_count: number
          deadline_attention_count: number
          finalized_deliverable_count: number
          overdue_task_count: number
          production_deliverable_counts_by_status: Json
          project_counts_by_status: Json
          range_from: string
          range_to: string
          reopening_cycle_count: number
          suppressed_external_queue_count: number
          unread_in_app_queue_count: number
          unresolved_link_report_count: number
        }[]
      }
      list_admin_audit_history: {
        Args: {
          p_before_audit_id?: number
          p_before_created_at?: string
          p_from: string
          p_limit?: number
          p_to: string
        }
        Returns: {
          action: string
          actor_role: Database["public"]["Enums"]["app_role"]
          audit_id: number
          changed_field_summary: string
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          new_status: string
          old_status: string
          project_id: string
          project_name: string
        }[]
      }
      list_admin_user_invitation_state: {
        Args: {
          p_before_created_at?: string
          p_before_profile_id?: string
          p_limit?: number
        }
        Returns: {
          application_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          email_notifications_enabled: boolean
          full_name: string
          invitation_accepted_at: string
          invitation_expires_at: string
          invitation_id: string
          invitation_revoked_at: string
          invitation_status: Database["public"]["Enums"]["invite_status"]
          is_active: boolean
          last_seen_at: string
          preferred_locale: string
          profile_id: string
          project_id: string
          project_name: string
          record_id: string
          record_kind: string
          whatsapp_opt_in: boolean
        }[]
      }
      list_calendar_milestone_targets: {
        Args: never
        Returns: {
          project_id: string
          project_name: string
          task_id: string
          task_title: string
        }[]
      }
      list_finalized_production_archive: {
        Args: {
          p_before_deliverable_id?: string
          p_before_finalized_at?: string
          p_from?: string
          p_limit?: number
          p_project_id?: string
          p_status?: Database["public"]["Enums"]["deliverable_status"]
          p_to?: string
        }
        Returns: {
          current_submission_url: string
          current_version_number: number
          deliverable_id: string
          deliverable_title: string
          final_status: Database["public"]["Enums"]["deliverable_status"]
          finalized_at: string
          project_drive_folder_url: string
          project_id: string
          project_name: string
        }[]
      }
      list_my_in_app_notifications: {
        Args: {
          p_before_created_at?: string
          p_before_recipient_id?: string
          p_from?: string
          p_limit?: number
          p_read_state?: boolean
          p_to?: string
        }
        Returns: {
          context_kind: string
          context_value: string
          created_at: string
          navigation_deliverable_id: string
          navigation_kind: string
          navigation_project_id: string
          navigation_task_id: string
          occurred_at: string
          project_name: string
          read_at: string
          recipient_id: string
          subject_kind: string
          subject_title: string
          trigger: Database["public"]["Enums"]["notification_trigger"]
        }[]
      }
      list_role_safe_calendar_events: {
        Args: { p_from: string; p_project_id?: string; p_to: string }
        Returns: {
          color_override: string
          ends_at: string
          entity_id: string
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          is_all_day: boolean
          project_id: string
          project_name: string
          starts_at: string
          task_id: string
          title: string
        }[]
      }
      list_role_safe_link_incidents: {
        Args: {
          p_before_incident_id?: string
          p_before_reported_at?: string
          p_from?: string
          p_limit?: number
          p_project_id?: string
          p_status?: Database["public"]["Enums"]["link_report_status"]
          p_to?: string
        }
        Returns: {
          deliverable_id: string
          deliverable_title: string
          incident_id: string
          incident_status: Database["public"]["Enums"]["link_report_status"]
          project_id: string
          project_name: string
          reason: string
          reported_at: string
          resolution_note: string
          resolved_at: string
        }[]
      }
      list_scoped_metrics_project_filter_options: {
        Args: never
        Returns: {
          project_id: string
          project_name: string
        }[]
      }
      list_scoped_operations_metric_trend: {
        Args: { p_from?: string; p_project_id?: string; p_to?: string }
        Returns: {
          client_review_cycle_count: number
          completion_cycle_count: number
          finalized_deliverable_count: number
          period_end: string
          period_start: string
          reopening_cycle_count: number
        }[]
      }
      list_scoped_user_operations_metrics: {
        Args: {
          p_from?: string
          p_project_id?: string
          p_to?: string
          p_user_id?: string
        }
        Returns: {
          application_role: Database["public"]["Enums"]["app_role"]
          average_assignment_to_start_hours: number
          average_in_app_notification_read_hours: number
          client_submission_count: number
          current_active_task_count: number
          deliverable_delivered_count: number
          deliverable_review_count: number
          full_name: string
          in_app_notification_read_count: number
          in_app_notification_received_count: number
          in_app_notification_unread_count_at_range_end: number
          in_app_notification_unread_over_24h_count_at_range_end: number
          is_active: boolean
          last_workflow_action_at: string
          production_deliverable_submission_count: number
          range_from: string
          range_to: string
          task_assigned_count: number
          task_completed_count: number
          task_started_count: number
          unstarted_task_count_at_range_end: number
          user_id: string
        }[]
      }
      list_suppressed_notification_operations: {
        Args: {
          p_before_channel?: Database["public"]["Enums"]["notification_channel"]
          p_before_event_id?: string
          p_before_suppressed_at?: string
          p_limit?: number
        }
        Returns: {
          channel: Database["public"]["Enums"]["notification_channel"]
          delivery_status: Database["public"]["Enums"]["notification_delivery_status"]
          event_id: string
          first_created_at: string
          last_suppressed_at: string
          project_id: string
          project_name: string
          recipient_count: number
          suppression_reason: string
          trigger: Database["public"]["Enums"]["notification_trigger"]
        }[]
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_deliverable_delivered: {
        Args: { p_deliverable_id: string }
        Returns: Json
      }
      mark_notification_read: {
        Args: { p_notification_recipient_id: string }
        Returns: boolean
      }
      recover_project_status: {
        Args: {
          p_project_id: string
          p_reason: string
          p_target_status: Database["public"]["Enums"]["project_status"]
        }
        Returns: Json
      }
      reopen_client_deliverable: {
        Args: { p_deliverable_id: string; p_reason: string }
        Returns: Json
      }
      report_broken_link: {
        Args: {
          p_deliverable_id: string
          p_reason: string
          p_version_id: string
        }
        Returns: Json
      }
      restore_entity: {
        Args: {
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["entity_type"]
          p_reason?: string
        }
        Returns: boolean
      }
      review_deliverable: {
        Args: {
          p_comments?: string
          p_decision: Database["public"]["Enums"]["review_decision"]
          p_deliverable_id: string
          p_stage: Database["public"]["Enums"]["review_stage"]
        }
        Returns: Json
      }
      soft_delete_calendar_milestone: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      soft_delete_entity: {
        Args: {
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["entity_type"]
          p_reason?: string
        }
        Returns: boolean
      }
      submit_client_deliverable: {
        Args: {
          p_deliverable_id: string
          p_submission_note?: string
          p_submission_url: string
        }
        Returns: Json
      }
      submit_deliverable_version: {
        Args: {
          p_deliverable_id: string
          p_submission_note?: string
          p_submission_url: string
        }
        Returns: Json
      }
      transition_project_status: {
        Args: {
          p_confirm_unfinished?: boolean
          p_next_status: Database["public"]["Enums"]["project_status"]
          p_project_id: string
          p_reopen_reason?: string
        }
        Returns: Json
      }
      transition_task_status: {
        Args: {
          p_next_status: Database["public"]["Enums"]["task_status"]
          p_reopen_reason?: string
          p_task_id: string
        }
        Returns: Json
      }
      update_calendar_milestone: {
        Args: {
          p_color_override?: string
          p_description?: string
          p_ends_at?: string
          p_event_id: string
          p_is_all_day?: boolean
          p_project_id: string
          p_starts_at?: string
          p_task_id?: string
          p_title?: string
        }
        Returns: {
          color_override: string
          ends_at: string
          entity_id: string
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          is_all_day: boolean
          project_id: string
          project_name: string
          starts_at: string
          task_id: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "pm" | "operator" | "client"
      calendar_event_type:
        | "project_deadline"
        | "task_deadline"
        | "internal_review_deadline"
        | "client_delivery_deadline"
        | "milestone"
      collaboration_author_capacity:
        | "admin"
        | "pm_lead"
        | "pm_watcher"
        | "operator"
      collaboration_target_type: "project" | "task" | "deliverable"
      deliverable_status:
        | "pending"
        | "awaiting_internal_review"
        | "awaiting_client_review"
        | "approved"
        | "changes_requested"
        | "delivered"
        | "submitted"
      deliverable_workflow_type: "production" | "client_submission"
      entity_type:
        | "profile"
        | "client"
        | "project"
        | "project_member"
        | "task"
        | "deliverable"
        | "deliverable_version"
        | "feedback"
        | "calendar_event"
        | "notification"
        | "invite_token"
        | "collaboration_comment"
        | "link_report"
      invite_status: "pending" | "accepted" | "expired" | "revoked"
      link_report_status: "open" | "resolved" | "dismissed"
      notification_channel: "in_app" | "whatsapp" | "email"
      notification_delivery_status:
        | "pending"
        | "processing"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "cancelled"
        | "suppressed"
      notification_trigger:
        | "user_invited"
        | "project_assigned"
        | "task_assigned"
        | "task_status_changed"
        | "client_task_blocking"
        | "client_submission_received"
        | "client_submission_reopened"
        | "deliverable_submitted"
        | "internal_changes_requested"
        | "internal_review_approved"
        | "client_changes_requested"
        | "client_review_approved"
        | "deliverable_delivered"
        | "deadline_24h"
        | "deadline_12h"
        | "deadline_6h"
        | "deadline_overdue"
        | "review_inactivity_reminder"
        | "link_reported_broken"
        | "invite_expiring"
        | "system"
      project_member_type: "pm_lead" | "pm_watcher" | "operator" | "client"
      project_status:
        | "planning"
        | "in_progress"
        | "paused"
        | "completed"
        | "cancelled"
      project_type: "client" | "internal"
      review_decision: "approved" | "changes_requested"
      review_stage: "internal" | "client"
      submission_provider:
        | "google_drive"
        | "dropbox"
        | "onedrive"
        | "wetransfer"
        | "frame_io"
        | "other_https"
      task_priority: "low" | "medium" | "high" | "blocking"
      task_status:
        | "pending"
        | "in_progress"
        | "in_review"
        | "completed"
        | "blocked"
      task_type: "internal_work" | "client_request"
      whatsapp_template_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "paused"
        | "rejected"
        | "disabled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "pm", "operator", "client"],
      calendar_event_type: [
        "project_deadline",
        "task_deadline",
        "internal_review_deadline",
        "client_delivery_deadline",
        "milestone",
      ],
      collaboration_author_capacity: [
        "admin",
        "pm_lead",
        "pm_watcher",
        "operator",
      ],
      collaboration_target_type: ["project", "task", "deliverable"],
      deliverable_status: [
        "pending",
        "awaiting_internal_review",
        "awaiting_client_review",
        "approved",
        "changes_requested",
        "delivered",
        "submitted",
      ],
      deliverable_workflow_type: ["production", "client_submission"],
      entity_type: [
        "profile",
        "client",
        "project",
        "project_member",
        "task",
        "deliverable",
        "deliverable_version",
        "feedback",
        "calendar_event",
        "notification",
        "invite_token",
        "collaboration_comment",
        "link_report",
      ],
      invite_status: ["pending", "accepted", "expired", "revoked"],
      link_report_status: ["open", "resolved", "dismissed"],
      notification_channel: ["in_app", "whatsapp", "email"],
      notification_delivery_status: [
        "pending",
        "processing",
        "sent",
        "delivered",
        "read",
        "failed",
        "cancelled",
        "suppressed",
      ],
      notification_trigger: [
        "user_invited",
        "project_assigned",
        "task_assigned",
        "task_status_changed",
        "client_task_blocking",
        "client_submission_received",
        "client_submission_reopened",
        "deliverable_submitted",
        "internal_changes_requested",
        "internal_review_approved",
        "client_changes_requested",
        "client_review_approved",
        "deliverable_delivered",
        "deadline_24h",
        "deadline_12h",
        "deadline_6h",
        "deadline_overdue",
        "review_inactivity_reminder",
        "link_reported_broken",
        "invite_expiring",
        "system",
      ],
      project_member_type: ["pm_lead", "pm_watcher", "operator", "client"],
      project_status: [
        "planning",
        "in_progress",
        "paused",
        "completed",
        "cancelled",
      ],
      project_type: ["client", "internal"],
      review_decision: ["approved", "changes_requested"],
      review_stage: ["internal", "client"],
      submission_provider: [
        "google_drive",
        "dropbox",
        "onedrive",
        "wetransfer",
        "frame_io",
        "other_https",
      ],
      task_priority: ["low", "medium", "high", "blocking"],
      task_status: [
        "pending",
        "in_progress",
        "in_review",
        "completed",
        "blocked",
      ],
      task_type: ["internal_work", "client_request"],
      whatsapp_template_status: [
        "draft",
        "pending_approval",
        "approved",
        "paused",
        "rejected",
        "disabled",
      ],
    },
  },
} as const
