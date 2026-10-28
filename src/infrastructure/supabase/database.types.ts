export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
      pages: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          handle: string;
          id: string;
          owner_id: string;
          show_handle: boolean;
          theme: Database["public"]["Enums"]["profile_theme"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          handle: string;
          id?: string;
          owner_id?: string;
          show_handle?: boolean;
          theme?: Database["public"]["Enums"]["profile_theme"];
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          handle?: string;
          id?: string;
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
    };
    Views: {
      public_page_v: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          display_name: string | null;
          handle: string | null;
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
      ingest_contact_message: {
        Args: { p_email: string; p_message: string; p_name: string };
        Returns: undefined;
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
      link_provider:
        "generic" | "youtube" | "twitch" | "kick" | "whatsapp" | "github" | "instagram";
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
      link_provider: ["generic", "youtube", "twitch", "kick", "whatsapp", "github", "instagram"],
      profile_theme: ["tecnico"],
      user_role: ["owner", "member"],
    },
  },
} as const;
