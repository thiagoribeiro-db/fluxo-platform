'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  type Comment,
  listComments,
  createComment,
  updateComment,
  deleteComment,
  setCommentResolved,
} from '@/lib/actions/comments';
import type { FluxoNode } from '@/lib/types';

interface CommentsPanelProps {
  projectId: string;
  nodes: FluxoNode[];
  selectedNodeId: string | null;
  collapsed?: boolean;
  onToggle?: () => void;
  /** Callback ao clicar no node-id de um comentário pra ir até ele no canvas. */
  onJumpToNode?: (nodeId: string) => void;
  /** Avisa o pai que houve mudança (insert/update/delete/resolve). */
  onCommentsChanged?: () => void;
}

/**
 * Sidebar direita — lista de threads de comentários do projeto.
 *
 * Cada thread = comentário raiz + replies (parent_id apontando pra raiz).
 * Filtros: ativas (não-resolvidas) e resolvidas.
 */
export default function CommentsPanel({
  projectId,
  nodes,
  selectedNodeId,
  collapsed,
  onToggle,
  onJumpToNode,
  onCommentsChanged,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const [newBody, setNewBody] = useState('');
  const [isPending, startTransition] = useTransition();

  // Carrega ao abrir + recarrega manualmente após mutações (sem polling).
  const reload = async () => {
    const data = await listComments(projectId);
    setComments(data);
    setLoading(false);
    onCommentsChanged?.();
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Agrupa em threads (root + replies)
  const roots = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, Comment[]>();
  comments
    .filter((c) => c.parent_id)
    .forEach((c) => {
      const arr = repliesByParent.get(c.parent_id!) ?? [];
      arr.push(c);
      repliesByParent.set(c.parent_id!, arr);
    });

  const visibleRoots = roots.filter((r) =>
    filter === 'open' ? !r.resolved_at : !!r.resolved_at
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newBody.trim()) return;
    startTransition(async () => {
      try {
        await createComment({
          projectId,
          body: newBody.trim(),
          nodeId: selectedNodeId,
        });
        setNewBody('');
        await reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao comentar');
      }
    });
  }

  if (collapsed) {
    return (
      <aside className="w-12 bg-white border-l border-gray-200 flex flex-col items-center pt-3">
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 hover:text-blip-purple text-lg"
          title="Expandir comentários"
        >
          «
        </button>
        {comments.filter((c) => !c.resolved_at).length > 0 && (
          <div className="mt-2 w-6 h-6 rounded-full bg-blip-purple text-white text-[10px] font-bold flex items-center justify-center">
            {comments.filter((c) => !c.resolved_at).length}
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-white border-l border-gray-200 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">
          💬 Comentários
        </h2>
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 hover:text-blip-purple text-lg"
          title="Recolher"
        >
          »
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {(['open', 'resolved'] as const).map((f) => {
          const count =
            f === 'open'
              ? roots.filter((r) => !r.resolved_at).length
              : roots.filter((r) => !!r.resolved_at).length;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex-1 px-3 py-2 text-xs font-medium ${
                filter === f
                  ? 'border-b-2 border-blip-purple text-blip-purple'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'open' ? `🔘 Abertos` : `✅ Resolvidos`} ({count})
            </button>
          );
        })}
      </div>

      {/* Form de novo comentário */}
      <form onSubmit={handleSubmit} className="p-3 border-b border-gray-100">
        {selectedNodeId ? (
          <p className="text-[10px] text-gray-500 mb-1.5 uppercase font-semibold tracking-wide">
            📌 Ancorando em{' '}
            <span className="font-mono normal-case bg-gray-100 px-1 rounded">
              {nodes.find((n) => n.id === selectedNodeId)?.data?.code ??
                selectedNodeId.slice(0, 8)}
            </span>
          </p>
        ) : (
          <p className="text-[10px] text-gray-400 mb-1.5">
            Selecione um nó pra ancorar o comentário, ou escreva pra comentar
            no projeto.
          </p>
        )}
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={2}
          placeholder="Escreva um comentário…"
          className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-md focus:border-blip-purple focus:outline-none focus:ring-1 focus:ring-blip-purple/30 resize-none"
          disabled={isPending}
        />
        <div className="flex items-center justify-end mt-2">
          <button
            type="submit"
            disabled={isPending || !newBody.trim()}
            className="px-3 py-1 text-xs font-semibold bg-blip-purple text-white rounded hover:bg-blip-purple-dark disabled:opacity-40"
          >
            {isPending ? 'Enviando…' : 'Comentar'}
          </button>
        </div>
      </form>

      {/* Lista de threads */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Carregando…</p>
        ) : visibleRoots.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {filter === 'open'
              ? 'Sem comentários abertos. 🎉'
              : 'Nenhuma thread resolvida ainda.'}
          </p>
        ) : (
          visibleRoots.map((root) => (
            <CommentThread
              key={root.id}
              root={root}
              replies={repliesByParent.get(root.id) ?? []}
              projectId={projectId}
              onChange={reload}
              onJumpToNode={onJumpToNode}
              nodeCode={
                root.node_id
                  ? nodes.find((n) => n.id === root.node_id)?.data?.code
                  : undefined
              }
            />
          ))
        )}
      </div>
    </aside>
  );
}

// =============================================================================
// CommentThread — um root + replies
// =============================================================================
function CommentThread({
  root,
  replies,
  projectId,
  onChange,
  onJumpToNode,
  nodeCode,
}: {
  root: Comment;
  replies: Comment[];
  projectId: string;
  onChange: () => void;
  onJumpToNode?: (nodeId: string) => void;
  nodeCode?: string;
}) {
  const [replyBody, setReplyBody] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleReply() {
    if (!replyBody.trim()) return;
    startTransition(async () => {
      try {
        await createComment({
          projectId,
          body: replyBody.trim(),
          parentId: root.id,
        });
        setReplyBody('');
        setShowReply(false);
        onChange();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro');
      }
    });
  }

  function handleResolve() {
    startTransition(async () => {
      try {
        await setCommentResolved(root.id, projectId, !root.resolved_at);
        onChange();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro');
      }
    });
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      {/* Anchor (se ancorado num nó) */}
      {root.node_id && (
        <button
          type="button"
          onClick={() => onJumpToNode?.(root.node_id!)}
          className="text-[10px] font-mono bg-blip-purple/10 text-blip-purple px-1.5 py-0.5 rounded mb-1.5 hover:bg-blip-purple/20"
          title="Ir pro nó"
        >
          📌 {nodeCode ?? root.node_id.slice(0, 8)}
        </button>
      )}

      {/* Root comment */}
      <CommentBubble
        comment={root}
        projectId={projectId}
        onChange={onChange}
        isRoot
      />

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-4 mt-2 pl-3 border-l-2 border-gray-200 space-y-2">
          {replies.map((r) => (
            <CommentBubble
              key={r.id}
              comment={r}
              projectId={projectId}
              onChange={onChange}
            />
          ))}
        </div>
      )}

      {/* Footer: resolver + responder */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={handleResolve}
          disabled={isPending}
          className="text-[11px] text-gray-600 hover:text-green-700 font-medium"
        >
          {root.resolved_at ? '↶ Reabrir' : '✓ Resolver'}
        </button>
        <button
          type="button"
          onClick={() => setShowReply((v) => !v)}
          className="text-[11px] text-blip-purple hover:underline font-medium"
        >
          {showReply ? 'Cancelar' : 'Responder'}
        </button>
      </div>

      {showReply && (
        <div className="mt-2 space-y-2">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={2}
            placeholder="Responder…"
            className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-md focus:border-blip-purple focus:outline-none focus:ring-1 focus:ring-blip-purple/30 resize-none"
            disabled={isPending}
            autoFocus
          />
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={handleReply}
              disabled={isPending || !replyBody.trim()}
              className="px-2.5 py-1 text-[11px] font-semibold bg-blip-purple text-white rounded hover:bg-blip-purple-dark disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CommentBubble — uma única mensagem (root ou reply)
// =============================================================================
function CommentBubble({
  comment,
  projectId,
  onChange,
  isRoot = false,
}: {
  comment: Comment;
  projectId: string;
  onChange: () => void;
  isRoot?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [, startTransition] = useTransition();

  const authorName =
    comment.author_display_name ||
    comment.author_email?.split('@')[0] ||
    'Usuário';

  function handleSave() {
    if (!body.trim() || body === comment.body) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      try {
        await updateComment(comment.id, projectId, body.trim());
        setEditing(false);
        onChange();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro');
      }
    });
  }

  function handleDelete() {
    const ok = window.confirm('Apagar este comentário?');
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteComment(comment.id, projectId);
        onChange();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro');
      }
    });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className={`text-xs font-semibold ${isRoot ? 'text-gray-900' : 'text-gray-700'}`}>
            {authorName}
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(comment.created_at).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] text-gray-400 hover:text-blip-purple"
              title="Editar"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="text-[10px] text-gray-400 hover:text-red-600"
              title="Apagar"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="mt-1 space-y-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:border-blip-purple focus:outline-none focus:ring-1 focus:ring-blip-purple/30 resize-none"
            autoFocus
          />
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setBody(comment.body);
                setEditing(false);
              }}
              className="text-[11px] text-gray-500 hover:text-gray-700 px-2 py-0.5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="text-[11px] font-medium text-white bg-blip-purple hover:bg-blip-purple-dark px-2 py-0.5 rounded"
            >
              Salvar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
          {comment.body}
        </p>
      )}
    </div>
  );
}
