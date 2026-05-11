/** v2 Workspace-level shared state (logical view; persisted partially normalized in DB). */
export interface WorkspaceState {
  workspace_id: string;
  name: string;
  created_by: string;
  members: WorkspaceMember[];
  projects: ProjectContext[];
  tasks: WorkspaceTaskRef[];
  shared_contracts: Contract[];
  shared_decisions: Decision[];
  context_graph: ContextEdge[];
}

export interface WorkspaceMember {
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  joined_at: string;
  projects: string[];
  agent: MemberAgent;
  context_token: string;
  status: "online" | "offline" | "agent_running";
}

export interface MemberAgent {
  agent_id: string;
  owner_user_id: string;
  name: string;
  type: "claude" | "openai" | "custom" | "live_cursor" | "live_claude_code";
  bound_projects: string[];
  capabilities: string[];
  endpoint?: string;
  status: "idle" | "thinking" | "blocked" | "done";
}

export interface FileNode {
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export interface ModuleRef {
  name: string;
  path_hint: string;
}

export interface InterfaceRef {
  kind: string;
  name: string;
  detail?: string;
}

export interface ProjectContext {
  project_id: string;
  owner_user_id: string;
  name: string;
  source_type: "git" | "local" | "live_agent";
  file_tree: FileNode[];
  summary: string;
  modules: ModuleRef[];
  vector_index_id: string;
  exposed_interfaces: InterfaceRef[];
  last_synced: string;
  access_policy: "workspace_open" | "owner_controlled";
}

export interface ContextEdge {
  from_project: string;
  to_project: string;
  relation_type: "calls_api" | "imports" | "shares_schema" | "depends_on";
  confidence: number;
  discovered_by: string;
  verified: boolean;
}

export interface WorkspaceTaskRef {
  task_id: string;
  title: string;
  phase: string;
}

export interface Contract {
  id: string;
  status: "draft" | "proposed" | "agreed" | "violated";
  endpoint?: string;
  parties: string[];
}

export interface Decision {
  id: string;
  content: string;
  decided_by: string;
  at: string;
}

export type MessageTypeV2 =
  | "proposal"
  | "question"
  | "decision"
  | "blocker"
  | "handoff"
  | "ack"
  | "done"
  | "context_query"
  | "dependency_discovered"
  | "sync_request";

export interface AgentMessageV2 {
  message_id: string;
  workspace_id: string;
  task_id?: string;
  type: MessageTypeV2;
  from: string;
  to: string;
  content: Record<string, unknown>;
  requires_response: boolean;
  priority: "low" | "normal" | "high" | "critical";
  timestamp: string;
}

export interface LiveAgentStatus {
  agent_id: string;
  current_phase: "reading" | "planning" | "implementing" | "testing" | "idle";
  active_files: string[];
  recent_changes: { path: string; summary: string }[];
  current_task: string;
  blockers: string[];
}

export type RealtimeEvent =
  | { type: "member_joined"; payload: unknown }
  | { type: "project_connected"; payload: unknown }
  | { type: "project_synced"; payload: unknown }
  | { type: "agent_message"; payload: AgentMessageV2 }
  | { type: "state_update"; payload: { patch: unknown } }
  | { type: "context_query_result"; payload: unknown }
  | { type: "member_agent_status"; payload: LiveAgentStatus };
