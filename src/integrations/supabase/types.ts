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
          plan_slug: string
          revoked: boolean
          server_ip: string
          server_overdue_at: string | null
          server_paid_until: string | null
          suspended_at: string | null
          suspended_by: string | null
          updated_at: string
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
          plan_slug: string
          revoked?: boolean
          server_ip?: string
          server_overdue_at?: string | null
          server_paid_until?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          updated_at?: string
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
          plan_slug?: string
          revoked?: boolean
          server_ip?: string
          server_overdue_at?: string | null
          server_paid_until?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          updated_at?: string
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
          mp_payment_id: string | null
          mp_preference_id: string | null
          paid_at: string | null
          plan_slug: string
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
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          plan_slug: string
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
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          plan_slug?: string
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
      plans: {
        Row: {
          active: boolean
          category: string
          created_at: string
          days: number | null
          description: string | null
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
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
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
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      revoke_unpaid_server_licenses: {
        Args: never
        Returns: {
          id: string
          user_id: string
          yaarsa_email: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
