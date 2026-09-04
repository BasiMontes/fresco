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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      favorites: {
        Row: {
          created_at: string
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_recipes: {
        Row: {
          created_at: string
          dia: Database["public"]["Enums"]["dia_semana"]
          estado: Database["public"]["Enums"]["estado_receta_menu"]
          id: string
          meal_plan_id: string
          rating: number | null
          recipe_id: string | null
          tipo_plato: Database["public"]["Enums"]["tipo_plato"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia: Database["public"]["Enums"]["dia_semana"]
          estado?: Database["public"]["Enums"]["estado_receta_menu"]
          id?: string
          meal_plan_id: string
          rating?: number | null
          recipe_id?: string | null
          tipo_plato: Database["public"]["Enums"]["tipo_plato"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia?: Database["public"]["Enums"]["dia_semana"]
          estado?: Database["public"]["Enums"]["estado_receta_menu"]
          id?: string
          meal_plan_id?: string
          rating?: number | null
          recipe_id?: string | null
          tipo_plato?: Database["public"]["Enums"]["tipo_plato"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_recipes_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          advertencias: string[]
          created_at: string
          explicacion_aprendizaje: string | null
          fecha_inicio: string
          id: string
          semana_iso: string
          updated_at: string
          user_id: string
        }
        Insert: {
          advertencias?: string[]
          created_at?: string
          explicacion_aprendizaje?: string | null
          fecha_inicio: string
          id?: string
          semana_iso: string
          updated_at?: string
          user_id: string
        }
        Update: {
          advertencias?: string[]
          created_at?: string
          explicacion_aprendizaje?: string | null
          fecha_inicio?: string
          id?: string
          semana_iso?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_exempt_users: {
        Row: {
          note: string | null
          user_id: string
        }
        Insert: {
          note?: string | null
          user_id: string
        }
        Update: {
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          endpoint: string
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          endpoint: string
          updated_at?: string
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          endpoint?: string
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      recetas_propias: {
        Row: {
          created_at: string
          id: string
          ingredientes: string[]
          nombre: string
          pasos: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredientes?: string[]
          nombre: string
          pasos?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredientes?: string[]
          nombre?: string
          pasos?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recetas_propias_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          alergenos: Json | null
          clasificacion: Json | null
          created_at: string
          descripcion_corta: string | null
          dieta: Json | null
          foto_url: string | null
          id: string
          ingredientes_principales: Json | null
          ingredientes_que_puede_desagradar: Json | null
          meta: Json | null
          nombre: string
          pasos_resumen: Json | null
          rating_promedio: number | null
          slug: string
          temporada: Json | null
          ultima_vez_en_menu: string | null
          updated_at: string
          veces_calificada: number
          veces_cocinada: number
          veces_descartada: number
        }
        Insert: {
          alergenos?: Json | null
          clasificacion?: Json | null
          created_at?: string
          descripcion_corta?: string | null
          dieta?: Json | null
          foto_url?: string | null
          id?: string
          ingredientes_principales?: Json | null
          ingredientes_que_puede_desagradar?: Json | null
          meta?: Json | null
          nombre: string
          pasos_resumen?: Json | null
          rating_promedio?: number | null
          slug: string
          temporada?: Json | null
          ultima_vez_en_menu?: string | null
          updated_at?: string
          veces_calificada?: number
          veces_cocinada?: number
          veces_descartada?: number
        }
        Update: {
          alergenos?: Json | null
          clasificacion?: Json | null
          created_at?: string
          descripcion_corta?: string | null
          dieta?: Json | null
          foto_url?: string | null
          id?: string
          ingredientes_principales?: Json | null
          ingredientes_que_puede_desagradar?: Json | null
          meta?: Json | null
          nombre?: string
          pasos_resumen?: Json | null
          rating_promedio?: number | null
          slug?: string
          temporada?: Json | null
          ultima_vez_en_menu?: string | null
          updated_at?: string
          veces_calificada?: number
          veces_cocinada?: number
          veces_descartada?: number
        }
        Relationships: []
      }
      shopping_lists: {
        Row: {
          coste_estimado_max: number
          coste_estimado_min: number
          created_at: string
          id: string
          items: Json
          meal_plan_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coste_estimado_max?: number
          coste_estimado_min?: number
          created_at?: string
          id?: string
          items?: Json
          meal_plan_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coste_estimado_max?: number
          coste_estimado_min?: number
          created_at?: string
          id?: string
          items?: Json
          meal_plan_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: true
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          adultos: number
          alergenos: string[]
          alergenos_texto_libre: string | null
          aviso_bienvenida_visto: boolean
          aviso_rutas_descartado: boolean
          cocinas_favoritas: Database["public"]["Enums"]["tipo_cocina"][]
          cocinas_texto_libre: string | null
          contundencia_preferida: Database["public"]["Enums"]["nivel_contundencia"]
          created_at: string
          dieta_halal: boolean
          dieta_keto: boolean
          dieta_sin_gluten: boolean
          dieta_sin_huevo: boolean
          dieta_sin_lactosa: boolean
          dieta_texto_libre: string | null
          dieta_vegano: boolean
          dieta_vegetariano: boolean
          id: string
          ingredientes_favoritos: string[]
          ingredientes_odiados: string[]
          ingredientes_odiados_texto_libre: string | null
          ninos: number
          nivel_experiencia:
            | Database["public"]["Enums"]["nivel_experiencia_culinaria"]
            | null
          nivel_picante: Database["public"]["Enums"]["nivel_picante"]
          nombre: string | null
          num_personas: number
          objetivo: Database["public"]["Enums"]["objetivo_usuario"] | null
          payment_failed_at: string | null
          plan: Database["public"]["Enums"]["plan_usuario"]
          plan_expires_at: string | null
          planning_selection: Json
          presupuesto_semana_euros: number | null
          sexo: Database["public"]["Enums"]["sexo_usuario"] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tiempo_max_finde_min: number
          tiempo_max_semana_min: number
          updated_at: string
        }
        Insert: {
          adultos?: number
          alergenos?: string[]
          alergenos_texto_libre?: string | null
          aviso_bienvenida_visto?: boolean
          aviso_rutas_descartado?: boolean
          cocinas_favoritas?: Database["public"]["Enums"]["tipo_cocina"][]
          cocinas_texto_libre?: string | null
          contundencia_preferida?: Database["public"]["Enums"]["nivel_contundencia"]
          created_at?: string
          dieta_halal?: boolean
          dieta_keto?: boolean
          dieta_sin_gluten?: boolean
          dieta_sin_huevo?: boolean
          dieta_sin_lactosa?: boolean
          dieta_texto_libre?: string | null
          dieta_vegano?: boolean
          dieta_vegetariano?: boolean
          id: string
          ingredientes_favoritos?: string[]
          ingredientes_odiados?: string[]
          ingredientes_odiados_texto_libre?: string | null
          ninos?: number
          nivel_experiencia?:
            | Database["public"]["Enums"]["nivel_experiencia_culinaria"]
            | null
          nivel_picante?: Database["public"]["Enums"]["nivel_picante"]
          nombre?: string | null
          num_personas?: number
          objetivo?: Database["public"]["Enums"]["objetivo_usuario"] | null
          payment_failed_at?: string | null
          plan?: Database["public"]["Enums"]["plan_usuario"]
          plan_expires_at?: string | null
          planning_selection?: Json
          presupuesto_semana_euros?: number | null
          sexo?: Database["public"]["Enums"]["sexo_usuario"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tiempo_max_finde_min?: number
          tiempo_max_semana_min?: number
          updated_at?: string
        }
        Update: {
          adultos?: number
          alergenos?: string[]
          alergenos_texto_libre?: string | null
          aviso_bienvenida_visto?: boolean
          aviso_rutas_descartado?: boolean
          cocinas_favoritas?: Database["public"]["Enums"]["tipo_cocina"][]
          cocinas_texto_libre?: string | null
          contundencia_preferida?: Database["public"]["Enums"]["nivel_contundencia"]
          created_at?: string
          dieta_halal?: boolean
          dieta_keto?: boolean
          dieta_sin_gluten?: boolean
          dieta_sin_huevo?: boolean
          dieta_sin_lactosa?: boolean
          dieta_texto_libre?: string | null
          dieta_vegano?: boolean
          dieta_vegetariano?: boolean
          id?: string
          ingredientes_favoritos?: string[]
          ingredientes_odiados?: string[]
          ingredientes_odiados_texto_libre?: string | null
          ninos?: number
          nivel_experiencia?:
            | Database["public"]["Enums"]["nivel_experiencia_culinaria"]
            | null
          nivel_picante?: Database["public"]["Enums"]["nivel_picante"]
          nombre?: string | null
          num_personas?: number
          objetivo?: Database["public"]["Enums"]["objetivo_usuario"] | null
          payment_failed_at?: string | null
          plan?: Database["public"]["Enums"]["plan_usuario"]
          plan_expires_at?: string | null
          planning_selection?: Json
          presupuesto_semana_euros?: number | null
          sexo?: Database["public"]["Enums"]["sexo_usuario"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tiempo_max_finde_min?: number
          tiempo_max_semana_min?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_rate_limit: {
        Args: {
          p_endpoint: string
          p_limit: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      copy_meal_plan_to_week: {
        Args: {
          p_fecha_inicio: string
          p_semana_iso: string
          p_source_meal_plan_id: string
        }
        Returns: string
      }
      get_catalog: {
        Args: {
          p_alergenos?: string[]
          p_cocinas?: string[]
          p_dietas?: string[]
          p_limit?: number
          p_meal_types?: string[]
          p_offset?: number
          p_search?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_filtered_recipes: {
        Args: { p_recipe_id?: string; p_user_id: string }
        Returns: {
          alergenos: Json | null
          clasificacion: Json | null
          created_at: string
          descripcion_corta: string | null
          dieta: Json | null
          foto_url: string | null
          id: string
          ingredientes_principales: Json | null
          ingredientes_que_puede_desagradar: Json | null
          meta: Json | null
          nombre: string
          pasos_resumen: Json | null
          rating_promedio: number | null
          slug: string
          temporada: Json | null
          ultima_vez_en_menu: string | null
          updated_at: string
          veces_calificada: number
          veces_cocinada: number
          veces_descartada: number
        }[]
        SetofOptions: {
          from: "*"
          to: "recipes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_push_subscriptions_without_current_plan: {
        Args: { p_semana_iso: string }
        Returns: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "push_subscriptions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_recent_recipe_marks: {
        Args: { p_user_id: string; p_weeks?: number }
        Returns: {
          estado: Database["public"]["Enums"]["estado_receta_menu"]
          recipe_id: string
        }[]
      }
      get_user_cooked_recipe_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      get_user_recipe_engagement: {
        Args: { p_user_id: string }
        Returns: {
          recipe_id: string
          veces_cocinada_usuario: number
          veces_descartada_usuario: number
        }[]
      }
      jsonb_add_item: {
        Args: { p_item: Json; p_list_id: string; p_pasillo_nombre: string }
        Returns: undefined
      }
      jsonb_clear_comprados: { Args: { p_list_id: string }; Returns: undefined }
      jsonb_set_comprado: {
        Args: {
          p_comprado: boolean
          p_item_idx: number
          p_list_id: string
          p_pasillo_idx: number
        }
        Returns: undefined
      }
      reassign_guest_data: {
        Args: { p_from_user_id: string; p_to_user_id: string }
        Returns: number
      }
      swap_meal_plan_slots: {
        Args: { p_slot_a_id: string; p_slot_b_id: string }
        Returns: undefined
      }
    }
    Enums: {
      dia_semana:
        | "lunes"
        | "martes"
        | "miercoles"
        | "jueves"
        | "viernes"
        | "sabado"
        | "domingo"
      estado_receta_menu:
        | "pendiente"
        | "cocinada"
        | "descartada"
        | "sustituida"
        | "excluida"
      nivel_contundencia: "ligero" | "media" | "contundente"
      nivel_experiencia_culinaria:
        | "aprendiz"
        | "novato"
        | "intermedio"
        | "chef"
        | "experto"
      nivel_picante: "ninguno" | "suave" | "medio" | "fuerte"
      objetivo_usuario:
        | "perder_peso"
        | "comer_sano"
        | "ahorrar_dinero"
        | "ganar_masa_muscular"
        | "comer_variado"
        | "reducir_desperdicio"
      plan_usuario: "free" | "pro" | "family"
      sexo_usuario: "mujer" | "hombre" | "otro" | "prefiero_no_decir"
      tipo_cocina:
        | "española"
        | "italiana"
        | "mexicana"
        | "asiática"
        | "mediterránea"
        | "latina"
        | "internacional"
      tipo_plato: "desayuno" | "comida" | "cena" | "snack"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      dia_semana: [
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado",
        "domingo",
      ],
      estado_receta_menu: [
        "pendiente",
        "cocinada",
        "descartada",
        "sustituida",
        "excluida",
      ],
      nivel_contundencia: ["ligero", "media", "contundente"],
      nivel_experiencia_culinaria: [
        "aprendiz",
        "novato",
        "intermedio",
        "chef",
        "experto",
      ],
      nivel_picante: ["ninguno", "suave", "medio", "fuerte"],
      objetivo_usuario: [
        "perder_peso",
        "comer_sano",
        "ahorrar_dinero",
        "ganar_masa_muscular",
        "comer_variado",
        "reducir_desperdicio",
      ],
      plan_usuario: ["free", "pro", "family"],
      sexo_usuario: ["mujer", "hombre", "otro", "prefiero_no_decir"],
      tipo_cocina: [
        "española",
        "italiana",
        "mexicana",
        "asiática",
        "mediterránea",
        "latina",
        "internacional",
      ],
      tipo_plato: ["desayuno", "comida", "cena", "snack"],
    },
  },
} as const
