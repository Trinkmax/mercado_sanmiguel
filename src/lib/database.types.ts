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
            foreignKeyName: "aceptaciones_terminos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
          total_ajustes: number | null
          total_ambulantes: number | null
          total_canon: number | null
          total_cheques: number | null
          total_cheques_entregados: number | null
          total_cobros: number | null
          total_efectivo: number | null
          total_gastos: number | null
          total_quintas: number | null
          total_rendido_ambulantes: number | null
          total_rendido_canon: number | null
          total_rendido_efectivo: number | null
          total_rendido_quintas: number | null
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
          total_ajustes?: number | null
          total_ambulantes?: number | null
          total_canon?: number | null
          total_cheques?: number | null
          total_cheques_entregados?: number | null
          total_cobros?: number | null
          total_efectivo?: number | null
          total_gastos?: number | null
          total_quintas?: number | null
          total_rendido_ambulantes?: number | null
          total_rendido_canon?: number | null
          total_rendido_efectivo?: number | null
          total_rendido_quintas?: number | null
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
          total_ajustes?: number | null
          total_ambulantes?: number | null
          total_canon?: number | null
          total_cheques?: number | null
          total_cheques_entregados?: number | null
          total_cobros?: number | null
          total_efectivo?: number | null
          total_gastos?: number | null
          total_quintas?: number | null
          total_rendido_ambulantes?: number | null
          total_rendido_canon?: number | null
          total_rendido_efectivo?: number | null
          total_rendido_quintas?: number | null
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
          revisar_despues: boolean
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
          revisar_despues?: boolean
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
          revisar_despues?: boolean
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
            foreignKeyName: "cambios_pendientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
          anulado: boolean
          anulado_en: string | null
          anulado_por: string | null
          caja_id: string
          cantidad: number
          conciliado: boolean
          conciliado_en: string | null
          conciliado_por: string | null
          creado_en: string
          creado_por: string | null
          destino: string | null
          destino_detalle: string | null
          espacio_id: string | null
          fecha: string
          id: string
          medio: Database["public"]["Enums"]["medio_pago"]
          monto: number
          motivo_anulacion: string | null
          notas: string | null
          numero: number
          org_id: string
          patente: string | null
          precio_unitario: number | null
          ref: string | null
          tarifa_id: string | null
          tarifa_nombre: string | null
          tipo: string
          unidad: string | null
        }
        Insert: {
          anulado?: boolean
          anulado_en?: string | null
          anulado_por?: string | null
          caja_id: string
          cantidad?: number
          conciliado?: boolean
          conciliado_en?: string | null
          conciliado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          destino?: string | null
          destino_detalle?: string | null
          espacio_id?: string | null
          fecha?: string
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"]
          monto: number
          motivo_anulacion?: string | null
          notas?: string | null
          numero?: never
          org_id: string
          patente?: string | null
          precio_unitario?: number | null
          ref?: string | null
          tarifa_id?: string | null
          tarifa_nombre?: string | null
          tipo?: string
          unidad?: string | null
        }
        Update: {
          anulado?: boolean
          anulado_en?: string | null
          anulado_por?: string | null
          caja_id?: string
          cantidad?: number
          conciliado?: boolean
          conciliado_en?: string | null
          conciliado_por?: string | null
          creado_en?: string
          creado_por?: string | null
          destino?: string | null
          destino_detalle?: string | null
          espacio_id?: string | null
          fecha?: string
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"]
          monto?: number
          motivo_anulacion?: string | null
          notas?: string | null
          numero?: never
          org_id?: string
          patente?: string | null
          precio_unitario?: number | null
          ref?: string | null
          tarifa_id?: string | null
          tarifa_nombre?: string | null
          tipo?: string
          unidad?: string | null
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
            foreignKeyName: "canon_camiones_espacio_id_fkey"
            columns: ["espacio_id"]
            isOneToOne: false
            referencedRelation: "espacios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canon_camiones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canon_camiones_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas_transporte"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          anulado_en: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          cantidad: number
          cliente_id: string
          codigo: string
          concepto_id: string
          creado_en: string
          creado_por: string | null
          descripcion: string
          descuento_aplicado: number
          descuento_pronto_pago: number
          desde: string | null
          estado: Database["public"]["Enums"]["estado_cargo"]
          hasta: string | null
          id: string
          lote_id: string | null
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
          anulado_en?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          cantidad?: number
          cliente_id: string
          codigo: string
          concepto_id: string
          creado_en?: string
          creado_por?: string | null
          descripcion: string
          descuento_aplicado?: number
          descuento_pronto_pago?: number
          desde?: string | null
          estado?: Database["public"]["Enums"]["estado_cargo"]
          hasta?: string | null
          id?: string
          lote_id?: string | null
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
          anulado_en?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          cantidad?: number
          cliente_id?: string
          codigo?: string
          concepto_id?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string
          descuento_aplicado?: number
          descuento_pronto_pago?: number
          desde?: string | null
          estado?: Database["public"]["Enums"]["estado_cargo"]
          hasta?: string | null
          id?: string
          lote_id?: string | null
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
            foreignKeyName: "cargos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
          cuit: string | null
          entregado_en_cobro: boolean
          entregado_por: string | null
          es_tercero: boolean
          estado: Database["public"]["Enums"]["estado_cheque"]
          fecha_acreditado: string | null
          fecha_cobro: string
          fecha_depositado: string | null
          fecha_entregado: string | null
          fecha_recibido: string
          gasto_diferencia: string | null
          gasto_id: string | null
          id: string
          monto: number
          motivo_rechazo: string | null
          notas: string | null
          numero: string
          org_id: string
          proveedor: string | null
          puesto: string | null
          rechazado_en: string | null
          rechazado_por: string | null
          recibido_de: string | null
          titular: string | null
          vuelto_movimiento_id: string | null
        }
        Insert: {
          banco?: string | null
          cliente_id?: string | null
          creado_en?: string
          creado_por?: string | null
          cuit?: string | null
          entregado_en_cobro?: boolean
          entregado_por?: string | null
          es_tercero?: boolean
          estado?: Database["public"]["Enums"]["estado_cheque"]
          fecha_acreditado?: string | null
          fecha_cobro?: string
          fecha_depositado?: string | null
          fecha_entregado?: string | null
          fecha_recibido?: string
          gasto_diferencia?: string | null
          gasto_id?: string | null
          id?: string
          monto: number
          motivo_rechazo?: string | null
          notas?: string | null
          numero: string
          org_id: string
          proveedor?: string | null
          puesto?: string | null
          rechazado_en?: string | null
          rechazado_por?: string | null
          recibido_de?: string | null
          titular?: string | null
          vuelto_movimiento_id?: string | null
        }
        Update: {
          banco?: string | null
          cliente_id?: string | null
          creado_en?: string
          creado_por?: string | null
          cuit?: string | null
          entregado_en_cobro?: boolean
          entregado_por?: string | null
          es_tercero?: boolean
          estado?: Database["public"]["Enums"]["estado_cheque"]
          fecha_acreditado?: string | null
          fecha_cobro?: string
          fecha_depositado?: string | null
          fecha_entregado?: string | null
          fecha_recibido?: string
          gasto_diferencia?: string | null
          gasto_id?: string | null
          id?: string
          monto?: number
          motivo_rechazo?: string | null
          notas?: string | null
          numero?: string
          org_id?: string
          proveedor?: string | null
          puesto?: string | null
          rechazado_en?: string | null
          rechazado_por?: string | null
          recibido_de?: string | null
          titular?: string | null
          vuelto_movimiento_id?: string | null
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
            foreignKeyName: "cheques_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cheques_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: false
            referencedRelation: "gastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_vuelto_movimiento_id_fkey"
            columns: ["vuelto_movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos_tesoreria"
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
            foreignKeyName: "circular_recepciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
          publico: string[] | null
          ref: string | null
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
          publico?: string[] | null
          ref?: string | null
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
          publico?: string[] | null
          ref?: string | null
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
            foreignKeyName: "cliente_conceptos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
          categoria: Database["public"]["Enums"]["categoria_cliente"]
          codigo: number
          creado_en: string
          cuit: string | null
          cuotas_mes: number
          direccion: string | null
          email: string | null
          es_socio: boolean
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
          categoria?: Database["public"]["Enums"]["categoria_cliente"]
          codigo: number
          creado_en?: string
          cuit?: string | null
          cuotas_mes?: number
          direccion?: string | null
          email?: string | null
          es_socio?: boolean
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
          categoria?: Database["public"]["Enums"]["categoria_cliente"]
          codigo?: number
          creado_en?: string
          cuit?: string | null
          cuotas_mes?: number
          direccion?: string | null
          email?: string | null
          es_socio?: boolean
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
          segmento: string | null
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
          segmento?: string | null
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
          segmento?: string | null
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
          cuotas_default_quintero: number
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
          cuotas_default_quintero?: number
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
          cuotas_default_quintero?: number
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
            foreignKeyName: "documentos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
      empleado_bajas: {
        Row: {
          creada_en: string
          creada_por: string | null
          desde: string
          empleado_id: string
          hasta: string
          id: string
          org_id: string
        }
        Insert: {
          creada_en?: string
          creada_por?: string | null
          desde: string
          empleado_id: string
          hasta: string
          id?: string
          org_id: string
        }
        Update: {
          creada_en?: string
          creada_por?: string | null
          desde?: string
          empleado_id?: string
          hasta?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_bajas_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_bajas_org_id_fkey"
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
          horas_semanales: number | null
          id: string
          nombre: string
          observaciones: string | null
          org_id: string
          sector: Database["public"]["Enums"]["sector_personal"]
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
          horas_semanales?: number | null
          id?: string
          nombre: string
          observaciones?: string | null
          org_id: string
          sector?: Database["public"]["Enums"]["sector_personal"]
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
          horas_semanales?: number | null
          id?: string
          nombre?: string
          observaciones?: string | null
          org_id?: string
          sector?: Database["public"]["Enums"]["sector_personal"]
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
      espacios: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          asignado_en: string | null
          cliente_id: string | null
          grupo: string | null
          h: number
          id: string
          medio: boolean
          nota: string | null
          numero: string | null
          org_id: string
          propio: boolean
          tipo: string
          w: number
          x: number
          y: number
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          asignado_en?: string | null
          cliente_id?: string | null
          grupo?: string | null
          h: number
          id?: string
          medio?: boolean
          nota?: string | null
          numero?: string | null
          org_id: string
          propio?: boolean
          tipo: string
          w: number
          x: number
          y: number
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          asignado_en?: string | null
          cliente_id?: string | null
          grupo?: string | null
          h?: number
          id?: string
          medio?: boolean
          nota?: string | null
          numero?: string | null
          org_id?: string
          propio?: boolean
          tipo?: string
          w?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "espacios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espacios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "espacios_org_id_fkey"
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
          descripcion: string | null
          estado: Database["public"]["Enums"]["estado_gasto"]
          factura_path: string | null
          fecha_pago: string | null
          id: string
          medio_pago: Database["public"]["Enums"]["medio_pago"] | null
          monto: number
          notas: string | null
          org_id: string
          origen_id: string | null
          pagado_desde: string | null
          pagado_en: string | null
          pagado_por: string | null
          pago_revertido_en: string | null
          pago_revertido_motivo: string | null
          pago_revertido_por: string | null
          periodo: string
          ref: string | null
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
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_gasto"]
          factura_path?: string | null
          fecha_pago?: string | null
          id?: string
          medio_pago?: Database["public"]["Enums"]["medio_pago"] | null
          monto: number
          notas?: string | null
          org_id: string
          origen_id?: string | null
          pagado_desde?: string | null
          pagado_en?: string | null
          pagado_por?: string | null
          pago_revertido_en?: string | null
          pago_revertido_motivo?: string | null
          pago_revertido_por?: string | null
          periodo?: string
          ref?: string | null
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
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_gasto"]
          factura_path?: string | null
          fecha_pago?: string | null
          id?: string
          medio_pago?: Database["public"]["Enums"]["medio_pago"] | null
          monto?: number
          notas?: string | null
          org_id?: string
          origen_id?: string | null
          pagado_desde?: string | null
          pagado_en?: string | null
          pagado_por?: string | null
          pago_revertido_en?: string | null
          pago_revertido_motivo?: string | null
          pago_revertido_por?: string | null
          periodo?: string
          ref?: string | null
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
            foreignKeyName: "gastos_origen_id_fkey"
            columns: ["origen_id"]
            isOneToOne: false
            referencedRelation: "gastos"
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
          creado_en: string | null
          id: string
          monto: number
          org_id: string
          origen: string
          pago_id: string
        }
        Insert: {
          cargo_id: string
          creado_en?: string | null
          id?: string
          monto: number
          org_id: string
          origen?: string
          pago_id: string
        }
        Update: {
          cargo_id?: string
          creado_en?: string | null
          id?: string
          monto?: number
          org_id?: string
          origen?: string
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
      medidores: {
        Row: {
          activo: boolean
          cliente_id: string
          espacio_id: string | null
          id: string
          numero: string
          org_id: string
          ubicacion: string | null
        }
        Insert: {
          activo?: boolean
          cliente_id: string
          espacio_id?: string | null
          id?: string
          numero: string
          org_id: string
          ubicacion?: string | null
        }
        Update: {
          activo?: boolean
          cliente_id?: string
          espacio_id?: string | null
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
            foreignKeyName: "medidores_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "medidores_espacio_id_fkey"
            columns: ["espacio_id"]
            isOneToOne: false
            referencedRelation: "espacios"
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
          anulado_en: string | null
          anulado_por: string | null
          caja_id: string | null
          creado_en: string
          creado_por: string | null
          cuenta: Database["public"]["Enums"]["cuenta_tesoreria"]
          cuenta_destino: Database["public"]["Enums"]["cuenta_tesoreria"] | null
          descripcion: string | null
          fecha: string
          grupo_id: string | null
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          motivo_anulacion: string | null
          org_id: string
          ref: string | null
          tipo: Database["public"]["Enums"]["tipo_mov_tesoreria"]
        }
        Insert: {
          anulado_en?: string | null
          anulado_por?: string | null
          caja_id?: string | null
          creado_en?: string
          creado_por?: string | null
          cuenta?: Database["public"]["Enums"]["cuenta_tesoreria"]
          cuenta_destino?:
            | Database["public"]["Enums"]["cuenta_tesoreria"]
            | null
          descripcion?: string | null
          fecha?: string
          grupo_id?: string | null
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto: number
          motivo_anulacion?: string | null
          org_id: string
          ref?: string | null
          tipo: Database["public"]["Enums"]["tipo_mov_tesoreria"]
        }
        Update: {
          anulado_en?: string | null
          anulado_por?: string | null
          caja_id?: string | null
          creado_en?: string
          creado_por?: string | null
          cuenta?: Database["public"]["Enums"]["cuenta_tesoreria"]
          cuenta_destino?:
            | Database["public"]["Enums"]["cuenta_tesoreria"]
            | null
          descripcion?: string | null
          fecha?: string
          grupo_id?: string | null
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          motivo_anulacion?: string | null
          org_id?: string
          ref?: string | null
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
      novedades_personal: {
        Row: {
          actualizada_en: string
          adjunto_path: string | null
          anulada_en: string | null
          anulada_por: string | null
          cargada_en: string
          cargada_por: string | null
          detalle: string | null
          empleado_id: string
          estado: Database["public"]["Enums"]["estado_novedad"]
          fecha_desde: string
          fecha_hasta: string | null
          horas: number | null
          id: string
          justificada: boolean | null
          lote: string | null
          motivo_anulacion: string | null
          motivo_rechazo: string | null
          org_id: string
          rechazo_visto_en: string | null
          revisada_en: string | null
          revisada_por: string | null
          sector: Database["public"]["Enums"]["sector_personal"]
          tipo: Database["public"]["Enums"]["tipo_novedad"]
        }
        Insert: {
          actualizada_en?: string
          adjunto_path?: string | null
          anulada_en?: string | null
          anulada_por?: string | null
          cargada_en?: string
          cargada_por?: string | null
          detalle?: string | null
          empleado_id: string
          estado?: Database["public"]["Enums"]["estado_novedad"]
          fecha_desde: string
          fecha_hasta?: string | null
          horas?: number | null
          id?: string
          justificada?: boolean | null
          lote?: string | null
          motivo_anulacion?: string | null
          motivo_rechazo?: string | null
          org_id: string
          rechazo_visto_en?: string | null
          revisada_en?: string | null
          revisada_por?: string | null
          sector: Database["public"]["Enums"]["sector_personal"]
          tipo: Database["public"]["Enums"]["tipo_novedad"]
        }
        Update: {
          actualizada_en?: string
          adjunto_path?: string | null
          anulada_en?: string | null
          anulada_por?: string | null
          cargada_en?: string
          cargada_por?: string | null
          detalle?: string | null
          empleado_id?: string
          estado?: Database["public"]["Enums"]["estado_novedad"]
          fecha_desde?: string
          fecha_hasta?: string | null
          horas?: number | null
          id?: string
          justificada?: boolean | null
          lote?: string | null
          motivo_anulacion?: string | null
          motivo_rechazo?: string | null
          org_id?: string
          rechazo_visto_en?: string | null
          revisada_en?: string | null
          revisada_por?: string | null
          sector?: Database["public"]["Enums"]["sector_personal"]
          tipo?: Database["public"]["Enums"]["tipo_novedad"]
        }
        Relationships: [
          {
            foreignKeyName: "novedades_personal_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "novedades_personal_org_id_fkey"
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
          linea: number
          lote_id: string
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
          linea?: number
          lote_id?: string
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
          linea?: number
          lote_id?: string
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
            foreignKeyName: "pagos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
          creado_por: string | null
          desactivado_en: string | null
          desactivado_por: string | null
          dni: string | null
          nombre: string
          org_id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          superadmin: boolean
          user_id: string
          vista_cliente_id: string | null
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          creado_por?: string | null
          desactivado_en?: string | null
          desactivado_por?: string | null
          dni?: string | null
          nombre: string
          org_id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          superadmin?: boolean
          user_id: string
          vista_cliente_id?: string | null
        }
        Update: {
          activo?: boolean
          creado_en?: string
          creado_por?: string | null
          desactivado_en?: string | null
          desactivado_por?: string | null
          dni?: string | null
          nombre?: string
          org_id?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          superadmin?: boolean
          user_id?: string
          vista_cliente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_vista_cliente_id_fkey"
            columns: ["vista_cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_vista_cliente_id_fkey"
            columns: ["vista_cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      perfiles_eventos: {
        Row: {
          accion: string
          detalle: string | null
          hecho_en: string
          hecho_por: string | null
          id: string
          org_id: string
          user_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          accion: string
          detalle?: string | null
          hecho_en?: string
          hecho_por?: string | null
          id?: string
          org_id: string
          user_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          accion?: string
          detalle?: string | null
          hecho_en?: string
          hecho_por?: string | null
          id?: string
          org_id?: string
          user_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_eventos_org_id_fkey"
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
      plano_elementos: {
        Row: {
          capacidad: number | null
          etiqueta: string | null
          h: number
          id: string
          orden: number
          org_id: string
          tipo: string
          w: number
          x: number
          y: number
        }
        Insert: {
          capacidad?: number | null
          etiqueta?: string | null
          h: number
          id?: string
          orden?: number
          org_id: string
          tipo: string
          w: number
          x: number
          y: number
        }
        Update: {
          capacidad?: number | null
          etiqueta?: string | null
          h?: number
          id?: string
          orden?: number
          org_id?: string
          tipo?: string
          w?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "plano_elementos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      registro_mensajes: {
        Row: {
          adjunto_path: string | null
          autor_id: string | null
          autor_nombre: string
          autor_rol: Database["public"]["Enums"]["rol_usuario"]
          creado_en: string
          es_descargo: boolean
          id: string
          mensaje: string
          org_id: string
          ref: string | null
          registro_id: string
        }
        Insert: {
          adjunto_path?: string | null
          autor_id?: string | null
          autor_nombre?: string
          autor_rol: Database["public"]["Enums"]["rol_usuario"]
          creado_en?: string
          es_descargo?: boolean
          id?: string
          mensaje: string
          org_id: string
          ref?: string | null
          registro_id: string
        }
        Update: {
          adjunto_path?: string | null
          autor_id?: string | null
          autor_nombre?: string
          autor_rol?: Database["public"]["Enums"]["rol_usuario"]
          creado_en?: string
          es_descargo?: boolean
          id?: string
          mensaje?: string
          org_id?: string
          ref?: string | null
          registro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registro_mensajes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_mensajes_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "sanciones"
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
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number
          notas: string | null
          org_id: string
        }
        Insert: {
          fecha?: string
          id?: string
          medio: Database["public"]["Enums"]["medio_pago"]
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number
          notas?: string | null
          org_id: string
        }
        Update: {
          fecha?: string
          id?: string
          medio?: Database["public"]["Enums"]["medio_pago"]
          moneda?: Database["public"]["Enums"]["moneda"]
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
          cargo_id: string | null
          cliente_id: string
          creado_en: string
          creado_por: string | null
          detalle: string | null
          espacio_id: string | null
          estado: Database["public"]["Enums"]["estado_registro"]
          fecha: string
          id: string
          multa: number | null
          multa_sin_efecto_en: string | null
          multa_sin_efecto_motivo: string | null
          multa_sin_efecto_por: string | null
          multa_vencimiento: string | null
          numero: number
          org_id: string
          ref: string | null
          socio_leyo_en: string | null
          storage_path: string | null
          tipo: Database["public"]["Enums"]["tipo_sancion"]
          titulo: string
          ultimo_mensaje_en: string | null
          visto_en: string | null
        }
        Insert: {
          cargo_id?: string | null
          cliente_id: string
          creado_en?: string
          creado_por?: string | null
          detalle?: string | null
          espacio_id?: string | null
          estado?: Database["public"]["Enums"]["estado_registro"]
          fecha?: string
          id?: string
          multa?: number | null
          multa_sin_efecto_en?: string | null
          multa_sin_efecto_motivo?: string | null
          multa_sin_efecto_por?: string | null
          multa_vencimiento?: string | null
          numero?: never
          org_id: string
          ref?: string | null
          socio_leyo_en?: string | null
          storage_path?: string | null
          tipo?: Database["public"]["Enums"]["tipo_sancion"]
          titulo: string
          ultimo_mensaje_en?: string | null
          visto_en?: string | null
        }
        Update: {
          cargo_id?: string | null
          cliente_id?: string
          creado_en?: string
          creado_por?: string | null
          detalle?: string | null
          espacio_id?: string | null
          estado?: Database["public"]["Enums"]["estado_registro"]
          fecha?: string
          id?: string
          multa?: number | null
          multa_sin_efecto_en?: string | null
          multa_sin_efecto_motivo?: string | null
          multa_sin_efecto_por?: string | null
          multa_vencimiento?: string | null
          numero?: never
          org_id?: string
          ref?: string | null
          socio_leyo_en?: string | null
          storage_path?: string | null
          tipo?: Database["public"]["Enums"]["tipo_sancion"]
          titulo?: string
          ultimo_mensaje_en?: string | null
          visto_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sanciones_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "sanciones_espacio_id_fkey"
            columns: ["espacio_id"]
            isOneToOne: false
            referencedRelation: "espacios"
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
          ref: string | null
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
          ref?: string | null
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
          ref?: string | null
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
          elevada_en: string | null
          elevada_por: string | null
          espacio_id: string | null
          estado: Database["public"]["Enums"]["estado_solicitud"]
          id: string
          nota_ejecucion: string | null
          numero: number
          org_id: string
          origen: Database["public"]["Enums"]["origen_solicitud"]
          ref: string | null
          referencia: string | null
          resolucion: string | null
          resolucion_de: string | null
          resuelta_en: string | null
          resuelta_por: string | null
          revisada_en: string | null
          revisada_por: string | null
          solicitante_visto_en: string | null
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
          elevada_en?: string | null
          elevada_por?: string | null
          espacio_id?: string | null
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          id?: string
          nota_ejecucion?: string | null
          numero?: never
          org_id: string
          origen: Database["public"]["Enums"]["origen_solicitud"]
          ref?: string | null
          referencia?: string | null
          resolucion?: string | null
          resolucion_de?: string | null
          resuelta_en?: string | null
          resuelta_por?: string | null
          revisada_en?: string | null
          revisada_por?: string | null
          solicitante_visto_en?: string | null
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
          elevada_en?: string | null
          elevada_por?: string | null
          espacio_id?: string | null
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          id?: string
          nota_ejecucion?: string | null
          numero?: never
          org_id?: string
          origen?: Database["public"]["Enums"]["origen_solicitud"]
          ref?: string | null
          referencia?: string | null
          resolucion?: string | null
          resolucion_de?: string | null
          resuelta_en?: string | null
          resuelta_por?: string | null
          revisada_en?: string | null
          revisada_por?: string | null
          solicitante_visto_en?: string | null
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
            foreignKeyName: "solicitudes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "solicitudes_espacio_id_fkey"
            columns: ["espacio_id"]
            isOneToOne: false
            referencedRelation: "espacios"
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
      tarifas_transporte: {
        Row: {
          activo: boolean
          actualizado_en: string
          actualizado_por: string | null
          creado_en: string
          icono: string
          id: string
          nombre: string
          orden: number
          org_id: string
          precio: number
          unidad: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          icono?: string
          id?: string
          nombre: string
          orden?: number
          org_id: string
          precio: number
          unidad?: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          actualizado_por?: string | null
          creado_en?: string
          icono?: string
          id?: string
          nombre?: string
          orden?: number
          org_id?: string
          precio?: number
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_transporte_org_id_fkey"
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
      tesoreria_eventos: {
        Row: {
          cheque_id: string | null
          detalle: string
          gasto_id: string | null
          hecho_en: string
          hecho_por: string | null
          id: string
          moneda: Database["public"]["Enums"]["moneda"]
          monto: number | null
          motivo: string | null
          movimiento_id: string | null
          org_id: string
          tipo: string
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          cheque_id?: string | null
          detalle: string
          gasto_id?: string | null
          hecho_en?: string
          hecho_por?: string | null
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number | null
          motivo?: string | null
          movimiento_id?: string | null
          org_id: string
          tipo: string
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          cheque_id?: string | null
          detalle?: string
          gasto_id?: string | null
          hecho_en?: string
          hecho_por?: string | null
          id?: string
          moneda?: Database["public"]["Enums"]["moneda"]
          monto?: number | null
          motivo?: string | null
          movimiento_id?: string | null
          org_id?: string
          tipo?: string
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tesoreria_eventos_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tesoreria_eventos_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: false
            referencedRelation: "gastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tesoreria_eventos_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos_tesoreria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tesoreria_eventos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_avance_mes: {
        Row: {
          cliente_id: string | null
          cuota_sugerida: number | null
          cuotas: number | null
          cuotas_cubiertas: number | null
          falta: number | null
          org_id: string | null
          pagado: number | null
          periodo: string | null
          total: number | null
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
            foreignKeyName: "cargos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
      v_clientes_segmentos: {
        Row: {
          activo: boolean | null
          apodo: string | null
          categoria: Database["public"]["Enums"]["categoria_cliente"] | null
          cliente_id: string | null
          codigo: number | null
          es_socio: boolean | null
          nombre: string | null
          org_id: string | null
          segmentos: string[] | null
          tiene_portal: boolean | null
        }
        Insert: {
          activo?: boolean | null
          apodo?: string | null
          categoria?: Database["public"]["Enums"]["categoria_cliente"] | null
          cliente_id?: string | null
          codigo?: number | null
          es_socio?: boolean | null
          nombre?: string | null
          org_id?: string | null
          segmentos?: never
          tiene_portal?: never
        }
        Update: {
          activo?: boolean | null
          apodo?: string | null
          categoria?: Database["public"]["Enums"]["categoria_cliente"] | null
          cliente_id?: string | null
          codigo?: number | null
          es_socio?: boolean | null
          nombre?: string | null
          org_id?: string | null
          segmentos?: never
          tiene_portal?: never
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
      v_deuda_clientes: {
        Row: {
          cargos_pendientes: number | null
          cliente_id: string | null
          deuda: number | null
          deuda_vencida: number | null
          org_id: string | null
          periodo_mas_viejo: string | null
          proximo_vencimiento: string | null
          vencido_desde: string | null
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
            foreignKeyName: "cargos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
            foreignKeyName: "pagos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
      v_ultimo_pago_ambulante: {
        Row: {
          cliente_id: string | null
          org_id: string | null
          pago_hasta: string | null
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
            foreignKeyName: "cargos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_segmentos"
            referencedColumns: ["cliente_id"]
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
      anular_canon: {
        Args: { p_canon: string; p_motivo: string }
        Returns: undefined
      }
      anular_cargo_manual: {
        Args: { p_cargo: string; p_motivo: string }
        Returns: Json
      }
      anular_movimiento_tesoreria: {
        Args: { p_id: string; p_motivo: string }
        Returns: Json
      }
      anular_novedad: {
        Args: { p_motivo: string; p_novedad: string }
        Returns: undefined
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
      aprobar_novedades: { Args: { p_ids: string[] }; Returns: number }
      arqueo_caja: { Args: { p_caja: string }; Returns: Json }
      asignar_espacios: {
        Args: { p_actual?: string; p_cliente?: string; p_espacios: string[] }
        Returns: number
      }
      autorizar_gestion_usuario: {
        Args: { p_accion: string; p_user: string }
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      avanzar_solicitud: {
        Args: {
          p_accion: string
          p_solicitud: string
          p_texto?: string
          p_usuario?: string
        }
        Returns: Database["public"]["Enums"]["estado_solicitud"]
      }
      borrar_ajuste_caja: {
        Args: { p_ajuste: string; p_motivo: string }
        Returns: undefined
      }
      cambiar_vista_superadmin: {
        Args: {
          p_cliente?: string
          p_rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Returns: Json
      }
      cerrar_caja: { Args: { p_caja: string }; Returns: Json }
      clientes_para_vista: {
        Args: { p_buscar?: string }
        Returns: {
          activo: boolean
          apodo: string
          categoria: Database["public"]["Enums"]["categoria_cliente"]
          codigo: number
          id: string
          nombre: string
        }[]
      }
      cobranza_diaria: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          fecha: string
          monto: number
        }[]
      }
      cobrar_diario: {
        Args: {
          p_caja: string
          p_cliente: string
          p_desde?: string
          p_dias: number
          p_lineas: Json
          p_lote?: string
          p_notas?: string
        }
        Returns: Json
      }
      conciliar_canon: { Args: { p_ids: string[] }; Returns: Json }
      datos_recibo: { Args: { p_pago: string }; Returns: Json }
      dejar_sin_efecto_multa: {
        Args: { p_motivo: string; p_registro: string }
        Returns: undefined
      }
      desconciliar_canon: { Args: { p_id: string }; Returns: undefined }
      deshacer_acreditacion_cheque: {
        Args: { p_cheque: string; p_motivo: string }
        Returns: Json
      }
      deshacer_deposito_cheque: {
        Args: { p_cheque: string; p_motivo: string }
        Returns: Json
      }
      desvincular_cheque_gasto: {
        Args: { p_cheque: string; p_motivo: string }
        Returns: Json
      }
      devolver_cheque_a_cartera: {
        Args: { p_cheque: string; p_motivo: string }
        Returns: Json
      }
      editar_espacio: {
        Args: {
          p_espacio: string
          p_medio: boolean
          p_nota: string
          p_numero: string
          p_propio?: boolean
        }
        Returns: undefined
      }
      email_para_login: { Args: { p_dni: string }; Returns: string }
      emitir_registro: {
        Args: {
          p_cliente: string
          p_detalle?: string
          p_espacio?: string
          p_fecha?: string
          p_multa?: number
          p_multa_vencimiento?: string
          p_ref?: string
          p_storage_path?: string
          p_tipo: Database["public"]["Enums"]["tipo_sancion"]
          p_titulo: string
        }
        Returns: Json
      }
      entregar_cheque: {
        Args: {
          p_cheque: string
          p_diferencia?: string
          p_fecha?: string
          p_gasto?: string
          p_proveedor: string
        }
        Returns: Json
      }
      espacios_del_plano: {
        Args: never
        Returns: {
          grupo: string
          h: number
          id: string
          medio: boolean
          numero: string
          propio: boolean
          tipo: string
          w: number
          x: number
          y: number
        }[]
      }
      estado_caja_porteria: { Args: never; Returns: Json }
      flujo_caja: { Args: never; Returns: Json }
      generar_periodo: { Args: { p_periodo: string }; Returns: Json }
      guardar_cuotas_quinteros: {
        Args: { p_cuotas: number }
        Returns: undefined
      }
      guardar_saldo_inicial: {
        Args: {
          p_fecha: string
          p_medio: Database["public"]["Enums"]["medio_pago"]
          p_moneda: Database["public"]["Enums"]["moneda"]
          p_monto: number
          p_motivo?: string
          p_notas?: string
        }
        Returns: Json
      }
      integrar_caja_porteria: {
        Args: {
          p_caja: string
          p_efectivo_recibido?: number
          p_observaciones?: string
        }
        Returns: Json
      }
      lugares_del_cliente: {
        Args: { p_cliente: string }
        Returns: {
          id: string
          medio: boolean
          numero: string
          propio: boolean
          tipo: string
        }[]
      }
      marcar_registro_visto: {
        Args: { p_registro: string }
        Returns: undefined
      }
      marcar_solicitud_vista: {
        Args: { p_solicitud: string }
        Returns: boolean
      }
      ocultar_rechazo_novedad: { Args: { p_novedad: string }; Returns: boolean }
      pagar_gasto: {
        Args: {
          p_caja?: string
          p_fecha?: string
          p_gasto: string
          p_medio?: Database["public"]["Enums"]["medio_pago"]
          p_origen: string
        }
        Returns: Json
      }
      quintas_del_plano: {
        Args: never
        Returns: {
          cliente_id: string
          espacio_id: string
        }[]
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
      registrar_ajuste_caja: {
        Args: {
          p_caja: string
          p_cuenta: Database["public"]["Enums"]["cuenta_tesoreria"]
          p_monto: number
          p_motivo: string
          p_ref?: string
        }
        Returns: string
      }
      registrar_canon: {
        Args: {
          p_cantidad?: number
          p_destino?: string
          p_destino_detalle?: string
          p_medio?: Database["public"]["Enums"]["medio_pago"]
          p_notas?: string
          p_patente?: string
          p_ref?: string
          p_tarifa: string
        }
        Returns: Json
      }
      registrar_cobro: {
        Args: {
          p_caja: string
          p_cliente: string
          p_lineas: Json
          p_lote?: string
          p_notas?: string
          p_permitir_saldo_favor?: boolean
        }
        Returns: Json
      }
      registrar_contrasena_nueva: {
        Args: { p_user: string }
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
      registrar_movimiento_tesoreria: {
        Args: {
          p_comision?: number
          p_cuenta: Database["public"]["Enums"]["cuenta_tesoreria"]
          p_descripcion?: string
          p_fecha: string
          p_moneda: Database["public"]["Enums"]["moneda"]
          p_monto: number
          p_ref?: string
          p_tipo: Database["public"]["Enums"]["tipo_mov_tesoreria"]
        }
        Returns: Json
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
      reincorporar_empleado: {
        Args: { p_desde?: string; p_empleado: string }
        Returns: undefined
      }
      replicar_gastos_fijos: {
        Args: {
          p_desde_periodo: string
          p_hasta_periodo: string
          p_items: Json
        }
        Returns: Json
      }
      resumen_canon: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          cantidad: number
          efectivo: number
          entradas: number
          monto: number
          tarifa: string
          transferencia: number
          unidad: string
        }[]
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
      resumen_novedades: {
        Args: { p_periodo: string }
        Returns: {
          activo: boolean
          apellido: string
          dias_licencia: number
          dias_vacaciones: number
          dni: string
          empleado_id: string
          faltas: number
          faltas_injustificadas: number
          feriados_trabajados: number
          horas_esperadas: number
          horas_extra: number
          horas_feriado: number
          horas_registradas: number
          horas_semanales: number
          horas_tarde: number
          ingresos: number
          ingresos_sin_salida: number
          llegadas_tarde: number
          nombre: string
          otras: number
          pendientes: number
          sector: Database["public"]["Enums"]["sector_personal"]
        }[]
      }
      revertir_pago_gasto: {
        Args: { p_gasto: string; p_motivo: string }
        Returns: undefined
      }
      revisar_novedad: {
        Args: { p_aprobar: boolean; p_motivo?: string; p_novedad: string }
        Returns: Database["public"]["Enums"]["estado_novedad"]
      }
      siguiente_codigo_cliente: { Args: never; Returns: number }
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
      solicitudes_con_respuesta: { Args: never; Returns: string[] }
      sumar_abonos_energia: { Args: { p_periodo: string }; Returns: Json }
      ultimas_lecturas: {
        Args: { p_antes: string }
        Returns: {
          fecha_lectura: string
          lectura_actual: number
          medidor_id: string
          periodo: string
        }[]
      }
      validar_caja: {
        Args: {
          p_caja: string
          p_efectivo_contado?: number
          p_observaciones?: string
        }
        Returns: undefined
      }
      vincular_cheque_gasto: {
        Args: { p_cheque: string; p_diferencia?: string; p_gasto: string }
        Returns: Json
      }
    }
    Enums: {
      categoria_cliente: "puestero" | "quintero" | "ambulante"
      cuenta_tesoreria: "efectivo" | "banco"
      estado_caja: "abierta" | "cerrada" | "integrada" | "validada"
      estado_cambio: "pendiente" | "aprobado" | "rechazado"
      estado_cargo: "pendiente" | "parcial" | "pagado" | "anulado"
      estado_cheque:
        | "en_cartera"
        | "entregado"
        | "depositado"
        | "acreditado"
        | "rechazado"
      estado_gasto: "pendiente" | "pagado" | "anulado"
      estado_novedad: "pendiente" | "aprobada" | "rechazada" | "anulada"
      estado_registro: "notificado" | "descargo" | "respondido"
      estado_solicitud:
        | "con_jefe"
        | "nueva"
        | "en_revision"
        | "en_consejo"
        | "resuelta"
        | "asignada"
        | "ejecutada"
        | "rechazada"
        | "cerrada"
      medio_pago: "efectivo" | "transferencia" | "cheque"
      moneda: "ARS" | "USD"
      origen_solicitud:
        | "portal"
        | "porteria"
        | "administracion"
        | "lider"
        | "tesoreria"
      rol_usuario:
        | "admin"
        | "guardia"
        | "tesoreria"
        | "consejo"
        | "socio"
        | "lider"
        | "porteria"
      sector_personal:
        | "porteria"
        | "limpieza"
        | "mantenimiento"
        | "administracion"
        | "otro"
      tipo_caja: "administracion" | "guardia"
      tipo_concepto:
        | "recurrente"
        | "energia"
        | "canon_diario"
        | "deuda"
        | "diario"
        | "abono_energia"
        | "eventual"
      tipo_contrato:
        | "planta_permanente"
        | "contratado"
        | "eventual"
        | "monotributista"
        | "pasantia"
      tipo_gasto: "fijo" | "variable"
      tipo_mov_tesoreria:
        | "impuesto"
        | "debito_fiscal"
        | "comision"
        | "ajuste"
        | "deposito"
        | "extraccion"
        | "ingreso"
        | "egreso"
      tipo_novedad:
        | "falta"
        | "llegada_tarde"
        | "feriado_trabajado"
        | "vacaciones"
        | "licencia"
        | "horas_extra"
        | "otra"
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
  public: {
    Enums: {
      categoria_cliente: ["puestero", "quintero", "ambulante"],
      cuenta_tesoreria: ["efectivo", "banco"],
      estado_caja: ["abierta", "cerrada", "integrada", "validada"],
      estado_cambio: ["pendiente", "aprobado", "rechazado"],
      estado_cargo: ["pendiente", "parcial", "pagado", "anulado"],
      estado_cheque: [
        "en_cartera",
        "entregado",
        "depositado",
        "acreditado",
        "rechazado",
      ],
      estado_gasto: ["pendiente", "pagado", "anulado"],
      estado_novedad: ["pendiente", "aprobada", "rechazada", "anulada"],
      estado_registro: ["notificado", "descargo", "respondido"],
      estado_solicitud: [
        "con_jefe",
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
      moneda: ["ARS", "USD"],
      origen_solicitud: [
        "portal",
        "porteria",
        "administracion",
        "lider",
        "tesoreria",
      ],
      rol_usuario: [
        "admin",
        "guardia",
        "tesoreria",
        "consejo",
        "socio",
        "lider",
        "porteria",
      ],
      sector_personal: [
        "porteria",
        "limpieza",
        "mantenimiento",
        "administracion",
        "otro",
      ],
      tipo_caja: ["administracion", "guardia"],
      tipo_concepto: [
        "recurrente",
        "energia",
        "canon_diario",
        "deuda",
        "diario",
        "abono_energia",
        "eventual",
      ],
      tipo_contrato: [
        "planta_permanente",
        "contratado",
        "eventual",
        "monotributista",
        "pasantia",
      ],
      tipo_gasto: ["fijo", "variable"],
      tipo_mov_tesoreria: [
        "impuesto",
        "debito_fiscal",
        "comision",
        "ajuste",
        "deposito",
        "extraccion",
        "ingreso",
        "egreso",
      ],
      tipo_novedad: [
        "falta",
        "llegada_tarde",
        "feriado_trabajado",
        "vacaciones",
        "licencia",
        "horas_extra",
        "otra",
      ],
      tipo_persona: ["fisica", "juridica"],
      tipo_sancion: ["sancion", "notificacion", "apercibimiento"],
      tipo_solicitud: ["solicitud", "informe", "reclamo", "consulta"],
    },
  },
} as const
