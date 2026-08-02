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
      cajas: {
        Row: {
          abierta_en: string
          abierta_por: string | null
          cerrada_en: string | null
          cerrada_por: string | null
          estado: Database["public"]["Enums"]["estado_caja"]
          fecha: string
          id: string
          observaciones: string | null
          org_id: string
          tipo: Database["public"]["Enums"]["tipo_caja"]
          total_canon: number | null
          total_cheques: number | null
          total_efectivo: number | null
          total_gastos: number | null
          total_transferencia: number | null
          validada_en: string | null
          validada_por: string | null
        }
        Insert: {
          abierta_en?: string
          abierta_por?: string | null
          cerrada_en?: string | null
          cerrada_por?: string | null
          estado?: Database["public"]["Enums"]["estado_caja"]
          fecha?: string
          id?: string
          observaciones?: string | null
          org_id: string
          tipo: Database["public"]["Enums"]["tipo_caja"]
          total_canon?: number | null
          total_cheques?: number | null
          total_efectivo?: number | null
          total_gastos?: number | null
          total_transferencia?: number | null
          validada_en?: string | null
          validada_por?: string | null
        }
        Update: {
          abierta_en?: string
          abierta_por?: string | null
          cerrada_en?: string | null
          cerrada_por?: string | null
          estado?: Database["public"]["Enums"]["estado_caja"]
          fecha?: string
          id?: string
          observaciones?: string | null
          org_id?: string
          tipo?: Database["public"]["Enums"]["tipo_caja"]
          total_canon?: number | null
          total_cheques?: number | null
          total_efectivo?: number | null
          total_gastos?: number | null
          total_transferencia?: number | null
          validada_en?: string | null
          validada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cajas_org_id_fkey"
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
          org_id: string
          precio_canon_camion: number
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          dia_vencimiento?: number
          org_id: string
          precio_canon_camion?: number
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          dia_vencimiento?: number
          org_id?: string
          precio_canon_camion?: number
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
      gastos: {
        Row: {
          caja_id: string | null
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
          vencimiento: string | null
        }
        Insert: {
          caja_id?: string | null
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
          vencimiento?: string | null
        }
        Update: {
          caja_id?: string | null
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
          fecha: string
          id: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          motivo_anulacion: string | null
          notas: string | null
          numero: number
          org_id: string
          recibido_por: string | null
        }
        Insert: {
          anulado?: boolean
          anulado_en?: string | null
          anulado_por?: string | null
          caja_id: string
          cheque_id?: string | null
          cliente_id: string
          fecha?: string
          id?: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          motivo_anulacion?: string | null
          notas?: string | null
          numero?: never
          org_id: string
          recibido_por?: string | null
        }
        Update: {
          anulado?: boolean
          anulado_en?: string | null
          anulado_por?: string | null
          caja_id?: string
          cheque_id?: string | null
          cliente_id?: string
          fecha?: string
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"]
          monto?: number
          motivo_anulacion?: string | null
          notas?: string | null
          numero?: never
          org_id?: string
          recibido_por?: string | null
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
      cerrar_caja: { Args: { p_caja: string }; Returns: Json }
      flujo_caja: { Args: never; Returns: Json }
      generar_periodo: { Args: { p_periodo: string }; Returns: Json }
      rechazar_cheque: {
        Args: { p_cheque: string; p_motivo?: string }
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
      validar_caja: {
        Args: { p_caja: string; p_observaciones?: string }
        Returns: undefined
      }
    }
    Enums: {
      estado_caja: "abierta" | "cerrada" | "validada"
      estado_cargo: "pendiente" | "parcial" | "pagado" | "anulado"
      estado_cheque: "en_cartera" | "depositado" | "acreditado" | "rechazado"
      estado_gasto: "pendiente" | "pagado" | "anulado"
      medio_pago: "efectivo" | "transferencia" | "cheque"
      rol_usuario: "admin" | "guardia" | "tesoreria" | "consejo" | "socio"
      tipo_caja: "administracion" | "guardia"
      tipo_concepto: "recurrente" | "energia" | "canon_diario" | "deuda"
      tipo_gasto: "fijo" | "variable"
      tipo_mov_tesoreria: "impuesto" | "comision" | "ajuste"
      tipo_persona: "fisica" | "juridica"
      tipo_sancion: "sancion" | "notificacion"
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
      estado_caja: ["abierta", "cerrada", "validada"],
      estado_cargo: ["pendiente", "parcial", "pagado", "anulado"],
      estado_cheque: ["en_cartera", "depositado", "acreditado", "rechazado"],
      estado_gasto: ["pendiente", "pagado", "anulado"],
      medio_pago: ["efectivo", "transferencia", "cheque"],
      rol_usuario: ["admin", "guardia", "tesoreria", "consejo", "socio"],
      tipo_caja: ["administracion", "guardia"],
      tipo_concepto: ["recurrente", "energia", "canon_diario", "deuda"],
      tipo_gasto: ["fijo", "variable"],
      tipo_mov_tesoreria: ["impuesto", "comision", "ajuste"],
      tipo_persona: ["fisica", "juridica"],
      tipo_sancion: ["sancion", "notificacion"],
    },
  },
} as const
