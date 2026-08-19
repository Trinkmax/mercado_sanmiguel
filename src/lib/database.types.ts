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
      aceptaciones_terminos: {
        Row: {
          aceptado_en: string
          cliente_id: string
          id: string
          org_id: string
          terminos_id: string
          user_id: string | null
        }
        Insert: {
          aceptado_en?: string
          cliente_id: string
          id?: string
          org_id: string
          terminos_id: string
          user_id?: string | null
        }
        Update: {
          aceptado_en?: string
          cliente_id?: string
          id?: string
          org_id?: string
          terminos_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aceptaciones_terminos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aceptaciones_terminos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aceptaciones_terminos_terminos_id_fkey"
            columns: ["terminos_id"]
            isOneToOne: false
            referencedRelation: "terminos"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_eventos: {
        Row: {
          caja_id: string
          creado_en: string
          detalle: string | null
          id: string
          org_id: string
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          caja_id: string
          creado_en?: string
          detalle?: string | null
          id?: string
          org_id: string
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          caja_id?: string
          creado_en?: string
          detalle?: string | null
          id?: string
          org_id?: string
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caja_eventos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_eventos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cajas: {
        Row: {
          abierta_en: string
          abierta_por: string | null
          caja_destino_id: string | null
          cerrada_en: string | null
          cerrada_por: string | null
          estado: Database["public"]["Enums"]["estado_caja"]
          fecha: string
          id: string
          integrada_en: string | null
          integrada_por: string | null
          observaciones: string | null
          org_id: string
          reapertura_motivo: string | null
          reapertura_solicitada_en: string | null
          reapertura_solicitada_por: string | null
          reaperturas: number
          tipo: Database["public"]["Enums"]["tipo_caja"]
          total_canon: number | null
          total_cheques: number | null
          total_efectivo: number | null
          total_gastos: number | null
          total_rendido_efectivo: number | null
          total_rendido_transferencia: number | null
          total_transferencia: number | null
          validada_en: string | null
          validada_por: string | null
        }
        Insert: {
          abierta_en?: string
          abierta_por?: string | null
          caja_destino_id?: string | null
          cerrada_en?: string | null
          cerrada_por?: string | null
          estado?: Database["public"]["Enums"]["estado_caja"]
          fecha?: string
          id?: string
          integrada_en?: string | null
          integrada_por?: string | null
          observaciones?: string | null
          org_id: string
          reapertura_motivo?: string | null
          reapertura_solicitada_en?: string | null
          reapertura_solicitada_por?: string | null
          reaperturas?: number
          tipo: Database["public"]["Enums"]["tipo_caja"]
          total_canon?: number | null
          total_cheques?: number | null
          total_efectivo?: number | null
          total_gastos?: number | null
          total_rendido_efectivo?: number | null
          total_rendido_transferencia?: number | null
          total_transferencia?: number | null
          validada_en?: string | null
          validada_por?: string | null
        }
        Update: {
          abierta_en?: string
          abierta_por?: string | null
          caja_destino_id?: string | null
          cerrada_en?: string | null
          cerrada_por?: string | null
          estado?: Database["public"]["Enums"]["estado_caja"]
          fecha?: string
          id?: string
          integrada_en?: string | null
          integrada_por?: string | null
          observaciones?: string | null
          org_id?: string
          reapertura_motivo?: string | null
          reapertura_solicitada_en?: string | null
          reapertura_solicitada_por?: string | null
          reaperturas?: number
          tipo?: Database["public"]["Enums"]["tipo_caja"]
          total_canon?: number | null
          total_cheques?: number | null
          total_efectivo?: number | null
          total_gastos?: number | null
          total_rendido_efectivo?: number | null
          total_rendido_transferencia?: number | null
          total_transferencia?: number | null
          validada_en?: string | null
          validada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cajas_caja_destino_id_fkey"
            columns: ["caja_destino_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cajas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cambios_pendientes: {
        Row: {
          accion: string
          cliente_id: string | null
          datos: Json
          datos_anteriores: Json | null
          entidad: string
          entidad_id: string | null
          estado: Database["public"]["Enums"]["estado_cambio"]
          id: string
          motivo_rechazo: string | null
          org_id: string
          resultado_id: string | null
          resumen: string
          revisado_en: string | null
          revisado_por: string | null
          solicitado_en: string
          solicitado_por: string | null
        }
        Insert: {
          accion: string
          cliente_id?: string | null
          datos?: Json
          datos_anteriores?: Json | null
          entidad: string
          entidad_id?: string | null
          estado?: Database["public"]["Enums"]["estado_cambio"]
          id?: string
          motivo_rechazo?: string | null
          org_id: string
          resultado_id?: string | null
          resumen: string
          revisado_en?: string | null
          revisado_por?: string | null
          solicitado_en?: string
          solicitado_por?: string | null
        }
        Update: {
          accion?: string
          cliente_id?: string | null
          datos?: Json
          datos_anteriores?: Json | null
          entidad?: string
          entidad_id?: string | null
          estado?: Database["public"]["Enums"]["estado_cambio"]
          id?: string
          motivo_rechazo?: string | null
          org_id?: string
          resultado_id?: string | null
          resumen?: string
          revisado_en?: string | null
          revisado_por?: string | null
          solicitado_en?: string
          solicitado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cambios_pendientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cambios_pendientes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      canon_camiones: {
        Row: {
          caja_id: string
          cantidad: number
          creado_en: string
          creado_por: string | null
          fecha: string
          id: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          notas: string | null
          org_id: string
          tipo: string
        }
        Insert: {
          caja_id: string
          cantidad?: number
          creado_en?: string
          creado_por?: string | null
          fecha?: string
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"]
          monto: number
          notas?: string | null
          org_id: string
          tipo?: string
        }
        Update: {
          caja_id?: string
          cantidad?: number
          creado_en?: string
          creado_por?: string | null
          fecha?: string
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"]
          monto?: number
          notas?: string | null
          org_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "canon_camiones_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canon_camiones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          cantidad: number
          cliente_id: string
          codigo: string
          concepto_id: string
          creado_en: string
          descripcion: string
          descuento_aplicado: number
          descuento_pronto_pago: number
          estado: Database["public"]["Enums"]["estado_cargo"]
          id: string
          monto: number
          monto_pagado: number
          org_id: string
          origen: string
          origen_lectura: string | null
          periodo: string
          precio_unitario: number
          vencimiento: string
        }
        Insert: {
          cantidad?: number
          cliente_id: string
          codigo: string
          concepto_id: string
          creado_en?: string
          descripcion: string
          descuento_aplicado?: number
          descuento_pronto_pago?: number
          estado?: Database["public"]["Enums"]["estado_cargo"]
          id?: string
          monto: number
          monto_pagado?: number
          org_id: string
          origen?: string
          origen_lectura?: string | null
          periodo: string
          precio_unitario?: number
          vencimiento: string
        }
        Update: {
          cantidad?: number
          cliente_id?: string
          codigo?: string
          concepto_id?: string
          creado_en?: string
          descripcion?: string
          descuento_aplicado?: number
          descuento_pronto_pago?: number
          estado?: Database["public"]["Enums"]["estado_cargo"]
          id?: string
          monto?: number
          monto_pagado?: number
          org_id?: string
          origen?: string
          origen_lectura?: string | null
          periodo?: string
          precio_unitario?: number
          vencimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_origen_lectura_fkey"
            columns: ["origen_lectura"]
            isOneToOne: false
            referencedRelation: "lecturas"
            referencedColumns: ["id"]
          },
        ]
      }
      cheques: {
        Row: {
          banco: string | null
          cliente_id: string | null
          creado_en: string
          creado_por: string | null
          es_tercero: boolean
          estado: Database["public"]["Enums"]["estado_cheque"]
          fecha_acreditado: string | null
          fecha_cobro: string
          fecha_depositado: string | null
          fecha_recibido: string
          id: string
          monto: number
          notas: string | null
          numero: string
          org_id: string
          titular: string
        }
        Insert: {
          banco?: string | null
          cliente_id?: string | null
          creado_en?: string
          creado_por?: string | null
          es_tercero?: boolean
          estado?: Database["public"]["Enums"]["estado_cheque"]
          fecha_acreditado?: string | null
          fecha_cobro?: string
          fecha_depositado?: string | null
          fecha_recibido?: string
          id?: string
          monto: number
          notas?: string | null
          numero: string
          org_id: string
          titular: string
        }
        Update: {
          banco?: string | null
          cliente_id?: string | null
          creado_en?: string
          creado_por?: string | null
          es_tercero?: boolean
          estado?: Database["public"]["Enums"]["estado_cheque"]
          fecha_acreditado?: string | null
          fecha_cobro?: string
          fecha_depositado?: string | null
          fecha_recibido?: string
          id?: string
          monto?: number
          notas?: string | null
          numero?: string
          org_id?: string
          titular?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheques_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      circular_recepciones: {
        Row: {
          circular_id: string
          cliente_id: string
          id: string
          org_id: string
          recibida_en: string
          recibida_por: string | null
        }
        Insert: {
          circular_id: string
          cliente_id: string
          id?: string
          org_id: string
          recibida_en?: string
          recibida_por?: string | null
        }
        Update: {
          circular_id?: string
          cliente_id?: string
          id?: string
          org_id?: string
          recibida_en?: string
          recibida_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circular_recepciones_circular_id_fkey"
            columns: ["circular_id"]
            isOneToOne: false
            referencedRelation: "circulares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circular_recepciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circular_recepciones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      circulares: {
        Row: {
          activa: boolean
          creada_en: string
          creada_por: string | null
          detalle: string | null
          fecha: string
          id: string
          numero: number
          obligatoria: boolean
          org_id: string
          storage_path: string | null
          titulo: string
        }
        Insert: {
          activa?: boolean
          creada_en?: string
          creada_por?: string | null
          detalle?: string | null
          fecha?: string
          id?: string
          numero?: never
          obligatoria?: boolean
          org_id: string
          storage_path?: string | null
          titulo: string
        }
        Update: {
          activa?: boolean
          creada_en?: string
          creada_por?: string | null
          detalle?: string | null
          fecha?: string
          id?: string
          numero?: never
          obligatoria?: boolean
          org_id?: string
          storage_path?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "circulares_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_conceptos: {
        Row: {
          activo: boolean
          cantidad: number
          cliente_id: string
          concepto_id: string
          id: string
          notas: string | null
          org_id: string
        }
        Insert: {
          activo?: boolean
          cantidad?: number
          cliente_id: string
          concepto_id: string
          id?: string
          notas?: string | null
          org_id: string
        }
        Update: {
          activo?: boolean
          cantidad?: number
          cliente_id?: string
          concepto_id?: string
          id?: string
          notas?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_conceptos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_conceptos_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_conceptos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean
          apodo: string | null
          auth_user_id: string | null
          codigo: number
          creado_en: string
          cuit: string | null
          cuotas_mes: number
          direccion: string | null
          email: string | null
          id: string
          nombre: string
          notas: string | null
          org_id: string
          telefono: string | null
          tipo_persona: Database["public"]["Enums"]["tipo_persona"]
        }
        Insert: {
          activo?: boolean
          apodo?: string | null
          auth_user_id?: string | null
          codigo: number
          creado_en?: string
          cuit?: string | null
          cuotas_mes?: number
          direccion?: string | null
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          org_id: string
          telefono?: string | null
          tipo_persona?: Database["public"]["Enums"]["tipo_persona"]
        }
        Update: {
          activo?: boolean
          apodo?: string | null
          auth_user_id?: string | null
          codigo?: number
          creado_en?: string
          cuit?: string | null
          cuotas_mes?: number
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          org_id?: string
          telefono?: string | null
          tipo_persona?: Database["public"]["Enums"]["tipo_persona"]
        }
        Relationships: [
          {
            foreignKeyName: "clientes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos: {
        Row: {
          activo: boolean
          codigo: string
          descuento_pronto_pago: number
          id: string
          nombre: string
          orden_imputacion: number
          org_id: string
          precio: number
          tipo: Database["public"]["Enums"]["tipo_concepto"]
        }
        Insert: {
          activo?: boolean
          codigo: string
          descuento_pronto_pago?: number
          id?: string
          nombre: string
          orden_imputacion?: number
          org_id: string
          precio?: number
          tipo?: Database["public"]["Enums"]["tipo_concepto"]
        }
        Update: {
          activo?: boolean
          codigo?: string
          descuento_pronto_pago?: number
          id?: string
          nombre?: string
          orden_imputacion?: number
          org_id?: string
          precio?: number
          tipo?: Database["public"]["Enums"]["tipo_concepto"]
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          dia_vencimiento: number
          impresion_directa: boolean
          org_id: string
          precio_canon_ambulante: number
          precio_canon_camion: number
          precio_canon_quintero_dia: number
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          dia_vencimiento?: number
          impresion_directa?: boolean
          org_id: string
          precio_canon_ambulante?: number
          precio_canon_camion?: number
          precio_canon_quintero_dia?: number
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          dia_vencimiento?: number
          impresion_directa?: boolean
          org_id?: string
          precio_canon_ambulante?: number
          precio_canon_camion?: number
          precio_canon_quintero_dia?: number
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_cliente: {
        Row: {
          categoria: string
          cliente_id: string
          creado_en: string
          id: string
          mime: string | null
          org_id: string
          storage_path: string
          subido_por: string | null
          titulo: string
        }
        Insert: {
          categoria?: string
          cliente_id: string
          creado_en?: string
          id?: string
          mime?: string | null
          org_id: string
          storage_path: string
          subido_por?: string | null
          titulo: string
        }
        Update: {
          categoria?: string
          cliente_id?: string
          creado_en?: string
          id?: string
          mime?: string | null
          org_id?: string
          storage_path?: string
          subido_por?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cliente_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      empleado_horarios: {
        Row: {
          dia_semana: number
          empleado_id: string
          hora_desde: string
          hora_hasta: string
          id: string
          org_id: string
        }
        Insert: {
          dia_semana: number
          empleado_id: string
          hora_desde: string
          hora_hasta: string
          id?: string
          org_id: string
        }
        Update: {
          dia_semana?: number
          empleado_id?: string
          hora_desde?: string
          hora_hasta?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_horarios_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_horarios_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          activo: boolean
          actualizado_en: string
          apellido: string
          cargo: string | null
          contrato_path: string | null
          creado_en: string
          creado_por: string | null
          cuil: string | null
          dni: string
          email: string | null
          fecha_egreso: string | null
          fecha_ingreso: string | null
          id: string
          nombre: string
          observaciones: string | null
          org_id: string
          telefono: string | null
          tipo_contrato: Database["public"]["Enums"]["tipo_contrato"]
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          apellido: string
          cargo?: string | null
          contrato_path?: string | null
          creado_en?: string
          creado_por?: string | null
          cuil?: string | null
          dni: string
          email?: string | null
          fecha_egreso?: string | null
          fecha_ingreso?: string | null
          id?: string
          nombre: string
          observaciones?: string | null
          org_id: string
          telefono?: string | null
          tipo_contrato?: Database["public"]["Enums"]["tipo_contrato"]
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          apellido?: string
          cargo?: string | null
          contrato_path?: string | null
          creado_en?: string
          creado_por?: string | null
          cuil?: string | null
          dni?: string
          email?: string | null
          fecha_egreso?: string | null
          fecha_ingreso?: string | null
          id?: string
          nombre?: string
          observaciones?: string | null
          org_id?: string
          telefono?: string | null
          tipo_contrato?: Database["public"]["Enums"]["tipo_contrato"]
        }
        Relationships: [
          {
            foreignKeyName: "empleados_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          caja_id: string | null
          comprobante_validado: boolean
          creado_en: string
          creado_por: string | null
          descripcion: string
          estado: Database["public"]["Enums"]["estado_gasto"]
          factura_path: string | null
          fecha_pago: string | null
          id: string
          medio_pago: Database["public"]["Enums"]["medio_pago"] | null
          monto: number
          notas: string | null
          org_id: string
          pagado_desde: string | null
          rubro_id: string
          tipo: Database["public"]["Enums"]["tipo_gasto"]
          validado_en: string | null
          validado_por: string | null
          vencimiento: string | null
        }
        Insert: {
          caja_id?: string | null
          comprobante_validado?: boolean
          creado_en?: string
          creado_por?: string | null
          descripcion: string
          estado?: Database["public"]["Enums"]["estado_gasto"]
          factura_path?: string | null
          fecha_pago?: string | null
          id?: string
          medio_pago?: Database["public"]["Enums"]["medio_pago"] | null
          monto: number
          notas?: string | null
          org_id: string
          pagado_desde?: string | null
          rubro_id: string
          tipo?: Database["public"]["Enums"]["tipo_gasto"]
          validado_en?: string | null
          validado_por?: string | null
          vencimiento?: string | null
        }
        Update: {
          caja_id?: string | null
          comprobante_validado?: boolean
          creado_en?: string
          creado_por?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_gasto"]
          factura_path?: string | null
          fecha_pago?: string | null
          id?: string
          medio_pago?: Database["public"]["Enums"]["medio_pago"] | null
          monto?: number
          notas?: string | null
          org_id?: string
          pagado_desde?: string | null
          rubro_id?: string
          tipo?: Database["public"]["Enums"]["tipo_gasto"]
          validado_en?: string | null
          validado_por?: string | null
          vencimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_rubro_id_fkey"
            columns: ["rubro_id"]
            isOneToOne: false
            referencedRelation: "rubros_gasto"
            referencedColumns: ["id"]
          },
        ]
      }
      imputaciones: {
        Row: {
          cargo_id: string
          id: string
          monto: number
          org_id: string
          pago_id: string
        }
        Insert: {
          cargo_id: string
          id?: string
          monto: number
          org_id: string
          pago_id: string
        }
        Update: {
          cargo_id?: string
          id?: string
          monto?: number
          org_id?: string
          pago_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imputaciones_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputaciones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputaciones_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos_personal: {
        Row: {
          apellido: string
          dni: string
          egreso_en: string | null
          empleado_id: string | null
          firma_path: string
          fuera_de_horario: boolean
          id: string
          ingreso_en: string
          nombre: string
          notas: string | null
          org_id: string
          registrado_por: string | null
        }
        Insert: {
          apellido: string
          dni: string
          egreso_en?: string | null
          empleado_id?: string | null
          firma_path: string
          fuera_de_horario?: boolean
          id?: string
          ingreso_en?: string
          nombre: string
          notas?: string | null
          org_id: string
          registrado_por?: string | null
        }
        Update: {
          apellido?: string
          dni?: string
          egreso_en?: string | null
          empleado_id?: string | null
          firma_path?: string
          fuera_de_horario?: boolean
          id?: string
          ingreso_en?: string
          nombre?: string
          notas?: string | null
          org_id?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingresos_personal_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_personal_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      lecturas: {
        Row: {
          creado_en: string
          creado_por: string | null
          fecha_lectura: string
          id: string
          kwh: number | null
          lectura_actual: number
          lectura_anterior: number
          medidor_id: string
          monto: number | null
          org_id: string
          periodo: string
          precio_kwh: number
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          fecha_lectura?: string
          id?: string
          kwh?: number | null
          lectura_actual: number
          lectura_anterior: number
          medidor_id: string
          monto?: number | null
          org_id: string
          periodo: string
          precio_kwh: number
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          fecha_lectura?: string
          id?: string
          kwh?: number | null
          lectura_actual?: number
          lectura_anterior?: number
          medidor_id?: string
          monto?: number | null
          org_id?: string
          periodo?: string
          precio_kwh?: number
        }
        Relationships: [
          {
            foreignKeyName: "lecturas_medidor_id_fkey"
            columns: ["medidor_id"]
            isOneToOne: false
            referencedRelation: "medidores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecturas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_posiciones: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          cliente_id: string
          id: string
          org_id: string
          tipo: string
          x: number
          y: number
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          cliente_id: string
          id?: string
          org_id: string
          tipo: string
          x: number
          y: number
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          cliente_id?: string
          id?: string
          org_id?: string
          tipo?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "mapa_posiciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_posiciones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      medidores: {
        Row: {
          activo: boolean
          cliente_id: string
          id: string
          numero: string
          org_id: string
          ubicacion: string | null
        }
        Insert: {
          activo?: boolean
          cliente_id: string
          id?: string
          numero: string
          org_id: string
          ubicacion?: string | null
        }
        Update: {
          activo?: boolean
          cliente_id?: string
          id?: string
          numero?: string
          org_id?: string
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medidores_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medidores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_tesoreria: {
        Row: {
          caja_id: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string
          fecha: string
          id: string
          monto: number
          org_id: string
          tipo: Database["public"]["Enums"]["tipo_mov_tesoreria"]
        }
        Insert: {
          caja_id?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion: string
          fecha?: string
          id?: string
          monto: number
          org_id: string
          tipo: Database["public"]["Enums"]["tipo_mov_tesoreria"]
        }
        Update: {
          caja_id?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string
          fecha?: string
          id?: string
          monto?: number
          org_id?: string
          tipo?: Database["public"]["Enums"]["tipo_mov_tesoreria"]
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_tesoreria_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_tesoreria_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      organizaciones: {
        Row: {
          creado_en: string
          id: string
          nombre: string
          slug: string
        }
        Insert: {
          creado_en?: string
          id?: string
          nombre: string
          slug: string
        }
        Update: {
          creado_en?: string
          id?: string
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      pagos: {
        Row: {
          anulado: boolean
          anulado_en: string | null
          anulado_por: string | null
          caja_id: string
          cheque_id: string | null
          cliente_id: string
          comprobante_path: string | null
          conciliado: boolean
          conciliado_en: string | null
          conciliado_por: string | null
          fecha: string
          id: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          motivo_anulacion: string | null
          notas: string | null
          numero: number
          org_id: string
          recibido_por: string | null
          titular_transferencia: string | null
        }
        Insert: {
          anulado?: boolean
          anulado_en?: string | null
          anulado_por?: string | null
          caja_id: string
          cheque_id?: string | null
          cliente_id: string
          comprobante_path?: string | null
          conciliado?: boolean
          conciliado_en?: string | null
          conciliado_por?: string | null
          fecha?: string
          id?: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          motivo_anulacion?: string | null
          notas?: string | null
          numero?: never
          org_id: string
          recibido_por?: string | null
          titular_transferencia?: string | null
        }
        Update: {
          anulado?: boolean
          anulado_en?: string | null
          anulado_por?: string | null
          caja_id?: string
          cheque_id?: string | null
          cliente_id?: string
          comprobante_path?: string | null
          conciliado?: boolean
          conciliado_en?: string | null
          conciliado_por?: string | null
          fecha?: string
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"]
          monto?: number
          motivo_anulacion?: string | null
          notas?: string | null
          numero?: never
          org_id?: string
          recibido_por?: string | null
          titular_transferencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          creado_en: string
          nombre: string
          org_id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          user_id: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          nombre: string
          org_id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          user_id: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          nombre?: string
          org_id?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos: {
        Row: {
          estado: string
          generado_en: string | null
          generado_por: string | null
          id: string
          org_id: string
          periodo: string
          vencimiento: string
        }
        Insert: {
          estado?: string
          generado_en?: string | null
          generado_por?: string | null
          id?: string
          org_id: string
          periodo: string
          vencimiento: string
        }
        Update: {
          estado?: string
          generado_en?: string | null
          generado_por?: string | null
          id?: string
          org_id?: string
          periodo?: string
          vencimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      rubros_gasto: {
        Row: {
          activo: boolean
          codigo: string
          id: string
          nombre: string
          org_id: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          id?: string
          nombre: string
          org_id: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          id?: string
          nombre?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubros_gasto_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos_iniciales: {
        Row: {
          fecha: string
          id: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          notas: string | null
          org_id: string
        }
        Insert: {
          fecha?: string
          id?: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto?: number
          notas?: string | null
          org_id: string
        }
        Update: {
          fecha?: string
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"]
          monto?: number
          notas?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saldos_iniciales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      sanciones: {
        Row: {
          cliente_id: string
          creado_en: string
          creado_por: string | null
          detalle: string | null
          fecha: string
          id: string
          org_id: string
          storage_path: string | null
          tipo: Database["public"]["Enums"]["tipo_sancion"]
          titulo: string
        }
        Insert: {
          cliente_id: string
          creado_en?: string
          creado_por?: string | null
          detalle?: string | null
          fecha?: string
          id?: string
          org_id: string
          storage_path?: string | null
          tipo?: Database["public"]["Enums"]["tipo_sancion"]
          titulo: string
        }
        Update: {
          cliente_id?: string
          creado_en?: string
          creado_por?: string | null
          detalle?: string | null
          fecha?: string
          id?: string
          org_id?: string
          storage_path?: string | null
          tipo?: Database["public"]["Enums"]["tipo_sancion"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanciones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitud_mensajes: {
        Row: {
          adjunto_path: string | null
          autor_id: string | null
          autor_nombre: string
          autor_rol: Database["public"]["Enums"]["rol_usuario"]
          creado_en: string
          id: string
          interno: boolean
          mensaje: string
          org_id: string
          solicitud_id: string
        }
        Insert: {
          adjunto_path?: string | null
          autor_id?: string | null
          autor_nombre: string
          autor_rol: Database["public"]["Enums"]["rol_usuario"]
          creado_en?: string
          id?: string
          interno?: boolean
          mensaje: string
          org_id: string
          solicitud_id: string
        }
        Update: {
          adjunto_path?: string | null
          autor_id?: string | null
          autor_nombre?: string
          autor_rol?: Database["public"]["Enums"]["rol_usuario"]
          creado_en?: string
          id?: string
          interno?: boolean
          mensaje?: string
          org_id?: string
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_mensajes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitud_mensajes_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes: {
        Row: {
          actualizada_en: string
          adjunto_path: string | null
          asignada_a: string | null
          asignada_en: string | null
          asunto: string
          cerrada_en: string | null
          cliente_id: string | null
          creada_en: string
          creada_por: string | null
          derivada_consejo_en: string | null
          detalle: string | null
          ejecutada_en: string | null
          ejecutada_por: string | null
          estado: Database["public"]["Enums"]["estado_solicitud"]
          id: string
          nota_ejecucion: string | null
          numero: number
          org_id: string
          origen: Database["public"]["Enums"]["origen_solicitud"]
          referencia: string | null
          resolucion: string | null
          resuelta_en: string | null
          resuelta_por: string | null
          revisada_en: string | null
          revisada_por: string | null
          tipo: Database["public"]["Enums"]["tipo_solicitud"]
        }
        Insert: {
          actualizada_en?: string
          adjunto_path?: string | null
          asignada_a?: string | null
          asignada_en?: string | null
          asunto: string
          cerrada_en?: string | null
          cliente_id?: string | null
          creada_en?: string
          creada_por?: string | null
          derivada_consejo_en?: string | null
          detalle?: string | null
          ejecutada_en?: string | null
          ejecutada_por?: string | null
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          id?: string
          nota_ejecucion?: string | null
          numero?: never
          org_id: string
          origen: Database["public"]["Enums"]["origen_solicitud"]
          referencia?: string | null
          resolucion?: string | null
          resuelta_en?: string | null
          resuelta_por?: string | null
          revisada_en?: string | null
          revisada_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_solicitud"]
        }
        Update: {
          actualizada_en?: string
          adjunto_path?: string | null
          asignada_a?: string | null
          asignada_en?: string | null
          asunto?: string
          cerrada_en?: string | null
          cliente_id?: string | null
          creada_en?: string
          creada_por?: string | null
          derivada_consejo_en?: string | null
          detalle?: string | null
          ejecutada_en?: string | null
          ejecutada_por?: string | null
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          id?: string
          nota_ejecucion?: string | null
          numero?: never
          org_id?: string
          origen?: Database["public"]["Enums"]["origen_solicitud"]
          referencia?: string | null
          resolucion?: string | null
          resuelta_en?: string | null
          resuelta_por?: string | null
          revisada_en?: string | null
          revisada_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_solicitud"]
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      terminos: {
        Row: {
          contenido: string
          creado_en: string
          creado_por: string | null
          id: string
          org_id: string
          titulo: string
          version: number
          vigente: boolean
        }
        Insert: {
          contenido: string
          creado_en?: string
          creado_por?: string | null
          id?: string
          org_id: string
          titulo?: string
          version: number
          vigente?: boolean
        }
        Update: {
          contenido?: string
          creado_en?: string
          creado_por?: string | null
          id?: string
          org_id?: string
          titulo?: string
          version?: number
          vigente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "terminos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_deuda_clientes: {
        Row: {
          cargos_pendientes: number | null
          cliente_id: string | null
          deuda: number | null
          org_id: string | null
          periodo_mas_viejo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      v_saldo_favor: {
        Row: {
          cliente_id: string | null
          org_id: string | null
          saldo_favor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      abrir_caja: {
        Args: { p_tipo: Database["public"]["Enums"]["tipo_caja"] }
        Returns: string
      }
      anular_pago: {
        Args: { p_motivo: string; p_pago: string }
        Returns: undefined
      }
      aplicar_saldo_favor_cliente: {
        Args: { p_cliente: string }
        Returns: number
      }
      aprobar_cambio: { Args: { p_cambio: string }; Returns: Json }
      avanzar_solicitud: {
        Args: {
          p_accion: string
          p_solicitud: string
          p_texto?: string
          p_usuario?: string
        }
        Returns: Database["public"]["Enums"]["estado_solicitud"]
      }
      cerrar_caja: { Args: { p_caja: string }; Returns: Json }
      flujo_caja: { Args: never; Returns: Json }
      generar_periodo: { Args: { p_periodo: string }; Returns: Json }
      integrar_caja_porteria: {
        Args: { p_caja: string; p_observaciones?: string }
        Returns: Json
      }
      reabrir_caja: {
        Args: { p_caja: string; p_motivo?: string }
        Returns: undefined
      }
      rechazar_cambio: {
        Args: { p_cambio: string; p_motivo: string }
        Returns: undefined
      }
      rechazar_cheque: {
        Args: { p_cheque: string; p_motivo?: string }
        Returns: undefined
      }
      rechazar_reapertura_caja: {
        Args: { p_caja: string; p_motivo?: string }
        Returns: undefined
      }
      registrar_lectura: {
        Args: {
          p_actual: number
          p_anterior: number
          p_medidor: string
          p_periodo: string
        }
        Returns: string
      }
      registrar_pago: {
        Args: {
          p_caja: string
          p_cheque?: Json
          p_cliente: string
          p_medio: Database["public"]["Enums"]["medio_pago"]
          p_monto: number
          p_notas?: string
          p_permitir_saldo_favor?: boolean
          p_transferencia?: Json
        }
        Returns: Json
      }
      resumen_conceptos: {
        Args: { p_periodo: string }
        Returns: {
          cobrado: number
          codigo: string
          descuentos: number
          estimado: number
          nombre: string
          pendiente: number
        }[]
      }
      resumen_gastos: {
        Args: { p_periodo: string }
        Returns: {
          codigo: string
          nombre: string
          pagado: number
          pendiente: number
          tipo: Database["public"]["Enums"]["tipo_gasto"]
        }[]
      }
      solicitar_cambio: {
        Args: {
          p_accion: string
          p_cliente_id?: string
          p_datos: Json
          p_entidad: string
          p_entidad_id: string
          p_resumen: string
        }
        Returns: Json
      }
      solicitar_reapertura_caja: {
        Args: { p_caja: string; p_motivo: string }
        Returns: undefined
      }
      validar_caja: {
        Args: { p_caja: string; p_observaciones?: string }
        Returns: undefined
      }
    }
    Enums: {
      estado_caja: "abierta" | "cerrada" | "integrada" | "validada"
      estado_cambio: "pendiente" | "aprobado" | "rechazado"
      estado_cargo: "pendiente" | "parcial" | "pagado" | "anulado"
      estado_cheque: "en_cartera" | "depositado" | "acreditado" | "rechazado"
      estado_gasto: "pendiente" | "pagado" | "anulado"
      estado_solicitud:
        | "nueva"
        | "en_revision"
        | "en_consejo"
        | "resuelta"
        | "asignada"
        | "ejecutada"
        | "rechazada"
        | "cerrada"
      medio_pago: "efectivo" | "transferencia" | "cheque"
      origen_solicitud: "portal" | "porteria" | "administracion" | "lider"
      rol_usuario:
        | "admin"
        | "guardia"
        | "tesoreria"
        | "consejo"
        | "socio"
        | "lider"
        | "porteria"
      tipo_caja: "administracion" | "guardia"
      tipo_concepto: "recurrente" | "energia" | "canon_diario" | "deuda"
      tipo_contrato:
        | "planta_permanente"
        | "contratado"
        | "eventual"
        | "monotributista"
        | "pasantia"
      tipo_gasto: "fijo" | "variable"
      tipo_mov_tesoreria: "impuesto" | "debito_fiscal" | "comision" | "ajuste"
      tipo_persona: "fisica" | "juridica"
      tipo_sancion: "sancion" | "notificacion" | "apercibimiento"
      tipo_solicitud: "solicitud" | "informe" | "reclamo" | "consulta"
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
      estado_caja: ["abierta", "cerrada", "integrada", "validada"],
      estado_cambio: ["pendiente", "aprobado", "rechazado"],
      estado_cargo: ["pendiente", "parcial", "pagado", "anulado"],
      estado_cheque: ["en_cartera", "depositado", "acreditado", "rechazado"],
      estado_gasto: ["pendiente", "pagado", "anulado"],
      estado_solicitud: [
        "nueva",
        "en_revision",
        "en_consejo",
        "resuelta",
        "asignada",
        "ejecutada",
        "rechazada",
        "cerrada",
      ],
      medio_pago: ["efectivo", "transferencia", "cheque"],
      origen_solicitud: ["portal", "porteria", "administracion", "lider"],
      rol_usuario: [
        "admin",
        "guardia",
        "tesoreria",
        "consejo",
        "socio",
        "lider",
        "porteria",
      ],
      tipo_caja: ["administracion", "guardia"],
      tipo_concepto: ["recurrente", "energia", "canon_diario", "deuda"],
      tipo_contrato: [
        "planta_permanente",
        "contratado",
        "eventual",
        "monotributista",
        "pasantia",
      ],
      tipo_gasto: ["fijo", "variable"],
      tipo_mov_tesoreria: ["impuesto", "debito_fiscal", "comision", "ajuste"],
      tipo_persona: ["fisica", "juridica"],
      tipo_sancion: ["sancion", "notificacion", "apercibimiento"],
      tipo_solicitud: ["solicitud", "informe", "reclamo", "consulta"],
    },
  },
} as const
