export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_preferences: {
        Row: {
          panel_mode: Database["public"]["Enums"]["color_mode"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          panel_mode?: Database["public"]["Enums"]["color_mode"];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          panel_mode?: Database["public"]["Enums"]["color_mode"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_status: {
        Row: {
          changed_at: string | null;
          channel_id: string;
          checked_at: string | null;
          is_live: boolean;
          live_started_at: string | null;
          live_title: string | null;
          live_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          changed_at?: string | null;
          channel_id: string;
          checked_at?: string | null;
          is_live?: boolean;
          live_started_at?: string | null;
          live_title?: string | null;
          live_url?: string | null;
        };
        Update: {
          changed_at?: string | null;
          channel_id?: string;
          checked_at?: string | null;
          is_live?: boolean;
          live_started_at?: string | null;
          live_title?: string | null;
          live_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "channel_status_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: true;
            referencedRelation: "provider_channels";
            referencedColumns: ["id"];
          },
        ];
      };
      featured_content: {
        Row: {
          duration_s: number | null;
          fetched_at: string;
          kind: string;
          link_id: string;
          published_at: string;
          title: string;
          video_id: string;
        };
        ComputedFields: never;
        Insert: {
          duration_s?: number | null;
          fetched_at?: string;
          kind: string;
          link_id: string;
          published_at: string;
          title: string;
          video_id: string;
        };
        Update: {
          duration_s?: number | null;
          fetched_at?: string;
          kind?: string;
          link_id?: string;
          published_at?: string;
          title?: string;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "featured_content_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: true;
            referencedRelation: "links";
            referencedColumns: ["id"];
          },
        ];
      };
      link_media_settings: {
        Row: {
          featured_mode: string;
          link_id: string;
          owner_id: string;
          pinned_video_id: string | null;
          updated_at: string;
          watch_live: boolean;
        };
        ComputedFields: never;
        Insert: {
          featured_mode?: string;
          link_id: string;
          owner_id?: string;
          pinned_video_id?: string | null;
          updated_at?: string;
          watch_live?: boolean;
        };
        Update: {
          featured_mode?: string;
          link_id?: string;
          owner_id?: string;
          pinned_video_id?: string | null;
          updated_at?: string;
          watch_live?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "link_media_settings_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: true;
            referencedRelation: "links";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "link_media_settings_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      link_stats_daily: {
        Row: {
          clicks: number;
          day: string;
          link_id: string;
        };
        ComputedFields: never;
        Insert: {
          clicks?: number;
          day: string;
          link_id: string;
        };
        Update: {
          clicks?: number;
          day?: string;
          link_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "link_stats_daily_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: false;
            referencedRelation: "links";
            referencedColumns: ["id"];
          },
        ];
      };
      links: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          owner_id: string;
          page_id: string;
          position: number;
          provider: Database["public"]["Enums"]["link_provider"];
          provider_handle: string | null;
          section_id: string | null;
          tags: string[];
          title: string;
          updated_at: string;
          url: string;
          version: number;
          visible: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          owner_id?: string;
          page_id: string;
          position?: number;
          provider?: Database["public"]["Enums"]["link_provider"];
          provider_handle?: string | null;
          section_id?: string | null;
          tags?: string[];
          title: string;
          updated_at?: string;
          url: string;
          version?: number;
          visible?: boolean;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          owner_id?: string;
          page_id?: string;
          position?: number;
          provider?: Database["public"]["Enums"]["link_provider"];
          provider_handle?: string | null;
          section_id?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
          url?: string;
          version?: number;
          visible?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "links_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "links_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "links_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "sections";
            referencedColumns: ["id"];
          },
        ];
      };
      mcp_grants: {
        Row: {
          can_write: boolean;
          client_id: string;
          client_name: string;
          created_at: string;
          last_used_at: string | null;
          redirect_host: string;
          revoked_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          can_write?: boolean;
          client_id: string;
          client_name: string;
          created_at?: string;
          last_used_at?: string | null;
          redirect_host: string;
          revoked_at?: string | null;
          user_id: string;
        };
        Update: {
          can_write?: boolean;
          client_id?: string;
          client_name?: string;
          created_at?: string;
          last_used_at?: string | null;
          redirect_host?: string;
          revoked_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mcp_grants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pages: {
        Row: {
          accent: Database["public"]["Enums"]["accent_color"];
          avatar_path: string | null;
          bio: string | null;
          color_mode: Database["public"]["Enums"]["color_mode"];
          created_at: string;
          display_name: string;
          handle: string;
          id: string;
          link_shape: Database["public"]["Enums"]["link_shape"];
          owner_id: string;
          show_handle: boolean;
          theme: Database["public"]["Enums"]["profile_theme"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accent?: Database["public"]["Enums"]["accent_color"];
          avatar_path?: string | null;
          bio?: string | null;
          color_mode?: Database["public"]["Enums"]["color_mode"];
          created_at?: string;
          display_name: string;
          handle: string;
          id?: string;
          link_shape?: Database["public"]["Enums"]["link_shape"];
          owner_id?: string;
          show_handle?: boolean;
          theme?: Database["public"]["Enums"]["profile_theme"];
          updated_at?: string;
        };
        Update: {
          accent?: Database["public"]["Enums"]["accent_color"];
          avatar_path?: string | null;
          bio?: string | null;
          color_mode?: Database["public"]["Enums"]["color_mode"];
          created_at?: string;
          display_name?: string;
          handle?: string;
          id?: string;
          link_shape?: Database["public"]["Enums"]["link_shape"];
          owner_id?: string;
          show_handle?: boolean;
          theme?: Database["public"]["Enums"]["profile_theme"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pages_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          disabled: boolean;
          id: string;
          last_page_id: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          disabled?: boolean;
          id: string;
          last_page_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          disabled?: boolean;
          id?: string;
          last_page_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_last_page_id_fkey";
            columns: ["last_page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_channels: {
        Row: {
          external_id: string | null;
          handle: string;
          id: string;
          last_error: string | null;
          provider: Database["public"]["Enums"]["link_provider"];
          resolved_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          external_id?: string | null;
          handle: string;
          id?: string;
          last_error?: string | null;
          provider: Database["public"]["Enums"]["link_provider"];
          resolved_at?: string | null;
        };
        Update: {
          external_id?: string | null;
          handle?: string;
          id?: string;
          last_error?: string | null;
          provider?: Database["public"]["Enums"]["link_provider"];
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      sections: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
          page_id: string;
          position: number;
          show_title: boolean;
          title: string;
          updated_at: string;
          version: number;
          visible: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          page_id: string;
          position?: number;
          show_title?: boolean;
          title: string;
          updated_at?: string;
          version?: number;
          visible?: boolean;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          page_id?: string;
          position?: number;
          show_title?: boolean;
          title?: string;
          updated_at?: string;
          version?: number;
          visible?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "sections_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sections_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
      stats_breakdown_daily: {
        Row: {
          clicks: number;
          day: string;
          dimension: string;
          page_id: string;
          value: string;
          views: number;
        };
        ComputedFields: never;
        Insert: {
          clicks?: number;
          day: string;
          dimension: string;
          page_id: string;
          value: string;
          views?: number;
        };
        Update: {
          clicks?: number;
          day?: string;
          dimension?: string;
          page_id?: string;
          value?: string;
          views?: number;
        };
        Relationships: [
          {
            foreignKeyName: "stats_breakdown_daily_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
      stats_daily: {
        Row: {
          clicks: number;
          day: string;
          page_id: string;
          views: number;
        };
        ComputedFields: never;
        Insert: {
          clicks?: number;
          day: string;
          page_id: string;
          views?: number;
        };
        Update: {
          clicks?: number;
          day?: string;
          page_id?: string;
          views?: number;
        };
        Relationships: [
          {
            foreignKeyName: "stats_daily_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      public_page_v: {
        Row: {
          accent: Database["public"]["Enums"]["accent_color"] | null;
          avatar_path: string | null;
          bio: string | null;
          color_mode: Database["public"]["Enums"]["color_mode"] | null;
          display_name: string | null;
          handle: string | null;
          link_shape: Database["public"]["Enums"]["link_shape"] | null;
          sections: Json | null;
          show_handle: boolean | null;
          theme: Database["public"]["Enums"]["profile_theme"] | null;
          unsectioned_links: Json | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      admin_invite: { Args: { target_email: string; target_handle: string }; Returns: string };
      admin_list_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          email: string;
          handle: string;
          invited_at: string;
          last_sign_in_at: string;
          role: Database["public"]["Enums"]["user_role"];
          status: string;
        }[];
      };
      admin_revoke: {
        Args: { target_email: string };
        Returns: {
          handles: string[];
          status: string;
        }[];
      };
      ingest_channel: {
        Args: { p_error: string; p_external_id: string; p_handle: string; p_provider: string };
        Returns: undefined;
      };
      ingest_consume_quota: {
        Args: { p_daily_limit: number; p_provider: string; p_units: number };
        Returns: boolean;
      };
      ingest_contact_message: {
        Args: { p_email: string; p_message: string; p_name: string };
        Returns: undefined;
      };
      ingest_event: {
        Args: {
          p_country: string;
          p_handle: string;
          p_link: string;
          p_source: string;
          p_type: string;
          p_viewer: string;
        };
        Returns: undefined;
      };
      ingest_featured: {
        Args: {
          p_duration_s: number;
          p_kind: string;
          p_link_id: string;
          p_published_at: string;
          p_title: string;
          p_video_id: string;
        };
        Returns: string;
      };
      ingest_featured_clear: { Args: { p_link_id: string }; Returns: string };
      ingest_featured_targets: {
        Args: Record<PropertyKey, never>;
        Returns: {
          channel_checked_at: string;
          channel_id: string;
          current_video_id: string;
          featured_mode: string;
          fetched_at: string;
          handle: string;
          link_id: string;
          pinned_video_id: string;
        }[];
      };
      ingest_live_status: {
        Args: {
          p_handle: string;
          p_is_live: boolean;
          p_provider: string;
          p_started_at: string;
          p_title: string;
          p_url: string;
        };
        Returns: string[];
      };
      ingest_live_targets: {
        Args: Record<PropertyKey, never>;
        Returns: {
          channel_checked_at: string;
          channel_id: string;
          handle: string;
          provider: string;
        }[];
      };
      ingest_live_targets_of: {
        Args: { p_owner: string };
        Returns: {
          channel_checked_at: string;
          channel_id: string;
          handle: string;
          provider: string;
        }[];
      };
      ingest_purge_stats: { Args: Record<PropertyKey, never>; Returns: undefined };
      ingest_release_lock: { Args: { p_job: string }; Returns: undefined };
      ingest_try_lock: { Args: { p_job: string; p_seconds: number }; Returns: boolean };
      link_featured: { Args: { p_link_id: string }; Returns: Json };
      link_live: { Args: { p_link_id: string }; Returns: Json };
      mcp_authorize: { Args: { p_write?: boolean }; Returns: boolean };
      mcp_create_link: {
        Args: {
          p_description: string;
          p_id: string;
          p_page: string;
          p_provider: Database["public"]["Enums"]["link_provider"];
          p_provider_handle: string;
          p_section: string;
          p_tags: string[];
          p_title: string;
          p_url: string;
          p_visible: boolean;
        };
        Returns: {
          created_at: string;
          description: string | null;
          id: string;
          owner_id: string;
          page_id: string;
          position: number;
          provider: Database["public"]["Enums"]["link_provider"];
          provider_handle: string | null;
          section_id: string | null;
          tags: string[];
          title: string;
          updated_at: string;
          url: string;
          version: number;
          visible: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "links";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mcp_create_section: {
        Args: {
          p_id: string;
          p_page: string;
          p_show_title: boolean;
          p_title: string;
          p_visible: boolean;
        };
        Returns: {
          created_at: string;
          id: string;
          owner_id: string;
          page_id: string;
          position: number;
          show_title: boolean;
          title: string;
          updated_at: string;
          version: number;
          visible: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "sections";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mcp_delete_link: {
        Args: { p_confirm_title: string; p_id: string; p_page: string; p_version: number };
        Returns: undefined;
      };
      mcp_delete_section: {
        Args: { p_confirm_title: string; p_id: string; p_page: string; p_version: number };
        Returns: undefined;
      };
      mcp_move_links: {
        Args: { p_ids: string[]; p_page: string; p_section: string; p_versions: number[] };
        Returns: undefined;
      };
      mcp_reorder_sections: {
        Args: { p_ids: string[]; p_page: string; p_versions: number[] };
        Returns: undefined;
      };
      mcp_revoke_grant: { Args: { p_client_id: string }; Returns: boolean };
      mcp_save_grant: {
        Args: {
          p_can_write: boolean;
          p_client_id: string;
          p_client_name: string;
          p_redirect_host: string;
        };
        Returns: undefined;
      };
      mcp_set_link_media: {
        Args: { p_changes: Json; p_link: string };
        Returns: {
          featured_mode: string;
          link_id: string;
          owner_id: string;
          pinned_video_id: string | null;
          updated_at: string;
          watch_live: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "link_media_settings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mcp_update_link: {
        Args: { p_changes: Json; p_id: string; p_page: string; p_version: number };
        Returns: {
          created_at: string;
          description: string | null;
          id: string;
          owner_id: string;
          page_id: string;
          position: number;
          provider: Database["public"]["Enums"]["link_provider"];
          provider_handle: string | null;
          section_id: string | null;
          tags: string[];
          title: string;
          updated_at: string;
          url: string;
          version: number;
          visible: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "links";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mcp_update_page: {
        Args: { p_changes: Json; p_page: string };
        Returns: {
          accent: Database["public"]["Enums"]["accent_color"];
          avatar_path: string | null;
          bio: string | null;
          color_mode: Database["public"]["Enums"]["color_mode"];
          created_at: string;
          display_name: string;
          handle: string;
          id: string;
          link_shape: Database["public"]["Enums"]["link_shape"];
          owner_id: string;
          show_handle: boolean;
          theme: Database["public"]["Enums"]["profile_theme"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "pages";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mcp_update_section: {
        Args: { p_changes: Json; p_id: string; p_page: string; p_version: number };
        Returns: {
          created_at: string;
          id: string;
          owner_id: string;
          page_id: string;
          position: number;
          show_title: boolean;
          title: string;
          updated_at: string;
          version: number;
          visible: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "sections";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      move_links: {
        Args: {
          expected_versions: number[];
          ids: string[];
          target_page: string;
          target_section: string;
        };
        Returns: undefined;
      };
      reorder_sections: {
        Args: { expected_versions: number[]; ids: string[]; target_page: string };
        Returns: undefined;
      };
    };
    Enums: {
      accent_color:
        "hueso" | "coral" | "ambar" | "cielo" | "lavanda" | "rosa" | "turquesa" | "arena";
      color_mode: "auto" | "dark" | "light";
      link_provider:
        "generic" | "youtube" | "twitch" | "kick" | "whatsapp" | "github" | "instagram";
      link_shape: "rows" | "cards" | "pills";
      profile_theme: "tecnico";
      user_role: "owner" | "member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      accent_color: ["hueso", "coral", "ambar", "cielo", "lavanda", "rosa", "turquesa", "arena"],
      color_mode: ["auto", "dark", "light"],
      link_provider: ["generic", "youtube", "twitch", "kick", "whatsapp", "github", "instagram"],
      link_shape: ["rows", "cards", "pills"],
      profile_theme: ["tecnico"],
      user_role: ["owner", "member"],
    },
  },
} as const;
