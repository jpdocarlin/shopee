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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_generations: {
        Row: {
          created_at: string
          id: string
          kind: string
          model: string | null
          output: string | null
          product_id: string | null
          prompt: string
          tokens_used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          model?: string | null
          output?: string | null
          product_id?: string | null
          prompt: string
          tokens_used?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          model?: string | null
          output?: string | null
          product_id?: string | null
          prompt?: string
          tokens_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_daily: {
        Row: {
          clicks: number
          commission_cents: number
          conversion_rate: number
          created_at: string
          day: string
          id: string
          marketplace_id: string | null
          orders: number
          revenue_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          clicks?: number
          commission_cents?: number
          conversion_rate?: number
          created_at?: string
          day: string
          id?: string
          marketplace_id?: string | null
          orders?: number
          revenue_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          clicks?: number
          commission_cents?: number
          conversion_rate?: number
          created_at?: string
          day?: string
          id?: string
          marketplace_id?: string | null
          orders?: number
          revenue_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clicks: {
        Row: {
          campaign: string | null
          country: string | null
          created_at: string
          device: string | null
          id: string
          marketplace_id: string | null
          product_id: string | null
          referrer: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          campaign?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          marketplace_id?: string | null
          product_id?: string | null
          referrer?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          campaign?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          marketplace_id?: string | null
          product_id?: string | null
          referrer?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clicks_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          position: number
          product_id: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          position?: number
          product_id: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          name: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          category: string | null
          created_at: string
          id: string
          marketplace_id: string
          max_value_cents: number | null
          min_value_cents: number | null
          notes: string | null
          rate: number
          updated_at: string
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          marketplace_id: string
          max_value_cents?: number | null
          min_value_cents?: number | null
          notes?: string | null
          rate?: number
          updated_at?: string
          user_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          marketplace_id?: string
          max_value_cents?: number | null
          min_value_cents?: number | null
          notes?: string | null
          rate?: number
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          note: string | null
          product_id: string
          tags: string[]
          target_price_cents: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          product_id: string
          tags?: string[]
          target_price_cents?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string
          tags?: string[]
          target_price_cents?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_accounts: {
        Row: {
          affiliate_id: string | null
          created_at: string
          id: string
          label: string
          last_synced_at: string | null
          marketplace_id: string
          metadata: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_id?: string | null
          created_at?: string
          id?: string
          label: string
          last_synced_at?: string | null
          marketplace_id: string
          metadata?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string | null
          created_at?: string
          id?: string
          label?: string
          last_synced_at?: string | null
          marketplace_id?: string
          metadata?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_accounts_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplaces: {
        Row: {
          base_url: string | null
          brand_color: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          base_url?: string | null
          brand_color?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          base_url?: string | null
          brand_color?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          approved_at: string | null
          buyer_state: string | null
          commission_cents: number
          commission_status: Database["public"]["Enums"]["commission_status"]
          created_at: string
          external_id: string
          id: string
          items_count: number
          marketplace_id: string
          ordered_at: string
          status: Database["public"]["Enums"]["order_status"]
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          buyer_state?: string | null
          commission_cents?: number
          commission_status?: Database["public"]["Enums"]["commission_status"]
          created_at?: string
          external_id: string
          id?: string
          items_count?: number
          marketplace_id: string
          ordered_at?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          buyer_state?: string | null
          commission_cents?: number
          commission_status?: Database["public"]["Enums"]["commission_status"]
          created_at?: string
          external_id?: string
          id?: string
          items_count?: number
          marketplace_id?: string
          ordered_at?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_keys: {
        Row: {
          created_at: string
          holder_name: string | null
          id: string
          is_default: boolean
          key_type: Database["public"]["Enums"]["pix_key_type"]
          key_value: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          holder_name?: string | null
          id?: string
          is_default?: boolean
          key_type: Database["public"]["Enums"]["pix_key_type"]
          key_value: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          holder_name?: string | null
          id?: string
          is_default?: boolean
          key_type?: Database["public"]["Enums"]["pix_key_type"]
          key_value?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          ai_limit: number
          created_at: string
          description: string | null
          features: Json
          id: string
          interval: string
          is_active: boolean
          name: string
          price_cents: number
          search_limit: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          ai_limit?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          name: string
          price_cents?: number
          search_limit?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          ai_limit?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          search_limit?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_history: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          captured_at: string
          commission_rate: number | null
          id: string
          price_cents: number
          product_id: string
          user_id: string
        }
        Insert: {
          captured_at?: string
          commission_rate?: number | null
          id?: string
          price_cents: number
          product_id: string
          user_id: string
        }
        Update: {
          captured_at?: string
          commission_rate?: number | null
          id?: string
          price_cents?: number
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_url: string | null
          category: string | null
          commission_cents: number
          commission_rate: number
          created_at: string
          external_id: string
          id: string
          image_url: string | null
          is_active: boolean
          marketplace_id: string
          opportunity_score: number
          original_price_cents: number | null
          price_cents: number
          product_url: string | null
          rating: number | null
          raw: Json
          reviews_count: number
          sales_count: number
          seller_name: string | null
          stock: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_url?: string | null
          category?: string | null
          commission_cents?: number
          commission_rate?: number
          created_at?: string
          external_id: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          marketplace_id: string
          opportunity_score?: number
          original_price_cents?: number | null
          price_cents?: number
          product_url?: string | null
          rating?: number | null
          raw?: Json
          reviews_count?: number
          sales_count?: number
          seller_name?: string | null
          stock?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_url?: string | null
          category?: string | null
          commission_cents?: number
          commission_rate?: number
          created_at?: string
          external_id?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          marketplace_id?: string
          opportunity_score?: number
          original_price_cents?: number | null
          price_cents?: number
          product_url?: string | null
          rating?: number | null
          raw?: Json
          reviews_count?: number
          sales_count?: number
          seller_name?: string | null
          stock?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_marketplace_id_fkey"
            columns: ["marketplace_id"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          document: string | null
          email: string | null
          full_name: string | null
          id: string
          onboarding_done: boolean
          phone: string | null
          plan: Database["public"]["Enums"]["billing_plan"] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_done?: boolean
          phone?: string | null
          plan?: Database["public"]["Enums"]["billing_plan"] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_done?: boolean
          phone?: string | null
          plan?: Database["public"]["Enums"]["billing_plan"] | null
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          click_id: string | null
          commission_cents: number
          commission_rate: number
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price_cents: number
          user_id: string
        }
        Insert: {
          click_id?: string | null
          commission_cents?: number
          commission_rate?: number
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price_cents?: number
          user_id: string
        }
        Update: {
          click_id?: string | null
          commission_cents?: number
          commission_rate?: number
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          currency: string
          email_notifications: boolean
          locale: string
          preferences: Json
          price_alerts: boolean
          timezone: string
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          created_at?: string
          currency?: string
          email_notifications?: boolean
          locale?: string
          preferences?: Json
          price_alerts?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          created_at?: string
          currency?: string
          email_notifications?: boolean
          locale?: string
          preferences?: Json
          price_alerts?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string
          external_id: string | null
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          external_id?: string | null
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          external_id?: string | null
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      withdraws: {
        Row: {
          amount_cents: number
          created_at: string
          fee_cents: number
          id: string
          pix_key_id: string | null
          processed_at: string | null
          receipt_url: string | null
          requested_at: string
          status: Database["public"]["Enums"]["withdraw_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          fee_cents?: number
          id?: string
          pix_key_id?: string | null
          processed_at?: string | null
          receipt_url?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["withdraw_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          fee_cents?: number
          id?: string
          pix_key_id?: string | null
          processed_at?: string | null
          receipt_url?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["withdraw_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdraws_pix_key_id_fkey"
            columns: ["pix_key_id"]
            isOneToOne: false
            referencedRelation: "pix_keys"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "admin" | "staff" | "affiliate"
      billing_plan: "mensal" | "vitalicio"
      commission_status: "pending" | "approved" | "paid" | "canceled"
      order_status:
        | "pending"
        | "approved"
        | "shipped"
        | "delivered"
        | "canceled"
        | "refunded"
      pix_key_type: "cpf" | "cnpj" | "email" | "phone" | "random"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
      withdraw_status: "requested" | "processing" | "paid" | "rejected"
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
      app_role: ["admin", "staff", "affiliate"],
      billing_plan: ["mensal", "vitalicio"],
      commission_status: ["pending", "approved", "paid", "canceled"],
      order_status: [
        "pending",
        "approved",
        "shipped",
        "delivered",
        "canceled",
        "refunded",
      ],
      pix_key_type: ["cpf", "cnpj", "email", "phone", "random"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
      withdraw_status: ["requested", "processing", "paid", "rejected"],
    },
  },
} as const
