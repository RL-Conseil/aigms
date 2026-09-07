export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      action: {
        Row: {
          business_ref: string
          closed_at: string | null
          closure_note: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_blocking: boolean
          organization_id: string
          owner_user_id: string | null
          source:
            | "decision"
            | "risk"
            | "impact_finding"
            | "incident"
            | "audit_finding"
            | "control"
            | "change_request"
            | "management_review"
            | "manual"
          source_id: string | null
          status:
            | "open"
            | "in_progress"
            | "blocked"
            | "done"
            | "cancelled"
            | "overdue"
          tenant_id: string
          title: string
          updated_at: string
          use_case_id: string | null
        }
        Insert: {
          business_ref: string
          closed_at?: string | null
          closure_note?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_blocking?: boolean
          organization_id: string
          owner_user_id?: string | null
          source?:
            | "decision"
            | "risk"
            | "impact_finding"
            | "incident"
            | "audit_finding"
            | "control"
            | "change_request"
            | "management_review"
            | "manual"
          source_id?: string | null
          status?:
            | "open"
            | "in_progress"
            | "blocked"
            | "done"
            | "cancelled"
            | "overdue"
          tenant_id: string
          title: string
          updated_at?: string
          use_case_id?: string | null
        }
        Update: {
          business_ref?: string
          closed_at?: string | null
          closure_note?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_blocking?: boolean
          organization_id?: string
          owner_user_id?: string | null
          source?:
            | "decision"
            | "risk"
            | "impact_finding"
            | "incident"
            | "audit_finding"
            | "control"
            | "change_request"
            | "management_review"
            | "manual"
          source_id?: string | null
          status?:
            | "open"
            | "in_progress"
            | "blocked"
            | "done"
            | "cancelled"
            | "overdue"
          tenant_id?: string
          title?: string
          updated_at?: string
          use_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_asset: {
        Row: {
          business_ref: string
          contains_personal_data: boolean
          created_at: string
          description: string | null
          hosting_location: string | null
          id: string
          kind: "ai_system" | "ai_model" | "ai_agent" | "dataset"
          name: string
          organization_id: string
          owner_user_id: string | null
          tenant_id: string
          updated_at: string
          vendor_id: string | null
          version: string | null
        }
        Insert: {
          business_ref: string
          contains_personal_data?: boolean
          created_at?: string
          description?: string | null
          hosting_location?: string | null
          id?: string
          kind: "ai_system" | "ai_model" | "ai_agent" | "dataset"
          name: string
          organization_id: string
          owner_user_id?: string | null
          tenant_id: string
          updated_at?: string
          vendor_id?: string | null
          version?: string | null
        }
        Update: {
          business_ref?: string
          contains_personal_data?: boolean
          created_at?: string
          description?: string | null
          hosting_location?: string | null
          id?: string
          kind?: "ai_system" | "ai_model" | "ai_agent" | "dataset"
          name?: string
          organization_id?: string
          owner_user_id?: string | null
          tenant_id?: string
          updated_at?: string
          vendor_id?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_asset_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_asset_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_asset_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_asset_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_use_case: {
        Row: {
          accountable_user_id: string | null
          affected_persons: string | null
          autonomy_level: "L0" | "L1" | "L2" | "L3" | "L4"
          business_process: string | null
          business_ref: string
          business_unit_id: string | null
          created_at: string
          created_by: string | null
          criticality: "low" | "moderate" | "high" | "critical" | null
          data_description: string | null
          decision_impact: string | null
          expected_benefit: string | null
          id: string
          involves_personal_data: boolean
          involves_vulnerable_persons: boolean
          name: string
          next_review_at: string | null
          organization_id: string
          owner_user_id: string | null
          purpose: string
          retired_at: string | null
          status:
            | "DRAFT"
            | "TRIAGE"
            | "ASSESSMENT"
            | "REVIEW"
            | "APPROVED"
            | "CONDITIONAL_APPROVAL"
            | "REJECTED"
            | "PILOT"
            | "PRODUCTION"
            | "MONITORING"
            | "RETIRED"
          status_changed_at: string
          tenant_id: string
          updated_at: string
          users_description: string | null
        }
        Insert: {
          accountable_user_id?: string | null
          affected_persons?: string | null
          autonomy_level?: "L0" | "L1" | "L2" | "L3" | "L4"
          business_process?: string | null
          business_ref: string
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: "low" | "moderate" | "high" | "critical" | null
          data_description?: string | null
          decision_impact?: string | null
          expected_benefit?: string | null
          id?: string
          involves_personal_data?: boolean
          involves_vulnerable_persons?: boolean
          name: string
          next_review_at?: string | null
          organization_id: string
          owner_user_id?: string | null
          purpose: string
          retired_at?: string | null
          status?:
            | "DRAFT"
            | "TRIAGE"
            | "ASSESSMENT"
            | "REVIEW"
            | "APPROVED"
            | "CONDITIONAL_APPROVAL"
            | "REJECTED"
            | "PILOT"
            | "PRODUCTION"
            | "MONITORING"
            | "RETIRED"
          status_changed_at?: string
          tenant_id: string
          updated_at?: string
          users_description?: string | null
        }
        Update: {
          accountable_user_id?: string | null
          affected_persons?: string | null
          autonomy_level?: "L0" | "L1" | "L2" | "L3" | "L4"
          business_process?: string | null
          business_ref?: string
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: "low" | "moderate" | "high" | "critical" | null
          data_description?: string | null
          decision_impact?: string | null
          expected_benefit?: string | null
          id?: string
          involves_personal_data?: boolean
          involves_vulnerable_persons?: boolean
          name?: string
          next_review_at?: string | null
          organization_id?: string
          owner_user_id?: string | null
          purpose?: string
          retired_at?: string | null
          status?:
            | "DRAFT"
            | "TRIAGE"
            | "ASSESSMENT"
            | "REVIEW"
            | "APPROVED"
            | "CONDITIONAL_APPROVAL"
            | "REJECTED"
            | "PILOT"
            | "PRODUCTION"
            | "MONITORING"
            | "RETIRED"
          status_changed_at?: string
          tenant_id?: string
          updated_at?: string
          users_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_use_case_accountable_user_id_fkey"
            columns: ["accountable_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_use_case_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_unit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_use_case_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_use_case_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_use_case_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_use_case_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment: {
        Row: {
          business_ref: string
          completed_at: string | null
          created_at: string
          framework_code: string | null
          framework_version: string | null
          id: string
          kind:
            | "triage"
            | "regulatory_preclassification"
            | "risk_assessment"
            | "impact_assessment"
            | "security_review"
            | "vendor_review"
          organization_id: string
          performed_by: string | null
          reopened_reason: string | null
          status:
            | "draft"
            | "in_progress"
            | "completed"
            | "reopened"
            | "superseded"
          supersedes_id: string | null
          tenant_id: string
          updated_at: string
          use_case_id: string
        }
        Insert: {
          business_ref: string
          completed_at?: string | null
          created_at?: string
          framework_code?: string | null
          framework_version?: string | null
          id?: string
          kind:
            | "triage"
            | "regulatory_preclassification"
            | "risk_assessment"
            | "impact_assessment"
            | "security_review"
            | "vendor_review"
          organization_id: string
          performed_by?: string | null
          reopened_reason?: string | null
          status?:
            | "draft"
            | "in_progress"
            | "completed"
            | "reopened"
            | "superseded"
          supersedes_id?: string | null
          tenant_id: string
          updated_at?: string
          use_case_id: string
        }
        Update: {
          business_ref?: string
          completed_at?: string | null
          created_at?: string
          framework_code?: string | null
          framework_version?: string | null
          id?: string
          kind?:
            | "triage"
            | "regulatory_preclassification"
            | "risk_assessment"
            | "impact_assessment"
            | "security_review"
            | "vendor_review"
          organization_id?: string
          performed_by?: string | null
          reopened_reason?: string | null
          status?:
            | "draft"
            | "in_progress"
            | "completed"
            | "reopened"
            | "superseded"
          supersedes_id?: string | null
          tenant_id?: string
          updated_at?: string
          use_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_answer: {
        Row: {
          answer_value: Json
          answered_at: string
          answered_by: string | null
          assessment_id: string
          id: string
          justification: string | null
          question_code: string
          question_label: string
          tenant_id: string
        }
        Insert: {
          answer_value: Json
          answered_at?: string
          answered_by?: string | null
          assessment_id: string
          id?: string
          justification?: string | null
          question_code: string
          question_label: string
          tenant_id: string
        }
        Update: {
          answer_value?: Json
          answered_at?: string
          answered_by?: string | null
          assessment_id?: string
          id?: string
          justification?: string | null
          question_code?: string
          question_label?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answer_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answer_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answer_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action:
            | "create"
            | "update"
            | "delete"
            | "archive"
            | "status_transition"
            | "gate_evaluated"
            | "gate_blocked"
            | "decision_approved"
            | "decision_rejected"
            | "risk_accepted"
            | "evidence_validated"
            | "reassessment_triggered"
            | "access_granted"
            | "access_revoked"
            | "login"
            | "export"
            | "read_sensitive"
          actor_email: string | null
          actor_role:
            | "platform_admin"
            | "governance_officer"
            | "client_admin"
            | "system_owner"
            | "risk_owner"
            | "reviewer"
            | "auditor"
            | "executive_viewer"
            | null
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          entity_id: string | null
          entity_ref: string | null
          entity_type: string
          id: number
          metadata: Json
          occurred_at: string
          summary: string | null
          tenant_id: string
        }
        Insert: {
          action:
            | "create"
            | "update"
            | "delete"
            | "archive"
            | "status_transition"
            | "gate_evaluated"
            | "gate_blocked"
            | "decision_approved"
            | "decision_rejected"
            | "risk_accepted"
            | "evidence_validated"
            | "reassessment_triggered"
            | "access_granted"
            | "access_revoked"
            | "login"
            | "export"
            | "read_sensitive"
          actor_email?: string | null
          actor_role?:
            | "platform_admin"
            | "governance_officer"
            | "client_admin"
            | "system_owner"
            | "risk_owner"
            | "reviewer"
            | "auditor"
            | "executive_viewer"
            | null
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          entity_id?: string | null
          entity_ref?: string | null
          entity_type: string
          id?: number
          metadata?: Json
          occurred_at?: string
          summary?: string | null
          tenant_id: string
        }
        Update: {
          action?:
            | "create"
            | "update"
            | "delete"
            | "archive"
            | "status_transition"
            | "gate_evaluated"
            | "gate_blocked"
            | "decision_approved"
            | "decision_rejected"
            | "risk_accepted"
            | "evidence_validated"
            | "reassessment_triggered"
            | "access_granted"
            | "access_revoked"
            | "login"
            | "export"
            | "read_sensitive"
          actor_email?: string | null
          actor_role?:
            | "platform_admin"
            | "governance_officer"
            | "client_admin"
            | "system_owner"
            | "risk_owner"
            | "reviewer"
            | "auditor"
            | "executive_viewer"
            | null
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          entity_id?: string | null
          entity_ref?: string | null
          entity_type?: string
          id?: number
          metadata?: Json
          occurred_at?: string
          summary?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      business_unit: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_unit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_unit_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "business_unit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_unit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      capa: {
        Row: {
          business_ref: string
          cause_analysis: string
          closed_at: string | null
          correction: string
          corrective_action: string
          created_at: string
          due_date: string | null
          effectiveness_result: string | null
          effectiveness_test: string | null
          effectiveness_tested_at: string | null
          effectiveness_verified_by: string | null
          id: string
          incident_id: string
          owner_user_id: string | null
          preventive_action: string | null
          status:
            | "draft"
            | "in_progress"
            | "implemented"
            | "effectiveness_tested"
            | "closed"
            | "ineffective"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          business_ref: string
          cause_analysis: string
          closed_at?: string | null
          correction: string
          corrective_action: string
          created_at?: string
          due_date?: string | null
          effectiveness_result?: string | null
          effectiveness_test?: string | null
          effectiveness_tested_at?: string | null
          effectiveness_verified_by?: string | null
          id?: string
          incident_id: string
          owner_user_id?: string | null
          preventive_action?: string | null
          status?:
            | "draft"
            | "in_progress"
            | "implemented"
            | "effectiveness_tested"
            | "closed"
            | "ineffective"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          business_ref?: string
          cause_analysis?: string
          closed_at?: string | null
          correction?: string
          corrective_action?: string
          created_at?: string
          due_date?: string | null
          effectiveness_result?: string | null
          effectiveness_test?: string | null
          effectiveness_tested_at?: string | null
          effectiveness_verified_by?: string | null
          id?: string
          incident_id?: string
          owner_user_id?: string | null
          preventive_action?: string | null
          status?:
            | "draft"
            | "in_progress"
            | "implemented"
            | "effectiveness_tested"
            | "closed"
            | "ineffective"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa_effectiveness_verified_by_fkey"
            columns: ["effectiveness_verified_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incident"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      change_request: {
        Row: {
          business_ref: string
          change_types: (
            | "MODEL"
            | "DATASET"
            | "PURPOSE"
            | "VENDOR"
            | "AUTONOMY"
            | "POPULATION"
            | "TERRITORY"
            | "SECURITY"
            | "DEPLOYMENT"
          )[]
          changes_dataset: boolean
          changes_model: boolean
          changes_personal_data: boolean
          changes_purpose: boolean
          changes_vendor: boolean
          created_at: string
          description: string
          id: string
          implemented_at: string | null
          increases_autonomy: boolean
          new_autonomy_level: "L0" | "L1" | "L2" | "L3" | "L4" | null
          new_population_affected: boolean
          new_territory: boolean
          organization_id: string
          planned_at: string | null
          requested_by: string | null
          security_relevant: boolean
          status:
            | "DRAFT"
            | "IMPACT_SCREENING"
            | "REVIEW"
            | "APPROVED"
            | "REJECTED"
            | "IMPLEMENTED"
            | "VERIFIED"
            | "CANCELLED"
          tenant_id: string
          title: string
          updated_at: string
          use_case_id: string
          verification_note: string | null
          verified_at: string | null
        }
        Insert: {
          business_ref: string
          change_types: (
            | "MODEL"
            | "DATASET"
            | "PURPOSE"
            | "VENDOR"
            | "AUTONOMY"
            | "POPULATION"
            | "TERRITORY"
            | "SECURITY"
            | "DEPLOYMENT"
          )[]
          changes_dataset?: boolean
          changes_model?: boolean
          changes_personal_data?: boolean
          changes_purpose?: boolean
          changes_vendor?: boolean
          created_at?: string
          description: string
          id?: string
          implemented_at?: string | null
          increases_autonomy?: boolean
          new_autonomy_level?: "L0" | "L1" | "L2" | "L3" | "L4" | null
          new_population_affected?: boolean
          new_territory?: boolean
          organization_id: string
          planned_at?: string | null
          requested_by?: string | null
          security_relevant?: boolean
          status?:
            | "DRAFT"
            | "IMPACT_SCREENING"
            | "REVIEW"
            | "APPROVED"
            | "REJECTED"
            | "IMPLEMENTED"
            | "VERIFIED"
            | "CANCELLED"
          tenant_id: string
          title: string
          updated_at?: string
          use_case_id: string
          verification_note?: string | null
          verified_at?: string | null
        }
        Update: {
          business_ref?: string
          change_types?: (
            | "MODEL"
            | "DATASET"
            | "PURPOSE"
            | "VENDOR"
            | "AUTONOMY"
            | "POPULATION"
            | "TERRITORY"
            | "SECURITY"
            | "DEPLOYMENT"
          )[]
          changes_dataset?: boolean
          changes_model?: boolean
          changes_personal_data?: boolean
          changes_purpose?: boolean
          changes_vendor?: boolean
          created_at?: string
          description?: string
          id?: string
          implemented_at?: string | null
          increases_autonomy?: boolean
          new_autonomy_level?: "L0" | "L1" | "L2" | "L3" | "L4" | null
          new_population_affected?: boolean
          new_territory?: boolean
          organization_id?: string
          planned_at?: string | null
          requested_by?: string | null
          security_relevant?: boolean
          status?:
            | "DRAFT"
            | "IMPACT_SCREENING"
            | "REVIEW"
            | "APPROVED"
            | "REJECTED"
            | "IMPLEMENTED"
            | "VERIFIED"
            | "CANCELLED"
          tenant_id?: string
          title?: string
          updated_at?: string
          use_case_id?: string
          verification_note?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_request_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_request_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_request_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_request_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      control: {
        Row: {
          business_ref: string
          code: string
          created_at: string
          frequency: string | null
          id: string
          is_mandatory: boolean
          last_tested_at: string | null
          name: string
          next_test_at: string | null
          objective: string
          organization_id: string
          owner_user_id: string | null
          status:
            | "proposed"
            | "implemented"
            | "operating"
            | "ineffective"
            | "retired"
          tenant_id: string
          test_procedure: string | null
          updated_at: string
        }
        Insert: {
          business_ref: string
          code: string
          created_at?: string
          frequency?: string | null
          id?: string
          is_mandatory?: boolean
          last_tested_at?: string | null
          name: string
          next_test_at?: string | null
          objective: string
          organization_id: string
          owner_user_id?: string | null
          status?:
            | "proposed"
            | "implemented"
            | "operating"
            | "ineffective"
            | "retired"
          tenant_id: string
          test_procedure?: string | null
          updated_at?: string
        }
        Update: {
          business_ref?: string
          code?: string
          created_at?: string
          frequency?: string | null
          id?: string
          is_mandatory?: boolean
          last_tested_at?: string | null
          name?: string
          next_test_at?: string | null
          objective?: string
          organization_id?: string
          owner_user_id?: string | null
          status?:
            | "proposed"
            | "implemented"
            | "operating"
            | "ineffective"
            | "retired"
          tenant_id?: string
          test_procedure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      control_applicability: {
        Row: {
          control_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          justification: string | null
          status: "applicable" | "not_applicable" | "to_determine"
          tenant_id: string
          updated_at: string
          use_case_id: string
        }
        Insert: {
          control_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          justification?: string | null
          status?: "applicable" | "not_applicable" | "to_determine"
          tenant_id: string
          updated_at?: string
          use_case_id: string
        }
        Update: {
          control_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          justification?: string | null
          status?: "applicable" | "not_applicable" | "to_determine"
          tenant_id?: string
          updated_at?: string
          use_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_applicability_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "control"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_applicability_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_applicability_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_applicability_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      control_evidence: {
        Row: {
          control_id: string
          evidence_id: string
          id: string
          linked_at: string
          linked_by: string | null
          tenant_id: string
        }
        Insert: {
          control_id: string
          evidence_id: string
          id?: string
          linked_at?: string
          linked_by?: string | null
          tenant_id: string
        }
        Update: {
          control_id?: string
          evidence_id?: string
          id?: string
          linked_at?: string
          linked_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_evidence_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "control"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_with_freshness"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_evidence_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_evidence_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      control_requirement_map: {
        Row: {
          control_id: string
          coverage_note: string | null
          id: string
          mapped_at: string
          mapped_by: string | null
          requirement_id: string
          tenant_id: string
        }
        Insert: {
          control_id: string
          coverage_note?: string | null
          id?: string
          mapped_at?: string
          mapped_by?: string | null
          requirement_id: string
          tenant_id: string
        }
        Update: {
          control_id?: string
          coverage_note?: string | null
          id?: string
          mapped_at?: string
          mapped_by?: string | null
          requirement_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_requirement_map_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "control"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_requirement_map_mapped_by_fkey"
            columns: ["mapped_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_requirement_map_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_requirement_map_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_link: {
        Row: {
          created_at: string
          decision_id: string
          id: string
          note: string | null
          target_id: string
          target_type:
            | "risk"
            | "control"
            | "evidence"
            | "impact_assessment"
            | "change_request"
            | "incident"
            | "use_case"
          tenant_id: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          id?: string
          note?: string | null
          target_id: string
          target_type:
            | "risk"
            | "control"
            | "evidence"
            | "impact_assessment"
            | "change_request"
            | "incident"
            | "use_case"
          tenant_id: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          id?: string
          note?: string | null
          target_id?: string
          target_type?:
            | "risk"
            | "control"
            | "evidence"
            | "impact_assessment"
            | "change_request"
            | "incident"
            | "use_case"
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_link_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "governance_decision"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_link_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          business_ref: string
          collected_at: string
          content_hash: string | null
          created_at: string
          evidence_type:
            | "document"
            | "url"
            | "declarative"
            | "screenshot"
            | "log_extract"
            | "attestation"
            | "connector_pull"
          external_url: string | null
          id: string
          organization_id: string
          owner_user_id: string
          source: string
          storage_path: string | null
          tenant_id: string
          title: string
          updated_at: string
          valid_until: string | null
          validated_at: string | null
          validated_by: string | null
          validation_status: "pending" | "validated" | "rejected" | "superseded"
          version: string | null
        }
        Insert: {
          business_ref: string
          collected_at?: string
          content_hash?: string | null
          created_at?: string
          evidence_type:
            | "document"
            | "url"
            | "declarative"
            | "screenshot"
            | "log_extract"
            | "attestation"
            | "connector_pull"
          external_url?: string | null
          id?: string
          organization_id: string
          owner_user_id: string
          source: string
          storage_path?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          valid_until?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?:
            | "pending"
            | "validated"
            | "rejected"
            | "superseded"
          version?: string | null
        }
        Update: {
          business_ref?: string
          collected_at?: string
          content_hash?: string | null
          created_at?: string
          evidence_type?:
            | "document"
            | "url"
            | "declarative"
            | "screenshot"
            | "log_extract"
            | "attestation"
            | "connector_pull"
          external_url?: string | null
          id?: string
          organization_id?: string
          owner_user_id?: string
          source?: string
          storage_path?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?:
            | "pending"
            | "validated"
            | "rejected"
            | "superseded"
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      framework: {
        Row: {
          code: string
          created_at: string
          effective_from: string | null
          id: string
          is_active: boolean
          name: string
          official_source: string | null
          publisher: string | null
          updated_at: string
          version: string
          withdrawn_from: string | null
        }
        Insert: {
          code: string
          created_at?: string
          effective_from?: string | null
          id?: string
          is_active?: boolean
          name: string
          official_source?: string | null
          publisher?: string | null
          updated_at?: string
          version: string
          withdrawn_from?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          effective_from?: string | null
          id?: string
          is_active?: boolean
          name?: string
          official_source?: string | null
          publisher?: string | null
          updated_at?: string
          version?: string
          withdrawn_from?: string | null
        }
        Relationships: []
      }
      governance_decision: {
        Row: {
          approved_at: string | null
          approver_user_id: string | null
          business_ref: string
          conditions: string | null
          context: string | null
          created_at: string
          decision_statement: string | null
          decision_type:
            | "use_case_authorization"
            | "pilot_approval"
            | "go_production"
            | "risk_acceptance"
            | "policy_exception"
            | "significant_change"
            | "suspension"
            | "retirement"
          effective_from: string | null
          id: string
          options_considered: string | null
          organization_id: string
          rationale: string | null
          review_due_at: string | null
          status:
            | "draft"
            | "submitted"
            | "approved"
            | "approved_with_conditions"
            | "rejected"
            | "revoked"
            | "superseded"
          subject: string
          submitted_at: string | null
          submitted_by: string | null
          supersedes_id: string | null
          tenant_id: string
          updated_at: string
          use_case_id: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approver_user_id?: string | null
          business_ref: string
          conditions?: string | null
          context?: string | null
          created_at?: string
          decision_statement?: string | null
          decision_type:
            | "use_case_authorization"
            | "pilot_approval"
            | "go_production"
            | "risk_acceptance"
            | "policy_exception"
            | "significant_change"
            | "suspension"
            | "retirement"
          effective_from?: string | null
          id?: string
          options_considered?: string | null
          organization_id: string
          rationale?: string | null
          review_due_at?: string | null
          status?:
            | "draft"
            | "submitted"
            | "approved"
            | "approved_with_conditions"
            | "rejected"
            | "revoked"
            | "superseded"
          subject: string
          submitted_at?: string | null
          submitted_by?: string | null
          supersedes_id?: string | null
          tenant_id: string
          updated_at?: string
          use_case_id?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approver_user_id?: string | null
          business_ref?: string
          conditions?: string | null
          context?: string | null
          created_at?: string
          decision_statement?: string | null
          decision_type?:
            | "use_case_authorization"
            | "pilot_approval"
            | "go_production"
            | "risk_acceptance"
            | "policy_exception"
            | "significant_change"
            | "suspension"
            | "retirement"
          effective_from?: string | null
          id?: string
          options_considered?: string | null
          organization_id?: string
          rationale?: string | null
          review_due_at?: string | null
          status?:
            | "draft"
            | "submitted"
            | "approved"
            | "approved_with_conditions"
            | "rejected"
            | "revoked"
            | "superseded"
          subject?: string
          submitted_at?: string | null
          submitted_by?: string | null
          supersedes_id?: string | null
          tenant_id?: string
          updated_at?: string
          use_case_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "governance_decision_approver_user_id_fkey"
            columns: ["approver_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_decision_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_decision_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_decision_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "governance_decision"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_decision_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_decision_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_event: {
        Row: {
          emitted_by: string | null
          event_type:
            | "UseCaseSubmitted"
            | "TriageCompleted"
            | "ClassificationCompleted"
            | "AssessmentCompleted"
            | "RiskAccepted"
            | "ImpactAssessmentCompleted"
            | "OversightPlanApproved"
            | "DecisionApproved"
            | "ProductionGateBlocked"
            | "ProductionGatePassed"
            | "EvidenceExpired"
            | "SignificantChangeDetected"
            | "ReassessmentTriggered"
            | "IncidentOpened"
            | "CAPAClosed"
            | "ReviewDue"
          id: string
          occurred_at: string
          payload: Json
          subject_id: string
          subject_type: string
          tenant_id: string
        }
        Insert: {
          emitted_by?: string | null
          event_type:
            | "UseCaseSubmitted"
            | "TriageCompleted"
            | "ClassificationCompleted"
            | "AssessmentCompleted"
            | "RiskAccepted"
            | "ImpactAssessmentCompleted"
            | "OversightPlanApproved"
            | "DecisionApproved"
            | "ProductionGateBlocked"
            | "ProductionGatePassed"
            | "EvidenceExpired"
            | "SignificantChangeDetected"
            | "ReassessmentTriggered"
            | "IncidentOpened"
            | "CAPAClosed"
            | "ReviewDue"
          id?: string
          occurred_at?: string
          payload?: Json
          subject_id: string
          subject_type: string
          tenant_id: string
        }
        Update: {
          emitted_by?: string | null
          event_type?:
            | "UseCaseSubmitted"
            | "TriageCompleted"
            | "ClassificationCompleted"
            | "AssessmentCompleted"
            | "RiskAccepted"
            | "ImpactAssessmentCompleted"
            | "OversightPlanApproved"
            | "DecisionApproved"
            | "ProductionGateBlocked"
            | "ProductionGatePassed"
            | "EvidenceExpired"
            | "SignificantChangeDetected"
            | "ReassessmentTriggered"
            | "IncidentOpened"
            | "CAPAClosed"
            | "ReviewDue"
          id?: string
          occurred_at?: string
          payload?: Json
          subject_id?: string
          subject_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_event_emitted_by_fkey"
            columns: ["emitted_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_event_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      human_oversight_plan: {
        Row: {
          accountable_user_id: string | null
          approved_at: string | null
          approved_by: string | null
          autonomy_level: "L0" | "L1" | "L2" | "L3" | "L4"
          business_ref: string
          created_at: string
          expected_evidence: string | null
          id: string
          intervention_triggers: string | null
          monitoring_cadence: string | null
          next_review_at: string | null
          not_applicable_rationale: string | null
          organization_id: string
          override_procedure: string | null
          required_competence: string | null
          status:
            | "draft"
            | "submitted"
            | "approved"
            | "rejected"
            | "not_applicable"
            | "superseded"
          stop_authority_user_id: string | null
          stop_procedure: string | null
          tenant_id: string
          updated_at: string
          use_case_id: string
        }
        Insert: {
          accountable_user_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          autonomy_level: "L0" | "L1" | "L2" | "L3" | "L4"
          business_ref: string
          created_at?: string
          expected_evidence?: string | null
          id?: string
          intervention_triggers?: string | null
          monitoring_cadence?: string | null
          next_review_at?: string | null
          not_applicable_rationale?: string | null
          organization_id: string
          override_procedure?: string | null
          required_competence?: string | null
          status?:
            | "draft"
            | "submitted"
            | "approved"
            | "rejected"
            | "not_applicable"
            | "superseded"
          stop_authority_user_id?: string | null
          stop_procedure?: string | null
          tenant_id: string
          updated_at?: string
          use_case_id: string
        }
        Update: {
          accountable_user_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          autonomy_level?: "L0" | "L1" | "L2" | "L3" | "L4"
          business_ref?: string
          created_at?: string
          expected_evidence?: string | null
          id?: string
          intervention_triggers?: string | null
          monitoring_cadence?: string | null
          next_review_at?: string | null
          not_applicable_rationale?: string | null
          organization_id?: string
          override_procedure?: string | null
          required_competence?: string | null
          status?:
            | "draft"
            | "submitted"
            | "approved"
            | "rejected"
            | "not_applicable"
            | "superseded"
          stop_authority_user_id?: string | null
          stop_procedure?: string | null
          tenant_id?: string
          updated_at?: string
          use_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "human_oversight_plan_accountable_user_id_fkey"
            columns: ["accountable_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_oversight_plan_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_oversight_plan_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_oversight_plan_stop_authority_user_id_fkey"
            columns: ["stop_authority_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_oversight_plan_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_oversight_plan_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_assessment: {
        Row: {
          approved_by: string | null
          business_ref: string
          completed_at: string | null
          conclusion: string | null
          created_at: string
          dpia_reference: string | null
          dpia_required: boolean
          id: string
          lifecycle_phase: string | null
          methodology: string
          next_review_at: string | null
          organization_id: string
          performed_by: string | null
          reopened_reason: string | null
          scope_description: string
          status:
            | "draft"
            | "in_progress"
            | "completed"
            | "reopened"
            | "superseded"
          supersedes_id: string | null
          tenant_id: string
          updated_at: string
          use_case_id: string
        }
        Insert: {
          approved_by?: string | null
          business_ref: string
          completed_at?: string | null
          conclusion?: string | null
          created_at?: string
          dpia_reference?: string | null
          dpia_required?: boolean
          id?: string
          lifecycle_phase?: string | null
          methodology?: string
          next_review_at?: string | null
          organization_id: string
          performed_by?: string | null
          reopened_reason?: string | null
          scope_description: string
          status?:
            | "draft"
            | "in_progress"
            | "completed"
            | "reopened"
            | "superseded"
          supersedes_id?: string | null
          tenant_id: string
          updated_at?: string
          use_case_id: string
        }
        Update: {
          approved_by?: string | null
          business_ref?: string
          completed_at?: string | null
          conclusion?: string | null
          created_at?: string
          dpia_reference?: string | null
          dpia_required?: boolean
          id?: string
          lifecycle_phase?: string | null
          methodology?: string
          next_review_at?: string | null
          organization_id?: string
          performed_by?: string | null
          reopened_reason?: string | null
          scope_description?: string
          status?:
            | "draft"
            | "in_progress"
            | "completed"
            | "reopened"
            | "superseded"
          supersedes_id?: string | null
          tenant_id?: string
          updated_at?: string
          use_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_assessment_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_assessment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_assessment_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_assessment_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "impact_assessment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_assessment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_assessment_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_finding: {
        Row: {
          created_at: string
          description: string
          domain:
            | "fundamental_rights"
            | "health_safety"
            | "equality_non_discrimination"
            | "privacy_data_protection"
            | "human_dignity_autonomy"
            | "access_to_services"
            | "employment_working_conditions"
            | "consumer_protection"
            | "democratic_processes"
            | "environment"
            | "vulnerable_groups"
            | "society_at_large"
          id: string
          impact_assessment_id: string
          is_adverse: boolean
          likelihood: "unlikely" | "possible" | "likely" | "almost_certain"
          linked_risk_id: string | null
          mitigation: string | null
          owner_user_id: string | null
          residual_severity:
            | "negligible"
            | "limited"
            | "significant"
            | "severe"
            | null
          severity: "negligible" | "limited" | "significant" | "severe"
          stakeholder_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          domain:
            | "fundamental_rights"
            | "health_safety"
            | "equality_non_discrimination"
            | "privacy_data_protection"
            | "human_dignity_autonomy"
            | "access_to_services"
            | "employment_working_conditions"
            | "consumer_protection"
            | "democratic_processes"
            | "environment"
            | "vulnerable_groups"
            | "society_at_large"
          id?: string
          impact_assessment_id: string
          is_adverse?: boolean
          likelihood: "unlikely" | "possible" | "likely" | "almost_certain"
          linked_risk_id?: string | null
          mitigation?: string | null
          owner_user_id?: string | null
          residual_severity?:
            | "negligible"
            | "limited"
            | "significant"
            | "severe"
            | null
          severity: "negligible" | "limited" | "significant" | "severe"
          stakeholder_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          domain?:
            | "fundamental_rights"
            | "health_safety"
            | "equality_non_discrimination"
            | "privacy_data_protection"
            | "human_dignity_autonomy"
            | "access_to_services"
            | "employment_working_conditions"
            | "consumer_protection"
            | "democratic_processes"
            | "environment"
            | "vulnerable_groups"
            | "society_at_large"
          id?: string
          impact_assessment_id?: string
          is_adverse?: boolean
          likelihood?: "unlikely" | "possible" | "likely" | "almost_certain"
          linked_risk_id?: string | null
          mitigation?: string | null
          owner_user_id?: string | null
          residual_severity?:
            | "negligible"
            | "limited"
            | "significant"
            | "severe"
            | null
          severity?: "negligible" | "limited" | "significant" | "severe"
          stakeholder_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_finding_impact_assessment_id_fkey"
            columns: ["impact_assessment_id"]
            isOneToOne: false
            referencedRelation: "impact_assessment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_finding_linked_risk_id_fkey"
            columns: ["linked_risk_id"]
            isOneToOne: false
            referencedRelation: "risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_finding_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_finding_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "impact_stakeholder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_finding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_stakeholder: {
        Row: {
          consultation_method: string | null
          consulted: boolean
          created_at: string
          estimated_population: string | null
          id: string
          impact_assessment_id: string
          is_vulnerable_group: boolean
          label: string
          tenant_id: string
        }
        Insert: {
          consultation_method?: string | null
          consulted?: boolean
          created_at?: string
          estimated_population?: string | null
          id?: string
          impact_assessment_id: string
          is_vulnerable_group?: boolean
          label: string
          tenant_id: string
        }
        Update: {
          consultation_method?: string | null
          consulted?: boolean
          created_at?: string
          estimated_population?: string | null
          id?: string
          impact_assessment_id?: string
          is_vulnerable_group?: boolean
          label?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_stakeholder_impact_assessment_id_fkey"
            columns: ["impact_assessment_id"]
            isOneToOne: false
            referencedRelation: "impact_assessment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_stakeholder_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      incident: {
        Row: {
          business_ref: string
          closed_at: string | null
          closure_note: string | null
          contained_at: string | null
          containment_action: string | null
          created_at: string
          description: string
          detected_at: string
          id: string
          is_recurrence: boolean
          kind: "incident" | "non_conformity" | "observation" | "near_miss"
          organization_id: string
          owner_user_id: string | null
          reported_by: string | null
          return_to_service_decision_id: string | null
          root_cause: string | null
          severity: "S1" | "S2" | "S3" | "S4"
          status:
            | "OPEN"
            | "CONTAINED"
            | "INVESTIGATING"
            | "ACTION_PLAN"
            | "EFFECTIVENESS_REVIEW"
            | "CLOSED"
          tenant_id: string
          title: string
          updated_at: string
          use_case_id: string | null
        }
        Insert: {
          business_ref: string
          closed_at?: string | null
          closure_note?: string | null
          contained_at?: string | null
          containment_action?: string | null
          created_at?: string
          description: string
          detected_at?: string
          id?: string
          is_recurrence?: boolean
          kind?: "incident" | "non_conformity" | "observation" | "near_miss"
          organization_id: string
          owner_user_id?: string | null
          reported_by?: string | null
          return_to_service_decision_id?: string | null
          root_cause?: string | null
          severity: "S1" | "S2" | "S3" | "S4"
          status?:
            | "OPEN"
            | "CONTAINED"
            | "INVESTIGATING"
            | "ACTION_PLAN"
            | "EFFECTIVENESS_REVIEW"
            | "CLOSED"
          tenant_id: string
          title: string
          updated_at?: string
          use_case_id?: string | null
        }
        Update: {
          business_ref?: string
          closed_at?: string | null
          closure_note?: string | null
          contained_at?: string | null
          containment_action?: string | null
          created_at?: string
          description?: string
          detected_at?: string
          id?: string
          is_recurrence?: boolean
          kind?: "incident" | "non_conformity" | "observation" | "near_miss"
          organization_id?: string
          owner_user_id?: string | null
          reported_by?: string | null
          return_to_service_decision_id?: string | null
          root_cause?: string | null
          severity?: "S1" | "S2" | "S3" | "S4"
          status?:
            | "OPEN"
            | "CONTAINED"
            | "INVESTIGATING"
            | "ACTION_PLAN"
            | "EFFECTIVENESS_REVIEW"
            | "CLOSED"
          tenant_id?: string
          title?: string
          updated_at?: string
          use_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_return_to_service_decision_id_fkey"
            columns: ["return_to_service_decision_id"]
            isOneToOne: false
            referencedRelation: "governance_decision"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      membership: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role:
            | "platform_admin"
            | "governance_officer"
            | "client_admin"
            | "system_owner"
            | "risk_owner"
            | "reviewer"
            | "auditor"
            | "executive_viewer"
          status: "invited" | "active" | "suspended" | "revoked"
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role:
            | "platform_admin"
            | "governance_officer"
            | "client_admin"
            | "system_owner"
            | "risk_owner"
            | "reviewer"
            | "auditor"
            | "executive_viewer"
          status?: "invited" | "active" | "suspended" | "revoked"
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?:
            | "platform_admin"
            | "governance_officer"
            | "client_admin"
            | "system_owner"
            | "risk_owner"
            | "reviewer"
            | "auditor"
            | "executive_viewer"
          status?: "invited" | "active" | "suspended" | "revoked"
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      organization: {
        Row: {
          business_ref: string
          country_code: string | null
          created_at: string
          headcount: number | null
          id: string
          legal_name: string | null
          name: string
          sector: string | null
          status: "prospect" | "pilot" | "active" | "archived"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          business_ref: string
          country_code?: string | null
          created_at?: string
          headcount?: number | null
          id?: string
          legal_name?: string | null
          name: string
          sector?: string | null
          status?: "prospect" | "pilot" | "active" | "archived"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          business_ref?: string
          country_code?: string | null
          created_at?: string
          headcount?: number | null
          id?: string
          legal_name?: string | null
          name?: string
          sector?: string | null
          status?: "prospect" | "pilot" | "active" | "archived"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      reassessment: {
        Row: {
          business_ref: string
          change_request_id: string
          completed_at: string | null
          created_at: string
          engine_rationale: Json
          engine_verdict:
            | "NO_REASSESSMENT"
            | "PARTIAL_REASSESSMENT"
            | "FULL_REASSESSMENT"
          final_verdict:
            | "NO_REASSESSMENT"
            | "PARTIAL_REASSESSMENT"
            | "FULL_REASSESSMENT"
            | null
          id: string
          organization_id: string
          override_rationale: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string[]
          status:
            | "recommended"
            | "confirmed"
            | "overridden"
            | "in_progress"
            | "completed"
          tenant_id: string
          updated_at: string
          use_case_id: string
        }
        Insert: {
          business_ref: string
          change_request_id: string
          completed_at?: string | null
          created_at?: string
          engine_rationale: Json
          engine_verdict:
            | "NO_REASSESSMENT"
            | "PARTIAL_REASSESSMENT"
            | "FULL_REASSESSMENT"
          final_verdict?:
            | "NO_REASSESSMENT"
            | "PARTIAL_REASSESSMENT"
            | "FULL_REASSESSMENT"
            | null
          id?: string
          organization_id: string
          override_rationale?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string[]
          status?:
            | "recommended"
            | "confirmed"
            | "overridden"
            | "in_progress"
            | "completed"
          tenant_id: string
          updated_at?: string
          use_case_id: string
        }
        Update: {
          business_ref?: string
          change_request_id?: string
          completed_at?: string | null
          created_at?: string
          engine_rationale?: Json
          engine_verdict?:
            | "NO_REASSESSMENT"
            | "PARTIAL_REASSESSMENT"
            | "FULL_REASSESSMENT"
          final_verdict?:
            | "NO_REASSESSMENT"
            | "PARTIAL_REASSESSMENT"
            | "FULL_REASSESSMENT"
            | null
          id?: string
          organization_id?: string
          override_rationale?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string[]
          status?:
            | "recommended"
            | "confirmed"
            | "overridden"
            | "in_progress"
            | "completed"
          tenant_id?: string
          updated_at?: string
          use_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reassessment_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "change_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reassessment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reassessment_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reassessment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reassessment_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_classification: {
        Row: {
          assessment_id: string | null
          classified_at: string
          classified_by: string | null
          created_at: string
          flags: (
            | "out_of_scope"
            | "to_confirm"
            | "prohibited_practice_suspected"
            | "high_risk_potential"
            | "transparency_obligations"
            | "gpai_dependency"
            | "privacy_impact"
            | "security_impact"
          )[]
          framework_code: string
          framework_version: string
          id: string
          is_current: boolean
          legal_review_at: string | null
          legal_review_completed: boolean
          legal_review_level:
            | "none"
            | "internal_review"
            | "external_counsel_required"
          legal_reviewer_id: string | null
          next_review_at: string | null
          organization_id: string
          organization_role:
            | "provider"
            | "deployer"
            | "importer"
            | "distributor"
            | "other"
            | "undetermined"
          rationale: string
          tenant_id: string
          updated_at: string
          use_case_id: string
        }
        Insert: {
          assessment_id?: string | null
          classified_at?: string
          classified_by?: string | null
          created_at?: string
          flags?: (
            | "out_of_scope"
            | "to_confirm"
            | "prohibited_practice_suspected"
            | "high_risk_potential"
            | "transparency_obligations"
            | "gpai_dependency"
            | "privacy_impact"
            | "security_impact"
          )[]
          framework_code?: string
          framework_version: string
          id?: string
          is_current?: boolean
          legal_review_at?: string | null
          legal_review_completed?: boolean
          legal_review_level?:
            | "none"
            | "internal_review"
            | "external_counsel_required"
          legal_reviewer_id?: string | null
          next_review_at?: string | null
          organization_id: string
          organization_role?:
            | "provider"
            | "deployer"
            | "importer"
            | "distributor"
            | "other"
            | "undetermined"
          rationale: string
          tenant_id: string
          updated_at?: string
          use_case_id: string
        }
        Update: {
          assessment_id?: string | null
          classified_at?: string
          classified_by?: string | null
          created_at?: string
          flags?: (
            | "out_of_scope"
            | "to_confirm"
            | "prohibited_practice_suspected"
            | "high_risk_potential"
            | "transparency_obligations"
            | "gpai_dependency"
            | "privacy_impact"
            | "security_impact"
          )[]
          framework_code?: string
          framework_version?: string
          id?: string
          is_current?: boolean
          legal_review_at?: string | null
          legal_review_completed?: boolean
          legal_review_level?:
            | "none"
            | "internal_review"
            | "external_counsel_required"
          legal_reviewer_id?: string | null
          next_review_at?: string | null
          organization_id?: string
          organization_role?:
            | "provider"
            | "deployer"
            | "importer"
            | "distributor"
            | "other"
            | "undetermined"
          rationale?: string
          tenant_id?: string
          updated_at?: string
          use_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_classification_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_classification_classified_by_fkey"
            columns: ["classified_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_classification_legal_reviewer_id_fkey"
            columns: ["legal_reviewer_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_classification_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_classification_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_classification_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement: {
        Row: {
          created_at: string
          effective_from: string | null
          framework_id: string
          id: string
          internal_summary: string
          last_reviewed_at: string | null
          mapping_owner_id: string | null
          official_source: string | null
          requirement_reference: string
          status: "requirement" | "guidance" | "internal"
          title: string
          updated_at: string
          withdrawn_from: string | null
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          framework_id: string
          id?: string
          internal_summary: string
          last_reviewed_at?: string | null
          mapping_owner_id?: string | null
          official_source?: string | null
          requirement_reference: string
          status?: "requirement" | "guidance" | "internal"
          title: string
          updated_at?: string
          withdrawn_from?: string | null
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          framework_id?: string
          id?: string
          internal_summary?: string
          last_reviewed_at?: string | null
          mapping_owner_id?: string | null
          official_source?: string | null
          requirement_reference?: string
          status?: "requirement" | "guidance" | "internal"
          title?: string
          updated_at?: string
          withdrawn_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requirement_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "framework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_mapping_owner_id_fkey"
            columns: ["mapping_owner_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      risk: {
        Row: {
          acceptance_rationale: string | null
          acceptance_review_at: string | null
          accepted_at: string | null
          accepted_by: string | null
          business_ref: string
          category:
            | "fundamental_rights"
            | "safety"
            | "security"
            | "privacy"
            | "bias_discrimination"
            | "transparency"
            | "accuracy_robustness"
            | "operational"
            | "financial"
            | "reputational"
            | "legal_compliance"
            | "environmental"
            | "third_party"
          created_at: string
          created_by: string | null
          id: string
          inherent_impact: number
          inherent_level: "low" | "moderate" | "high" | "critical"
          inherent_likelihood: number
          next_review_at: string | null
          organization_id: string
          owner_user_id: string | null
          residual_impact: number | null
          residual_level: "low" | "moderate" | "high" | "critical" | null
          residual_likelihood: number | null
          scenario: string
          status:
            | "identified"
            | "analysed"
            | "treatment_planned"
            | "treatment_in_progress"
            | "mitigated"
            | "accepted"
            | "closed"
          tenant_id: string
          title: string
          updated_at: string
          use_case_id: string | null
        }
        Insert: {
          acceptance_rationale?: string | null
          acceptance_review_at?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          business_ref: string
          category:
            | "fundamental_rights"
            | "safety"
            | "security"
            | "privacy"
            | "bias_discrimination"
            | "transparency"
            | "accuracy_robustness"
            | "operational"
            | "financial"
            | "reputational"
            | "legal_compliance"
            | "environmental"
            | "third_party"
          created_at?: string
          created_by?: string | null
          id?: string
          inherent_impact: number
          inherent_level: "low" | "moderate" | "high" | "critical"
          inherent_likelihood: number
          next_review_at?: string | null
          organization_id: string
          owner_user_id?: string | null
          residual_impact?: number | null
          residual_level?: "low" | "moderate" | "high" | "critical" | null
          residual_likelihood?: number | null
          scenario: string
          status?:
            | "identified"
            | "analysed"
            | "treatment_planned"
            | "treatment_in_progress"
            | "mitigated"
            | "accepted"
            | "closed"
          tenant_id: string
          title: string
          updated_at?: string
          use_case_id?: string | null
        }
        Update: {
          acceptance_rationale?: string | null
          acceptance_review_at?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          business_ref?: string
          category?:
            | "fundamental_rights"
            | "safety"
            | "security"
            | "privacy"
            | "bias_discrimination"
            | "transparency"
            | "accuracy_robustness"
            | "operational"
            | "financial"
            | "reputational"
            | "legal_compliance"
            | "environmental"
            | "third_party"
          created_at?: string
          created_by?: string | null
          id?: string
          inherent_impact?: number
          inherent_level?: "low" | "moderate" | "high" | "critical"
          inherent_likelihood?: number
          next_review_at?: string | null
          organization_id?: string
          owner_user_id?: string | null
          residual_impact?: number | null
          residual_level?: "low" | "moderate" | "high" | "critical" | null
          residual_likelihood?: number | null
          scenario?: string
          status?:
            | "identified"
            | "analysed"
            | "treatment_planned"
            | "treatment_in_progress"
            | "mitigated"
            | "accepted"
            | "closed"
          tenant_id?: string
          title?: string
          updated_at?: string
          use_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_treatment: {
        Row: {
          created_at: string
          description: string
          due_date: string | null
          effectiveness_note: string | null
          id: string
          owner_user_id: string | null
          risk_id: string
          status:
            | "planned"
            | "in_progress"
            | "implemented"
            | "verified"
            | "abandoned"
          strategy: "avoid" | "reduce" | "transfer" | "accept"
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          due_date?: string | null
          effectiveness_note?: string | null
          id?: string
          owner_user_id?: string | null
          risk_id: string
          status?:
            | "planned"
            | "in_progress"
            | "implemented"
            | "verified"
            | "abandoned"
          strategy: "avoid" | "reduce" | "transfer" | "accept"
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string | null
          effectiveness_note?: string | null
          id?: string
          owner_user_id?: string | null
          risk_id?: string
          status?:
            | "planned"
            | "in_progress"
            | "implemented"
            | "verified"
            | "abandoned"
          strategy?: "avoid" | "reduce" | "transfer" | "accept"
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_treatment_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_treatment_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_treatment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignment: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          organization_id: string
          role:
            | "platform_admin"
            | "governance_officer"
            | "client_admin"
            | "system_owner"
            | "risk_owner"
            | "reviewer"
            | "auditor"
            | "executive_viewer"
          tenant_id: string
          updated_at: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id: string
          role:
            | "platform_admin"
            | "governance_officer"
            | "client_admin"
            | "system_owner"
            | "risk_owner"
            | "reviewer"
            | "auditor"
            | "executive_viewer"
          tenant_id: string
          updated_at?: string
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          role?:
            | "platform_admin"
            | "governance_officer"
            | "client_admin"
            | "system_owner"
            | "risk_owner"
            | "reviewer"
            | "auditor"
            | "executive_viewer"
          tenant_id?: string
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_assignment_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignment_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: "active" | "suspended" | "archived"
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: "active" | "suspended" | "archived"
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: "active" | "suspended" | "archived"
          updated_at?: string
        }
        Relationships: []
      }
      use_case_asset_link: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          relation: string
          tenant_id: string
          use_case_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          relation?: string
          tenant_id: string
          use_case_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          relation?: string
          tenant_id?: string
          use_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "use_case_asset_link_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ai_asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "use_case_asset_link_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "use_case_asset_link_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
        ]
      }
      use_case_vendor_link: {
        Row: {
          created_at: string
          id: string
          tenant_id: string
          use_case_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id: string
          use_case_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string
          use_case_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "use_case_vendor_link_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "use_case_vendor_link_use_case_id_fkey"
            columns: ["use_case_id"]
            isOneToOne: false
            referencedRelation: "ai_use_case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "use_case_vendor_link_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_platform_admin: boolean
          job_title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          job_title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          job_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vendor: {
        Row: {
          business_ref: string
          country_code: string | null
          created_at: string
          criticality: "low" | "moderate" | "high" | "critical"
          dpa_signed: boolean
          id: string
          is_model_provider: boolean
          name: string
          next_review_at: string | null
          notes: string | null
          organization_id: string
          reversibility_documented: boolean
          review_status:
            | "not_started"
            | "in_progress"
            | "approved"
            | "approved_with_conditions"
            | "rejected"
            | "expired"
          reviewed_at: string | null
          security_assessed: boolean
          subprocessors: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          business_ref: string
          country_code?: string | null
          created_at?: string
          criticality?: "low" | "moderate" | "high" | "critical"
          dpa_signed?: boolean
          id?: string
          is_model_provider?: boolean
          name: string
          next_review_at?: string | null
          notes?: string | null
          organization_id: string
          reversibility_documented?: boolean
          review_status?:
            | "not_started"
            | "in_progress"
            | "approved"
            | "approved_with_conditions"
            | "rejected"
            | "expired"
          reviewed_at?: string | null
          security_assessed?: boolean
          subprocessors?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          business_ref?: string
          country_code?: string | null
          created_at?: string
          criticality?: "low" | "moderate" | "high" | "critical"
          dpa_signed?: boolean
          id?: string
          is_model_provider?: boolean
          name?: string
          next_review_at?: string | null
          notes?: string | null
          organization_id?: string
          reversibility_documented?: boolean
          review_status?:
            | "not_started"
            | "in_progress"
            | "approved"
            | "approved_with_conditions"
            | "rejected"
            | "expired"
          reviewed_at?: string | null
          security_assessed?: boolean
          subprocessors?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      evidence_with_freshness: {
        Row: {
          business_ref: string | null
          collected_at: string | null
          content_hash: string | null
          created_at: string | null
          evidence_type:
            | "document"
            | "url"
            | "declarative"
            | "screenshot"
            | "log_extract"
            | "attestation"
            | "connector_pull"
            | null
          external_url: string | null
          freshness_status: "fresh" | "expiring" | "expired" | "unknown" | null
          id: string | null
          organization_id: string | null
          owner_user_id: string | null
          source: string | null
          storage_path: string | null
          tenant_id: string | null
          title: string | null
          updated_at: string | null
          valid_until: string | null
          validated_at: string | null
          validated_by: string | null
          validation_status:
            | "pending"
            | "validated"
            | "rejected"
            | "superseded"
            | null
          version: string | null
        }
        Insert: {
          business_ref?: string | null
          collected_at?: string | null
          content_hash?: string | null
          created_at?: string | null
          evidence_type?:
            | "document"
            | "url"
            | "declarative"
            | "screenshot"
            | "log_extract"
            | "attestation"
            | "connector_pull"
            | null
          external_url?: string | null
          freshness_status?: never
          id?: string | null
          organization_id?: string | null
          owner_user_id?: string | null
          source?: string | null
          storage_path?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string | null
          valid_until?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?:
            | "pending"
            | "validated"
            | "rejected"
            | "superseded"
            | null
          version?: string | null
        }
        Update: {
          business_ref?: string | null
          collected_at?: string | null
          content_hash?: string | null
          created_at?: string | null
          evidence_type?:
            | "document"
            | "url"
            | "declarative"
            | "screenshot"
            | "log_extract"
            | "attestation"
            | "connector_pull"
            | null
          external_url?: string | null
          freshness_status?: never
          id?: string | null
          organization_id?: string | null
          owner_user_id?: string | null
          source?: string | null
          storage_path?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string | null
          valid_until?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?:
            | "pending"
            | "validated"
            | "rejected"
            | "superseded"
            | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      evaluate_gate: {
        Args: { p_target: string; p_use_case_id: string }
        Returns: Json
      }
      evaluate_governance_impact: {
        Args: { p_change_request_id: string }
        Returns: Json
      }
      screen_change_request: {
        Args: { p_change_request_id: string }
        Returns: Json
      }
      transition_use_case: {
        Args: { p_rationale?: string; p_target: string; p_use_case_id: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

