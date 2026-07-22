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
      apk_jobs: {
        Row: {
          claimed_at: string | null
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
      coupons: {
        Row: {
          active: boolean
          cashback_pct: number
          code: string
          created_at: string
          discount_pct: number
          first_deposit_only: boolean
          uses_left: number | null
        }
        Insert: {
          active?: boolean
          cashback_pct?: number
          code: string
          created_at?: string
          discount_pct?: number
          first_deposit_only?: boolean
          uses_left?: number | null
        }
        Update: {
          active?: boolean
          cashback_pct?: number
          code?: string
          created_at?: string
          discount_pct?: number
          first_deposit_only?: boolean
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
        }
        Relationships: []
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
          order_id: string | null
          paid_externally: boolean
          paid_externally_last_check_at: string | null
          paid_externally_last_check_status: string | null
          paid_externally_marked_at: string | null
          paid_externally_until: string | null
          panel: string
          plan_slug: string
          revoked: boolean
          server_ip: string
          server_overdue_at: string | null
          server_paid_until: string | null
          suspended_at: string | null
          suspended_by: string | null
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
          order_id?: string | null
          paid_externally?: boolean
          paid_externally_last_check_at?: string | null
          paid_externally_last_check_status?: string | null
          paid_externally_marked_at?: string | null
          paid_externally_until?: string | null
          panel?: string
          plan_slug: string
          revoked?: boolean
          server_ip?: string
          server_overdue_at?: string | null
          server_paid_until?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
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
          order_id?: string | null
          paid_externally?: boolean
          paid_externally_last_check_at?: string | null
          paid_externally_last_check_status?: string | null
          paid_externally_marked_at?: string | null
          paid_externally_until?: string | null
          panel?: string
          plan_slug?: string
          revoked?: boolean
          server_ip?: string
          server_overdue_at?: string | null
          server_paid_until?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
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
      orders: {
        Row: {
          amount: number
          cashback_credited: number | null
          cashback_used: number | null
          coupon_code: string | null
          created_at: string
          id: string
          metadata: Json | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          paid_at: string | null
          plan_slug: string
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
          id?: string
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          plan_slug: string
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
          id?: string
          metadata?: Json | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          plan_slug?: string
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
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          legacy_checked_at: string | null
          legacy_panel_hits: Json | null
          legacy_status: string
          pix_key: string | null
          referral_code: string | null
          referral_reward_pref: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          legacy_checked_at?: string | null
          legacy_panel_hits?: Json | null
          legacy_status?: string
          pix_key?: string | null
          referral_code?: string | null
          referral_reward_pref?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          legacy_checked_at?: string | null
          legacy_panel_hits?: Json | null
          legacy_status?: string
          pix_key?: string | null
          referral_code?: string | null
          referral_reward_pref?: string
          updated_at?: string
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
      support_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          body: string | null
          created_at: string
          id: string
          is_admin: boolean
          is_system: boolean
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
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
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
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          created_at: string
          id: string
          last_customer_message_at: string | null
          last_staff_message_at: string | null
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
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          created_at?: string
          id?: string
          last_customer_message_at?: string | null
          last_staff_message_at?: string | null
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
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          created_at?: string
          id?: string
          last_customer_message_at?: string | null
          last_staff_message_at?: string | null
          status?: string
          subject?: string
          unread_by_customer?: number
          unread_by_staff?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trials: {
        Row: {
          license_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          license_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          license_id?: string | null
          used_at?: string
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
      expire_stale_apk_jobs: { Args: never; Returns: number }
      gen_referral_code: { Args: never; Returns: string }
      has_active_play_protect: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
          order_id: string | null
          paid_externally: boolean
          paid_externally_last_check_at: string | null
          paid_externally_last_check_status: string | null
          paid_externally_marked_at: string | null
          paid_externally_until: string | null
          panel: string
          plan_slug: string
          revoked: boolean
          server_ip: string
          server_overdue_at: string | null
          server_paid_until: string | null
          suspended_at: string | null
          suspended_by: string | null
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
      revoke_unpaid_server_licenses: {
        Args: never
        Returns: {
          id: string
          panel: string
          user_id: string
          yaarsa_email: string
        }[]
      }
    }
    Enums: {
      apk_job_status:
        | "queued"
        | "claimed"
        | "sending"
        | "processing"
        | "done"
        | "failed"
        | "expired"
        | "cancelled"
      app_role: "admin" | "user" | "moderator"
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
      app_role: ["admin", "user", "moderator"],
    },
  },
} as const
