'use client';

/**
 * Modal de seleção de Skill — sub-fluxos reutilizáveis pra inserir no projeto.
 *
 * Mostra cards agrupados por categoria, com busca por nome/keywords. Click
 * insere a skill no canvas (próximo ao centro visível, conectando ao bloco
 * selecionado se houver).
 *
 * Além dos builtins, mostra skills CUSTOMIZADAS do usuário (localStorage).
 * "Salvar seleção como skill" é gancho do FlowEditor.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CATEGORY_LABEL, SKILLS, type Skill } from '@/lib/skills';
import {
  deleteUserSkill,
  listUserSkills,
  type UserSkill,
} from '@/lib/skills/user-library';

interface SkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (skill: Skill) => void;
  /** Insere uma skill customizada do usuário (mesmo fluxo do builtin). */
  onInsertUserSkill?: (skill: UserSkill) => void;
  /** Salva o que está selecionado no canvas como skill. Se nada selecionado, mostra warning. */
  onSaveSelection?: () => void;
  /** Quantidade de nodes selecionados (pra UI mostrar "Salvar (3 nodes)"). */
  selectedCount?: number;
}

export default function SkillsDialog({
  open,
  onOpenChange,
  onInsert,
  onInsertUserSkill,
  onSaveSelection,
  selectedCount = 0,
}: SkillsDialogProps) {
  const [search, setSearch] = useState('');
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      return;
    }
    // Refresca user skills a cada abrir (caso tenha sido criada em outra aba)
    setUserSkills(listUserSkills());
  }, [open]);

  function handleDeleteUserSkill(id: string) {
    if (deleteUserSkill(id)) {
      setUserSkills(listUserSkills());
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SKILLS;
    return SKILLS.filter((s) => {
      const haystack = `${s.title} ${s.description} ${s.keywords.join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [search]);

  const filteredUserSkills = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return userSkills;
    return userSkills.filter((s) => {
      const haystack = `${s.name} ${s.description}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [search, userSkills]);

  // Agrupa filtrados por categoria
  const grouped = useMemo(() => {
    const map = new Map<string, Skill[]>();
    for (const s of filtered) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries()).map(([cat, items]) => ({
      category: cat as keyof typeof CATEGORY_LABEL,
      items,
    }));
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[90vw] dark:bg-gray-900 max-h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 dark:text-white">
            <Sparkles size={18} className="text-blip-purple" /> Inserir Skill
          </DialogTitle>
          <DialogDescription className="mt-1 dark:text-gray-400">
            Sub-fluxos prontos que aceleram a construção do seu chatbot. Insere o pacote completo
            (frame + nós + conexões) no canvas.
          </DialogDescription>
        </DialogHeader>

        {/* Search + "Salvar seleção" */}
        <div className="shrink-0 px-5 pb-3 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800">
          <Search size={15} className="text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, descrição ou tag…"
            autoFocus
            className="flex-1 bg-transparent text-sm py-2 outline-none dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          {onSaveSelection && (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setTimeout(() => onSaveSelection(), 50);
              }}
              disabled={selectedCount === 0}
              className="rounded-md bg-blip-purple px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blip-purple-dark disabled:opacity-40"
              title={
                selectedCount > 0
                  ? `Salva os ${selectedCount} blocos selecionados como skill reusável`
                  : 'Selecione blocos no canvas antes de salvar'
              }
            >
              + Salvar seleção ({selectedCount})
            </button>
          )}
          {search && (
            <span className="text-[10px] text-gray-400">
              {filtered.length + filteredUserSkills.length} resultados
            </span>
          )}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {/* SEÇÃO: minha biblioteca (custom) — só renderiza se houver itens */}
          {filteredUserSkills.length > 0 && onInsertUserSkill && (
            <section className="mt-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                🧩 Minha biblioteca
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredUserSkills.map((s) => (
                  <li key={s.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        setTimeout(() => onInsertUserSkill(s), 50);
                      }}
                      className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blip-purple hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10 transition"
                    >
                      <span className="text-2xl shrink-0 leading-none mt-0.5">
                        {s.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {s.name}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight line-clamp-2">
                          {s.description || `${s.nodes.length} nós · ${s.edges.length} conexões`}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUserSkill(s.id)}
                      className="absolute top-2 right-2 invisible rounded p-1 text-red-500 hover:bg-red-50 group-hover:visible dark:hover:bg-red-950"
                      title="Apagar skill"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {grouped.length === 0 && filteredUserSkills.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
              Nenhuma skill encontrada pra &quot;{search}&quot;
            </div>
          ) : (
            grouped.map(({ category, items }) => (
              <section key={category} className="mt-4 first:mt-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  {CATEGORY_LABEL[category]}
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          // Delay pra fechar dialog antes de inserir (evita re-render concorrente)
                          setTimeout(() => onInsert(s), 50);
                        }}
                        className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blip-purple hover:bg-blip-purple/5 dark:hover:bg-blip-purple/10 transition group"
                      >
                        <span className="text-2xl shrink-0 leading-none mt-0.5">{s.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blip-purple-dark dark:group-hover:text-blip-purple">
                            {s.title}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight line-clamp-2">
                            {s.description}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
          💡 Skills inserem um sub-fluxo completo. Você pode editar tudo depois — IDs, textos, conexões.
        </div>
      </DialogContent>
    </Dialog>
  );
}
