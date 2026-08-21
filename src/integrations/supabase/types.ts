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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          body: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          event_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          min_tier: string
          severity: string
          starts_at: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_tier?: string
          severity?: string
          starts_at?: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_tier?: string
          severity?: string
          starts_at?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      antifraud_allowlist: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          expires_at: string | null
          id: string
          ip_hash: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          expires_at?: string | null
          id?: string
          ip_hash: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          expires_at?: string | null
          id?: string
          ip_hash?: string
          reason?: string | null
        }
        Relationships: []
      }
      apk_build_jobs: {
        Row: {
          app_name: string
          created_at: string
          error_message: string | null
          id: string
          original_apk_url: string | null
          original_icon_url: string | null
          output_apk_url: string | null
          progress: number
          status: Database["public"]["Enums"]["apk_build_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          app_name: string
          created_at?: string
          error_message?: string | null
          id?: string
          original_apk_url?: string | null
          original_icon_url?: string | null
          output_apk_url?: string | null
          progress?: number
          status?: Database["public"]["Enums"]["apk_build_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          app_name?: string
          created_at?: string
          error_message?: string | null
          id?: string
          original_apk_url?: string | null
          original_icon_url?: string | null
          output_apk_url?: string | null
          progress?: number
          status?: Database["public"]["Enums"]["apk_build_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      apk_dropper_configs: {
        Row: {
          config_json: Json | null
          created_at: string | null
          dropper_type: string | null
          id: string
          job_id: string | null
        }
        Insert: {
          config_json?: Json | null
          created_at?: string | null
          dropper_type?: string | null
          id?: string
          job_id?: string | null
        }
        Update: {
          config_json?: Json | null
          created_at?: string | null
          dropper_type?: string | null
          id?: string
          job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apk_dropper_configs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "apk_build_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      apk_free_trials: {
        Row: {
          attrs_hash: string | null
          device_hash: string | null
          ip_hash: string | null
          ip_prefix_hash: string | null
          job_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          attrs_hash?: string | null
          device_hash?: string | null
          ip_hash?: string | null
          ip_prefix_hash?: string | null
          job_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          attrs_hash?: string | null
          device_hash?: string | null
          ip_hash?: string | null
          ip_prefix_hash?: string | null
          job_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      apk_jobs: {
        Row: {
          claimed_at: string | null
          cleared_at: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          expires_at: string
          id: string
          is_free_trial: boolean
          order_id: string | null
          queued_at: string
          result_filename: string | null
          result_path: string | null
          result_size_bytes: number | null
          source_filename: string
          source_path: string
          source_size_bytes: number
          started_at: string | null
          status: Database["public"]["Enums"]["apk_job_status"]
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          cleared_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          is_free_trial?: boolean
          order_id?: string | null
          queued_at?: string
          result_filename?: string | null
          result_path?: string | null
          result_size_bytes?: number | null
          source_filename: string
          source_path: string
          source_size_bytes: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["apk_job_status"]
          updated_at?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          cleared_at?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          is_free_trial?: boolean
          order_id?: string | null
          queued_at?: string
          result_filename?: string | null
          result_path?: string | null
          result_size_bytes?: number | null
          source_filename?: string
          source_path?: string
          source_size_bytes?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["apk_job_status"]
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apk_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apk_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "public_recent_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          created_at: string | null
          decision: string | null
          event: string
          id: string
          metadata: Json | null
          reason: string | null
          system: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          decision?: string | null
          event: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          system?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          decision?: string | null
          event?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          system?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cashback_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashback_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashback_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "public_recent_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      community_giveaway_winners: {
        Row: {
          created_at: string
          giveaway_id: string
          id: string
          plan_slug: string
          position: number
          prize_days: number
          prize_kind: string
          redeem_code_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          giveaway_id: string
          id?: string
          plan_slug: string
          position: number
          prize_days: number
          prize_kind: string
          redeem_code_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          giveaway_id?: string
          id?: string
          plan_slug?: string
          position?: number
          prize_days?: number
          prize_kind?: string
          redeem_code_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_giveaway_winners_giveaway_id_fkey"
            columns: ["giveaway_id"]
            isOneToOne: false
            referencedRelation: "community_giveaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_giveaway_winners_redeem_code_id_fkey"
            columns: ["redeem_code_id"]
            isOneToOne: false
            referencedRelation: "redeem_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      community_giveaways: {
        Row: {
          completed_at: string | null
          created_at: string
          eligible_count: number
          id: string
          milestone: number
          status: string
          title: string
          updated_at: string
          winner_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          eligible_count?: number
          id?: string
          milestone: number
          status?: string
          title: string
          updated_at?: string
          winner_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          eligible_count?: number
          id?: string
          milestone?: number
          status?: string
          title?: string
          updated_at?: string
          winner_count?: number
        }
        Relationships: []
      }
      community_goals: {
        Row: {
          achieved_at: string | null
          benefit_description: string | null
          created_at: string | null
          current_members: number | null
          id: string
          is_active: boolean | null
          reward_description: string
          target_members: number
          updated_at: string | null
        }
        Insert: {
          achieved_at?: string | null
          benefit_description?: string | null
          created_at?: string | null
          current_members?: number | null
          id?: string
          is_active?: boolean | null
          reward_description: string
          target_members: number
          updated_at?: string | null
        }
        Update: {
          achieved_at?: string | null
          benefit_description?: string | null
          created_at?: string | null
          current_members?: number | null
          id?: string
          is_active?: boolean | null
          reward_description?: string
          target_members?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      community_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          cashback_pct: number
          code: string
          created_at: string
          discount_pct: number
          expires_at: string | null
          first_deposit_only: boolean
          label: string | null
          plan_slug: string | null
          source: string
          user_id: string | null
          uses_left: number | null
        }
        Insert: {
          active?: boolean
          cashback_pct?: number
          code: string
          created_at?: string
          discount_pct?: number
          expires_at?: string | null
          first_deposit_only?: boolean
          label?: string | null
          plan_slug?: string | null
          source?: string
          user_id?: string | null
          uses_left?: number | null
        }
        Update: {
          active?: boolean
          cashback_pct?: number
          code?: string
          created_at?: string
          discount_pct?: number
          expires_at?: string | null
          first_deposit_only?: boolean
          label?: string | null
          plan_slug?: string | null
          source?: string
          user_id?: string | null
          uses_left?: number | null
        }
        Relationships: []
      }
      crypto_payments: {
        Row: {
          admin_note: string | null
          amount_brl: number | null
          amount_brl_verified: number | null
          amount_crypto: number | null
          coin: string
          confirmations: number
          created_at: string
          expected_address: string
          failure_reason: string | null
          fulfilled_at: string | null
          fx_rate_brl: number | null
          id: string
          last_checked_at: string | null
          network: string
          order_id: string | null
          plan_slug: string
          proof_path: string | null
          required_confirmations: number
          status: string
          tx_hash: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          admin_note?: string | null
          amount_brl?: number | null
          amount_brl_verified?: number | null
          amount_crypto?: number | null
          coin: string
          confirmations?: number
          created_at?: string
          expected_address: string
          failure_reason?: string | null
          fulfilled_at?: string | null
          fx_rate_brl?: number | null
          id?: string
          last_checked_at?: string | null
          network: string
          order_id?: string | null
          plan_slug: string
          proof_path?: string | null
          required_confirmations?: number
          status?: string
          tx_hash: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          admin_note?: string | null
          amount_brl?: number | null
          amount_brl_verified?: number | null
          amount_crypto?: number | null
          coin?: string
          confirmations?: number
          created_at?: string
          expected_address?: string
          failure_reason?: string | null
          fulfilled_at?: string | null
          fx_rate_brl?: number | null
          id?: string
          last_checked_at?: string | null
          network?: string
          order_id?: string | null
          plan_slug?: string
          proof_path?: string | null
          required_confirmations?: number
          status?: string
          tx_hash?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crypto_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "public_recent_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      device_identities: {
        Row: {
          attrs_hash: string | null
          created_at: string
          device_hash: string
          first_seen_at: string
          id: string
          ip_hash: string | null
          ip_prefix_hash: string | null
          last_seen_at: string
          seen_count: number
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          attrs_hash?: string | null
          created_at?: string
          device_hash: string
          first_seen_at?: string
          id?: string
          ip_hash?: string | null
          ip_prefix_hash?: string | null
          last_seen_at?: string
          seen_count?: number
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          attrs_hash?: string | null
          created_at?: string
          device_hash?: string
          first_seen_at?: string
          id?: string
          ip_hash?: string | null
          ip_prefix_hash?: string | null
          last_seen_at?: string
          seen_count?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_confirm_retries: {
        Row: {
          attempts: number
          created_at: string
          done: boolean
          email: string
          last_attempt_at: string | null
          last_error: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          done?: boolean
          email: string
          last_attempt_at?: string | null
          last_error?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          done?: boolean
          email?: string
          last_attempt_at?: string | null
          last_error?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fraud_assessments: {
        Row: {
          action: string
          attrs_hash: string | null
          created_at: string
          decision: string
          device_hash: string | null
          id: string
          ip_hash: string | null
          ip_prefix_hash: string | null
          reasons: Json
          score: number
          user_id: string
        }
        Insert: {
          action: string
          attrs_hash?: string | null
          created_at?: string
          decision: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          ip_prefix_hash?: string | null
          reasons?: Json
          score?: number
          user_id: string
        }
        Update: {
          action?: string
          attrs_hash?: string | null
          created_at?: string
          decision?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          ip_prefix_hash?: string | null
          reasons?: Json
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          action: string | null
          attempt: number | null
          context: Json | null
          created_at: string
          endpoint_kind: string | null
          error: string | null
          http_status: number | null
          id: string
          latency_ms: number | null
          outcome: string | null
          payload: Json | null
          response_body: string | null
          source: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          attempt?: number | null
          context?: Json | null
          created_at?: string
          endpoint_kind?: string | null
          error?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          outcome?: string | null
          payload?: Json | null
          response_body?: string | null
          source: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          attempt?: number | null
          context?: Json | null
          created_at?: string
          endpoint_kind?: string | null
          error?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          outcome?: string | null
          payload?: Json | null
          response_body?: string | null
          source?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      license_audit_events: {
        Row: {
          actor_id: string | null
          actor_kind: string
          created_at: string
          details: Json
          event_type: string
          expires_after: string | null
          expires_before: string | null
          id: string
          license_id: string | null
          panel: string | null
          reason: string | null
          user_id: string | null
          yaarsa_email: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          details?: Json
          event_type: string
          expires_after?: string | null
          expires_before?: string | null
          id?: string
          license_id?: string | null
          panel?: string | null
          reason?: string | null
          user_id?: string | null
          yaarsa_email?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          details?: Json
          event_type?: string
          expires_after?: string | null
          expires_before?: string | null
          id?: string
          license_id?: string | null
          panel?: string | null
          reason?: string | null
          user_id?: string | null
          yaarsa_email?: string | null
        }
        Relationships: []
      }
      license_history: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          license_id: string
          status_from: Database["public"]["Enums"]["license_status"] | null
          status_to: Database["public"]["Enums"]["license_status"] | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          license_id: string
          status_from?: Database["public"]["Enums"]["license_status"] | null
          status_to?: Database["public"]["Enums"]["license_status"] | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          license_id?: string
          status_from?: Database["public"]["Enums"]["license_status"] | null
          status_to?: Database["public"]["Enums"]["license_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_history_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      license_monitoring_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          issue_type: string
          license_id: string | null
          resolved: boolean | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          issue_type: string
          license_id?: string | null
          resolved?: boolean | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          issue_type?: string
          license_id?: string | null
          resolved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "license_monitoring_logs_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          created_at: string
          disabled_at: string | null
          expires_at: string | null
          expires_at_before_suspend: string | null
          id: string
          is_legacy: boolean
          is_trial: boolean
          legacy_server_fee_brl: number | null
          metadata: Json | null
          order_id: string | null
          origin_type: string | null
          paid_externally: boolean
          paid_externally_last_check_at: string | null
          paid_externally_last_check_status: string | null
          paid_externally_marked_at: string | null
          paid_externally_until: string | null
          panel: string
          password_fingerprint: string | null
          password_sync_by: string | null
          password_sync_error: string | null
          password_sync_status: string | null
          password_synced_at: string | null
          plan_slug: string
          revoked: boolean
          server_ip: string
          server_overdue_at: string | null
          server_paid_until: string | null
          status: Database["public"]["Enums"]["license_status"] | null
          suspend_password_fingerprint: string | null
          suspended_at: string | null
          suspended_by: string | null
          trial_duration_hours: number | null
          updated_at: string
          upgraded_from_license_id: string | null
          user_id: string
          version_tier: string | null
          yaarsa_email: string
          yaarsa_password_enc: string
          yaarsa_username: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          expires_at?: string | null
          expires_at_before_suspend?: string | null
          id?: string
          is_legacy?: boolean
          is_trial?: boolean
          legacy_server_fee_brl?: number | null
          metadata?: Json | null
          order_id?: string | null
          origin_type?: string | null
          paid_externally?: boolean
          paid_externally_last_check_at?: string | null
          paid_externally_last_check_status?: string | null
          paid_externally_marked_at?: string | null
          paid_externally_until?: string | null
          panel?: string
          password_fingerprint?: string | null
          password_sync_by?: string | null
          password_sync_error?: string | null
          password_sync_status?: string | null
          password_synced_at?: string | null
          plan_slug: string
          revoked?: boolean
          server_ip?: string
          server_overdue_at?: string | null
          server_paid_until?: string | null
          status?: Database["public"]["Enums"]["license_status"] | null
          suspend_password_fingerprint?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          trial_duration_hours?: number | null
          updated_at?: string
          upgraded_from_license_id?: string | null
          user_id: string
          version_tier?: string | null
          yaarsa_email: string
          yaarsa_password_enc: string
          yaarsa_username: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          expires_at?: string | null
          expires_at_before_suspend?: string | null
          id?: string
          is_legacy?: boolean
          is_trial?: boolean
          legacy_server_fee_brl?: number | null
          metadata?: Json | null
          order_id?: string | null
          origin_type?: string | null
          paid_externally?: boolean
          paid_externally_last_check_at?: string | null
          paid_externally_last_check_status?: string | null
          paid_externally_marked_at?: string | null
          paid_externally_until?: string | null
          panel?: string
          password_fingerprint?: string | null
          password_sync_by?: string | null
          password_sync_error?: string | null
          password_sync_status?: string | null
          password_synced_at?: string | null
          plan_slug?: string
          revoked?: boolean
          server_ip?: string
          server_overdue_at?: string | null
          server_paid_until?: string | null
          status?: Database["public"]["Enums"]["license_status"] | null
          suspend_password_fingerprint?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          trial_duration_hours?: number | null
          updated_at?: string
          upgraded_from_license_id?: string | null
          user_id?: string
          version_tier?: string | null
          yaarsa_email?: string
          yaarsa_password_enc?: string
          yaarsa_username?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "public_recent_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_upgraded_from_license_id_fkey"
            columns: ["upgraded_from_license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_history: {
        Row: {
          action_type: string
          amount: number | null
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      loyalty_missions: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty: string | null
          id: string
          limit_count: number | null
          requirements: Json | null
          reward_points: number
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          limit_count?: number | null
          requirements?: Json | null
          reward_points?: number
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          limit_count?: number | null
          requirements?: Json | null
          reward_points?: number
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      loyalty_tier_config: {
        Row: {
          badge_url: string | null
          benefits: Json | null
          created_at: string | null
          id: string
          min_days_active: number
          min_points: number
          name: string
          priority: number
          tier: Database["public"]["Enums"]["loyalty_tier"]
        }
        Insert: {
          badge_url?: string | null
          benefits?: Json | null
          created_at?: string | null
          id?: string
          min_days_active?: number
          min_points?: number
          name: string
          priority?: number
          tier: Database["public"]["Enums"]["loyalty_tier"]
        }
        Update: {
          badge_url?: string | null
          benefits?: Json | null
          created_at?: string | null
          id?: string
          min_days_active?: number
          min_points?: number
          name?: string
          priority?: number
          tier?: Database["public"]["Enums"]["loyalty_tier"]
        }
        Relationships: []
      }
      migration_requests: {
        Row: {
          admin_notes: string | null
          clients_count: number
          created_at: string
          current_panel: string
          id: string
          notes: string | null
          old_expires_on: string | null
          old_username: string
          panel_version: string | null
          proof_paths: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          clients_count?: number
          created_at?: string
          current_panel: string
          id?: string
          notes?: string | null
          old_expires_on?: string | null
          old_username: string
          panel_version?: string | null
          proof_paths?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          clients_count?: number
          created_at?: string
          current_panel?: string
          id?: string
          notes?: string | null
          old_expires_on?: string | null
          old_username?: string
          panel_version?: string | null
          proof_paths?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      migration_wave_claims: {
        Row: {
          created_at: string
          id: string
          new_license_id: string | null
          old_license_id: string
          old_revoked_at: string | null
          status: string
          user_id: string
          wave_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_license_id?: string | null
          old_license_id: string
          old_revoked_at?: string | null
          status?: string
          user_id: string
          wave_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_license_id?: string | null
          old_license_id?: string
          old_revoked_at?: string | null
          status?: string
          user_id?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_wave_claims_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "migration_waves"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_wave_votes: {
        Row: {
          approve: boolean
          comment: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
          wave_id: string
        }
        Insert: {
          approve: boolean
          comment?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          wave_id: string
        }
        Update: {
          approve?: boolean
          comment?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_wave_votes_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "migration_waves"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_waves: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          deadline_at: string
          has_deadline: boolean
          id: string
          instructions: string
          is_active: boolean
          is_test: boolean
          opened_at: string
          panel: string
          server_label: string | null
          test_admin_key_enc: string | null
          test_base_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline_at: string
          has_deadline?: boolean
          id?: string
          instructions?: string
          is_active?: boolean
          is_test?: boolean
          opened_at?: string
          panel: string
          server_label?: string | null
          test_admin_key_enc?: string | null
          test_base_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline_at?: string
          has_deadline?: boolean
          id?: string
          instructions?: string
          is_active?: boolean
          is_test?: boolean
          opened_at?: string
          panel?: string
          server_label?: string | null
          test_admin_key_enc?: string | null
          test_base_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      operation_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          holder: string | null
          key: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          holder?: string | null
          key: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          holder?: string | null
          key?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          cashback_credited: number | null
          cashback_used: number | null
          coupon_code: string | null
          created_at: string
          fulfillment_attempts: number
          id: string
          last_fulfillment_error: string | null
          metadata: Json | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          next_retry_at: string | null
          paid_at: string | null
          plan_slug: string
          processing_at: string | null
          referrer_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          cashback_credited?: number | null
          cashback_used?: number | null
          coupon_code?: string | null
          created_at?: string
          fulfillment_attempts?: number
          id?: string
          last_fulfillment_error?: string | null
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          next_retry_at?: string | null
          paid_at?: string | null
          plan_slug: string
          processing_at?: string | null
          referrer_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          cashback_credited?: number | null
          cashback_used?: number | null
          coupon_code?: string | null
          created_at?: string
          fulfillment_attempts?: number
          id?: string
          last_fulfillment_error?: string | null
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          next_retry_at?: string | null
          paid_at?: string | null
          plan_slug?: string
          processing_at?: string | null
          referrer_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
        ]
      }
      panel_servers: {
        Row: {
          admin_key_enc: string
          base_url: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          last_test_at: string | null
          last_test_message: string | null
          last_test_ok: boolean | null
          notes: string | null
          panel: string
          updated_at: string
          updated_by: string | null
          updated_by_email: string | null
        }
        Insert: {
          admin_key_enc: string
          base_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          notes?: string | null
          panel: string
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
        }
        Update: {
          admin_key_enc?: string
          base_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          notes?: string | null
          panel?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_email?: string | null
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          confirmed_at: string | null
          created_at: string
          id: string
          method: string
          pix_key: string | null
          processed_at: string | null
          processed_by: string | null
          receipt_reference: string | null
          status: string
          updated_at: string
          user_id: string
          user_notes: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          method: string
          pix_key?: string | null
          processed_at?: string | null
          processed_by?: string | null
          receipt_reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_notes?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          method?: string
          pix_key?: string | null
          processed_at?: string | null
          processed_by?: string | null
          receipt_reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_notes?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          category: string
          created_at: string
          days: number | null
          description: string | null
          image_url: string | null
          name: string
          price_brl: number
          slug: string
          sort_order: number | null
          status: Database["public"]["Enums"]["plan_status"] | null
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          days?: number | null
          description?: string | null
          image_url?: string | null
          name: string
          price_brl: number
          slug: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["plan_status"] | null
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          days?: number | null
          description?: string | null
          image_url?: string | null
          name?: string
          price_brl?: number
          slug?: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["plan_status"] | null
        }
        Relationships: []
      }
      play_protect_grants: {
        Row: {
          created_at: string
          expires_at: string
          granted_at: string
          id: string
          license_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          granted_at?: string
          id?: string
          license_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_at?: string
          id?: string
          license_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_protect_grants_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: true
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      points_history: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          metadata: Json | null
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          conversions_count: number | null
          created_at: string
          current_level:
            | Database["public"]["Enums"]["shadow_reward_level"]
            | null
          display_name: string | null
          email: string
          email_canonical: string | null
          full_name: string | null
          id: string
          legacy_checked_at: string | null
          legacy_panel_hits: Json | null
          legacy_status: string
          metadata: Json | null
          onboarding_answers: Json
          onboarding_completed_at: string | null
          pix_key: string | null
          recovery_codes_generated_at: string | null
          referral_code: string | null
          referral_reward_pref: string
          referrals_valid_count: number | null
          referred_by: string | null
          reputation_score: number | null
          reward_points: number | null
          security_ack_at: string | null
          signup_device_hash: string | null
          total_points_earned: number | null
          trial_7d_expires_at: string | null
          trial_7d_started_at: string | null
          trial_expires_at: string | null
          trial_started_at: string | null
          trust_score: number | null
          updated_at: string
          vip_tier: Database["public"]["Enums"]["vip_tier"] | null
        }
        Insert: {
          avatar_url?: string | null
          conversions_count?: number | null
          created_at?: string
          current_level?:
            | Database["public"]["Enums"]["shadow_reward_level"]
            | null
          display_name?: string | null
          email: string
          email_canonical?: string | null
          full_name?: string | null
          id: string
          legacy_checked_at?: string | null
          legacy_panel_hits?: Json | null
          legacy_status?: string
          metadata?: Json | null
          onboarding_answers?: Json
          onboarding_completed_at?: string | null
          pix_key?: string | null
          recovery_codes_generated_at?: string | null
          referral_code?: string | null
          referral_reward_pref?: string
          referrals_valid_count?: number | null
          referred_by?: string | null
          reputation_score?: number | null
          reward_points?: number | null
          security_ack_at?: string | null
          signup_device_hash?: string | null
          total_points_earned?: number | null
          trial_7d_expires_at?: string | null
          trial_7d_started_at?: string | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          trust_score?: number | null
          updated_at?: string
          vip_tier?: Database["public"]["Enums"]["vip_tier"] | null
        }
        Update: {
          avatar_url?: string | null
          conversions_count?: number | null
          created_at?: string
          current_level?:
            | Database["public"]["Enums"]["shadow_reward_level"]
            | null
          display_name?: string | null
          email?: string
          email_canonical?: string | null
          full_name?: string | null
          id?: string
          legacy_checked_at?: string | null
          legacy_panel_hits?: Json | null
          legacy_status?: string
          metadata?: Json | null
          onboarding_answers?: Json
          onboarding_completed_at?: string | null
          pix_key?: string | null
          recovery_codes_generated_at?: string | null
          referral_code?: string | null
          referral_reward_pref?: string
          referrals_valid_count?: number | null
          referred_by?: string | null
          reputation_score?: number | null
          reward_points?: number | null
          security_ack_at?: string | null
          signup_device_hash?: string | null
          total_points_earned?: number | null
          trial_7d_expires_at?: string | null
          trial_7d_started_at?: string | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          trust_score?: number | null
          updated_at?: string
          vip_tier?: Database["public"]["Enums"]["vip_tier"] | null
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          created_at: string
          discount_applied: number
          id: string
          order_id: string | null
          promo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_applied: number
          id?: string
          order_id?: string | null
          promo_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          discount_applied?: number
          id?: string
          order_id?: string | null
          promo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "public_recent_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_redemptions_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          active: boolean
          banner_url: string | null
          code: string | null
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["promo_discount_type"]
          discount_value: number
          eligible_plans: string[] | null
          end_at: string | null
          goal_current_value: number | null
          goal_reached_at: string | null
          goal_target_value: number | null
          id: string
          limit_per_user: number | null
          max_uses: number | null
          metadata: Json | null
          name: string
          priority: number | null
          promo_type: Database["public"]["Enums"]["promo_type"]
          start_at: string
          updated_at: string
          uses_count: number | null
        }
        Insert: {
          active?: boolean
          banner_url?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["promo_discount_type"]
          discount_value: number
          eligible_plans?: string[] | null
          end_at?: string | null
          goal_current_value?: number | null
          goal_reached_at?: string | null
          goal_target_value?: number | null
          id?: string
          limit_per_user?: number | null
          max_uses?: number | null
          metadata?: Json | null
          name: string
          priority?: number | null
          promo_type?: Database["public"]["Enums"]["promo_type"]
          start_at?: string
          updated_at?: string
          uses_count?: number | null
        }
        Update: {
          active?: boolean
          banner_url?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["promo_discount_type"]
          discount_value?: number
          eligible_plans?: string[] | null
          end_at?: string | null
          goal_current_value?: number | null
          goal_reached_at?: string | null
          goal_target_value?: number | null
          id?: string
          limit_per_user?: number | null
          max_uses?: number | null
          metadata?: Json | null
          name?: string
          priority?: number | null
          promo_type?: Database["public"]["Enums"]["promo_type"]
          start_at?: string
          updated_at?: string
          uses_count?: number | null
        }
        Relationships: []
      }
      recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      redeem_code_uses: {
        Row: {
          code: string
          code_id: string
          created_at: string
          details: Json
          id: string
          license_id: string | null
          user_id: string
        }
        Insert: {
          code: string
          code_id: string
          created_at?: string
          details?: Json
          id?: string
          license_id?: string | null
          user_id: string
        }
        Update: {
          code?: string
          code_id?: string
          created_at?: string
          details?: Json
          id?: string
          license_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redeem_code_uses_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "redeem_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      redeem_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          days: number | null
          expires_at: string | null
          id: string
          kind: string
          max_uses: number
          note: string | null
          plan_slug: string | null
          target_user_id: string | null
          updated_at: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          days?: number | null
          expires_at?: string | null
          id?: string
          kind: string
          max_uses?: number
          note?: string | null
          plan_slug?: string | null
          target_user_id?: string | null
          updated_at?: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          days?: number | null
          expires_at?: string | null
          id?: string
          kind?: string
          max_uses?: number
          note?: string | null
          plan_slug?: string | null
          target_user_id?: string | null
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          referral_id: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          referral_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          referral_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_levels: {
        Row: {
          benefits: Json | null
          created_at: string | null
          id: string
          min_conversions: number
          name: string
        }
        Insert: {
          benefits?: Json | null
          created_at?: string | null
          id?: string
          min_conversions: number
          name: string
        }
        Update: {
          benefits?: Json | null
          created_at?: string | null
          id?: string
          min_conversions?: number
          name?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string | null
          paid_at: string | null
          pix_key: string | null
          referred_id: string
          referrer_id: string
          reward_amount: number
          reward_status: string
          reward_type: string
          status: Database["public"]["Enums"]["referral_status_new"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          pix_key?: string | null
          referred_id: string
          referrer_id: string
          reward_amount?: number
          reward_status?: string
          reward_type: string
          status?: Database["public"]["Enums"]["referral_status_new"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          pix_key?: string | null
          referred_id?: string
          referrer_id?: string
          reward_amount?: number
          reward_status?: string
          reward_type?: string
          status?: Database["public"]["Enums"]["referral_status_new"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "public_recent_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          ai_confidence: number | null
          ai_verdict: string | null
          created_at: string
          from_status: string | null
          id: string
          notes: string | null
          refund_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          ai_confidence?: number | null
          ai_verdict?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          refund_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          ai_confidence?: number | null
          ai_verdict?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          refund_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refund_audit_log_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          deadline_at: string
          id: string
          license_id: string | null
          order_id: string | null
          pix_key: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          deadline_at?: string
          id?: string
          license_id?: string | null
          order_id?: string | null
          pix_key?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          deadline_at?: string
          id?: string
          license_id?: string | null
          order_id?: string | null
          pix_key?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_config: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          requirement_type: string
          requirement_value: number
          reward_type: Database["public"]["Enums"]["referral_reward_type"]
          reward_value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          requirement_type: string
          requirement_value: number
          reward_type: Database["public"]["Enums"]["referral_reward_type"]
          reward_value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          requirement_type?: string
          requirement_value?: number
          reward_type?: Database["public"]["Enums"]["referral_reward_type"]
          reward_value?: Json
        }
        Relationships: []
      }
      reward_level_config: {
        Row: {
          badge_url: string | null
          benefits: string[] | null
          created_at: string | null
          id: string
          level: Database["public"]["Enums"]["shadow_reward_level"]
          min_conversions: number
          min_referrals: number
          name: string
          updated_at: string | null
        }
        Insert: {
          badge_url?: string | null
          benefits?: string[] | null
          created_at?: string | null
          id?: string
          level: Database["public"]["Enums"]["shadow_reward_level"]
          min_conversions?: number
          min_referrals?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          badge_url?: string | null
          benefits?: string[] | null
          created_at?: string | null
          id?: string
          level?: Database["public"]["Enums"]["shadow_reward_level"]
          min_conversions?: number
          min_referrals?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reward_missions: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          priority: number | null
          requirement_type: string
          requirement_value: number
          reward_type: string
          reward_value: Json
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          priority?: number | null
          requirement_type: string
          requirement_value: number
          reward_type: string
          reward_value: Json
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          priority?: number | null
          requirement_type?: string
          requirement_value?: number
          reward_type?: string
          reward_value?: Json
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "staff_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_attempts: {
        Row: {
          created_at: string
          email_masked: string | null
          id: string
          ip_hash: string
          outcome: string
        }
        Insert: {
          created_at?: string
          email_masked?: string | null
          id?: string
          ip_hash: string
          outcome?: string
        }
        Update: {
          created_at?: string
          email_masked?: string | null
          id?: string
          ip_hash?: string
          outcome?: string
        }
        Relationships: []
      }
      signup_ip_log: {
        Row: {
          accounts_in_window: number
          created_at: string
          email_masked: string | null
          id: string
          ip_hash: string
          suspicious: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accounts_in_window?: number
          created_at?: string
          email_masked?: string | null
          id?: string
          ip_hash: string
          suspicious?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accounts_in_window?: number
          created_at?: string
          email_masked?: string | null
          id?: string
          ip_hash?: string
          suspicious?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      staff_applications: {
        Row: {
          admin_notes: string | null
          area: string | null
          availability: string | null
          created_at: string | null
          discord_tag: string | null
          experience: string | null
          full_name: string
          id: string
          motivation: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          area?: string | null
          availability?: string | null
          created_at?: string | null
          discord_tag?: string | null
          experience?: string | null
          full_name: string
          id?: string
          motivation?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          area?: string | null
          availability?: string | null
          created_at?: string | null
          discord_tag?: string | null
          experience?: string | null
          full_name?: string
          id?: string
          motivation?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      staff_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          executor_id: string
          id: string
          target_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          executor_id: string
          id?: string
          target_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          executor_id?: string
          id?: string
          target_id?: string | null
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          id: string
          joined_at: string | null
          role_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          role_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_messages: {
        Row: {
          channel: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          sender_id: string | null
        }
        Insert: {
          channel?: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          sender_id?: string | null
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          sender_id?: string | null
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      staff_roles: {
        Row: {
          created_at: string | null
          description: string | null
          hierarchy_level: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hierarchy_level: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hierarchy_level?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      staff_training_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          training_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          training_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          training_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_training_progress_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "staff_trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_trainings: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          description: string
          display_order: number
          estimated_minutes: number
          id: string
          is_published: boolean
          level: string
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string
          display_order?: number
          estimated_minutes?: number
          id?: string
          is_published?: boolean
          level?: string
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string
          display_order?: number
          estimated_minutes?: number
          id?: string
          is_published?: boolean
          level?: string
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          body: string | null
          created_at: string
          id: string
          is_admin: boolean
          is_system: boolean
          reply_to_id: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_admin?: boolean
          is_system?: boolean
          reply_to_id?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_admin?: boolean
          is_system?: boolean
          reply_to_id?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_sender_id_profiles_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          assigned_at: string | null
          assigned_name: string | null
          assigned_to: string | null
          category: string
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          created_at: string
          id: string
          last_customer_message_at: string | null
          last_staff_message_at: string | null
          priority: string
          status: string
          subject: string
          unread_by_customer: number
          unread_by_staff: number
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_name?: string | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          created_at?: string
          id?: string
          last_customer_message_at?: string | null
          last_staff_message_at?: string | null
          priority?: string
          status?: string
          subject?: string
          unread_by_customer?: number
          unread_by_staff?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_name?: string | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          created_at?: string
          id?: string
          last_customer_message_at?: string | null
          last_staff_message_at?: string | null
          priority?: string
          status?: string
          subject?: string
          unread_by_customer?: number
          unread_by_staff?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trial_blocks: {
        Row: {
          created_at: string
          email_masked: string | null
          id: string
          ip_hash: string | null
          reason: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_masked?: string | null
          id?: string
          ip_hash?: string | null
          reason: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_masked?: string | null
          id?: string
          ip_hash?: string | null
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trials: {
        Row: {
          attrs_hash: string | null
          device_hash: string | null
          ip_hash: string | null
          ip_prefix_hash: string | null
          license_id: string | null
          used_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          attrs_hash?: string | null
          device_hash?: string | null
          ip_hash?: string | null
          ip_prefix_hash?: string | null
          license_id?: string | null
          used_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          attrs_hash?: string | null
          device_hash?: string | null
          ip_hash?: string | null
          ip_prefix_hash?: string | null
          license_id?: string | null
          used_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trials_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_progress: {
        Row: {
          completed: boolean | null
          id: string
          last_watched_at: string | null
          metadata: Json | null
          tutorial_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          id?: string
          last_watched_at?: string | null
          metadata?: Json | null
          tutorial_id: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          id?: string
          last_watched_at?: string | null
          metadata?: Json | null
          tutorial_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_progress_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorials: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          title: string
          video_url: string | null
          youtube_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          title: string
          video_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          title?: string
          video_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      updates: {
        Row: {
          created_at: string
          created_by: string | null
          filename: string
          id: string
          is_active: boolean
          min_tier: string
          notes: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filename: string
          id?: string
          is_active?: boolean
          min_tier?: string
          notes?: string | null
          size_bytes?: number | null
          storage_path: string
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filename?: string
          id?: string
          is_active?: boolean
          min_tier?: string
          notes?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      user_loyalty: {
        Row: {
          created_at: string | null
          current_tier: Database["public"]["Enums"]["loyalty_tier"]
          days_active: number
          last_action_at: string | null
          metadata: Json | null
          points: number
          total_spent: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_tier?: Database["public"]["Enums"]["loyalty_tier"]
          days_active?: number
          last_action_at?: string | null
          metadata?: Json | null
          points?: number
          total_spent?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_tier?: Database["public"]["Enums"]["loyalty_tier"]
          days_active?: number
          last_action_at?: string | null
          metadata?: Json | null
          points?: number
          total_spent?: number
          user_id?: string
        }
        Relationships: []
      }
      user_mission_progress: {
        Row: {
          completed_at: string | null
          current_value: number | null
          id: string
          mission_id: string
          reward_granted: boolean | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_value?: number | null
          id?: string
          mission_id: string
          reward_granted?: boolean | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_value?: number | null
          id?: string
          mission_id?: string
          reward_granted?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "reward_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_missions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          mission_id: string
          progress: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          mission_id: string
          progress?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          mission_id?: string
          progress?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "loyalty_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rewards: {
        Row: {
          claimed_at: string | null
          config_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          status: Database["public"]["Enums"]["referral_reward_status"]
          type: Database["public"]["Enums"]["referral_reward_type"]
          user_id: string
          value: Json
        }
        Insert: {
          claimed_at?: string | null
          config_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status?: Database["public"]["Enums"]["referral_reward_status"]
          type: Database["public"]["Enums"]["referral_reward_type"]
          user_id: string
          value: Json
        }
        Update: {
          claimed_at?: string | null
          config_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status?: Database["public"]["Enums"]["referral_reward_status"]
          type?: Database["public"]["Enums"]["referral_reward_type"]
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "reward_config"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vip_configs: {
        Row: {
          benefits: Json | null
          min_conversions: number | null
          min_loyalty_points: number
          min_months_active: number | null
          min_reputation: number | null
          tier: Database["public"]["Enums"]["vip_tier"]
          weight_loyalty: number | null
          weight_referral: number | null
          weight_reputation: number | null
        }
        Insert: {
          benefits?: Json | null
          min_conversions?: number | null
          min_loyalty_points: number
          min_months_active?: number | null
          min_reputation?: number | null
          tier: Database["public"]["Enums"]["vip_tier"]
          weight_loyalty?: number | null
          weight_referral?: number | null
          weight_reputation?: number | null
        }
        Update: {
          benefits?: Json | null
          min_conversions?: number | null
          min_loyalty_points?: number
          min_months_active?: number | null
          min_reputation?: number | null
          tier?: Database["public"]["Enums"]["vip_tier"]
          weight_loyalty?: number | null
          weight_referral?: number | null
          weight_reputation?: number | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          id: string
          note: string | null
          payload: Json | null
          processed: boolean
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          payload?: Json | null
          processed?: boolean
          source: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          payload?: Json | null
          processed?: boolean
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_recent_sales: {
        Row: {
          amount: number | null
          created_at: string | null
          first_name: string | null
          id: string | null
          last_initial: string | null
          plan_slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
        ]
      }
    }
    Functions: {
      calculate_license_status: { Args: { lic_id: string }; Returns: string }
      check_license_consistency: { Args: never; Returns: undefined }
      check_license_quota: { Args: { _staff_id: string }; Returns: boolean }
      check_rls_enabled: { Args: { target_table: string }; Returns: boolean }
      complete_loyalty_mission: { Args: { _mission_id: string }; Returns: Json }
      expire_stale_apk_jobs: { Args: never; Returns: number }
      force_refresh_schema_permissions: { Args: never; Returns: undefined }
      gen_referral_code: { Args: never; Returns: string }
      generate_my_recovery_codes: {
        Args: never
        Returns: {
          code: string
        }[]
      }
      has_active_play_protect: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_play_protect_eligible_slug: {
        Args: { _slug: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      notify_pgrst_reload: { Args: never; Returns: undefined }
      reactivate_server_licenses_for_user: {
        Args: { _paid_until: string; _user_id: string }
        Returns: {
          created_at: string
          disabled_at: string | null
          expires_at: string | null
          expires_at_before_suspend: string | null
          id: string
          is_legacy: boolean
          is_trial: boolean
          legacy_server_fee_brl: number | null
          metadata: Json | null
          order_id: string | null
          origin_type: string | null
          paid_externally: boolean
          paid_externally_last_check_at: string | null
          paid_externally_last_check_status: string | null
          paid_externally_marked_at: string | null
          paid_externally_until: string | null
          panel: string
          password_fingerprint: string | null
          password_sync_by: string | null
          password_sync_error: string | null
          password_sync_status: string | null
          password_synced_at: string | null
          plan_slug: string
          revoked: boolean
          server_ip: string
          server_overdue_at: string | null
          server_paid_until: string | null
          status: Database["public"]["Enums"]["license_status"] | null
          suspend_password_fingerprint: string | null
          suspended_at: string | null
          suspended_by: string | null
          trial_duration_hours: number | null
          updated_at: string
          upgraded_from_license_id: string | null
          user_id: string
          version_tier: string | null
          yaarsa_email: string
          yaarsa_password_enc: string
          yaarsa_username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "licenses"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      recalc_vip_tier: { Args: { _user_id: string }; Returns: string }
      release_op_lock: { Args: { _key: string }; Returns: undefined }
      release_redeem_code_claim: {
        Args: { _claim_id: string; _user_id: string }
        Returns: boolean
      }
      reserve_redeem_code: {
        Args: { _code: string; _user_id: string }
        Returns: {
          claim_id: string
          code_id: string
          days: number
          kind: string
          note: string
          plan_slug: string
        }[]
      }
      revoke_unpaid_server_licenses: {
        Args: never
        Returns: {
          id: string
          panel: string
          user_id: string
          yaarsa_email: string
        }[]
      }
      run_community_giveaway: { Args: { _milestone?: number }; Returns: Json }
      try_acquire_op_lock: {
        Args: { _holder?: string; _key: string; _ttl_seconds?: number }
        Returns: boolean
      }
    }
    Enums: {
      apk_build_status: "pending" | "processing" | "completed" | "failed"
      apk_job_status:
        | "queued"
        | "claimed"
        | "sending"
        | "processing"
        | "done"
        | "failed"
        | "expired"
        | "cancelled"
      app_role: "admin" | "user" | "moderator" | "support"
      license_status:
        | "trial"
        | "active"
        | "expiring_soon"
        | "expired"
        | "cancelled"
        | "revoked"
        | "suspended"
      loyalty_status: "pending" | "available" | "used" | "expired" | "revoked"
      loyalty_tier:
        | "starter"
        | "member"
        | "bronze"
        | "silver"
        | "gold"
        | "vip"
        | "elite"
      plan_status: "published" | "draft" | "hidden" | "sold_out"
      promo_discount_type: "percentage" | "fixed_amount"
      promo_type: "automatic" | "coupon" | "community_goal"
      referral_reward_status:
        | "pending"
        | "confirmed"
        | "released"
        | "cancelled"
        | "revogated"
      referral_reward_type: "points" | "cashback" | "coupon" | "level_up"
      referral_status_new:
        | "clicked"
        | "registered"
        | "verified"
        | "trial_active"
        | "converted"
        | "rewarded"
        | "cancelled"
        | "flagged"
      shadow_reward_level:
        | "novato"
        | "bronze"
        | "prata"
        | "ouro"
        | "elite"
        | "legend"
      vip_tier:
        | "none"
        | "vip"
        | "gold"
        | "elite"
        | "bronze"
        | "silver"
        | "diamond"
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
      apk_build_status: ["pending", "processing", "completed", "failed"],
      apk_job_status: [
        "queued",
        "claimed",
        "sending",
        "processing",
        "done",
        "failed",
        "expired",
        "cancelled",
      ],
      app_role: ["admin", "user", "moderator", "support"],
      license_status: [
        "trial",
        "active",
        "expiring_soon",
        "expired",
        "cancelled",
        "revoked",
        "suspended",
      ],
      loyalty_status: ["pending", "available", "used", "expired", "revoked"],
      loyalty_tier: [
        "starter",
        "member",
        "bronze",
        "silver",
        "gold",
        "vip",
        "elite",
      ],
      plan_status: ["published", "draft", "hidden", "sold_out"],
      promo_discount_type: ["percentage", "fixed_amount"],
      promo_type: ["automatic", "coupon", "community_goal"],
      referral_reward_status: [
        "pending",
        "confirmed",
        "released",
        "cancelled",
        "revogated",
      ],
      referral_reward_type: ["points", "cashback", "coupon", "level_up"],
      referral_status_new: [
        "clicked",
        "registered",
        "verified",
        "trial_active",
        "converted",
        "rewarded",
        "cancelled",
        "flagged",
      ],
      shadow_reward_level: [
        "novato",
        "bronze",
        "prata",
        "ouro",
        "elite",
        "legend",
      ],
      vip_tier: ["none", "vip", "gold", "elite", "bronze", "silver", "diamond"],
    },
  },
} as const
