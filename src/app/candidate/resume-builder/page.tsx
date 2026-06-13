// src/app/candidate/resume-builder/page.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { FileText, Download, Eye, Sparkles, User, Briefcase, GraduationCap, Award, Upload, X, Mic, BookOpen, FolderGit2, Palette, StopCircle, UploadCloud, Copy, Trash2, Bold, Italic, List, ListOrdered, Link as LinkIcon, Unlink, FilePlus2, LayoutTemplate, Save, CheckCircle2 } from 'lucide-react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

import CandidateLayout from '@/components/layout/CandidateLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { decryptApiKey } from '@/lib/crypto';


// --- Type Definitions ---
export interface PersonalInfo { name: string; email: string; phone: string; location: string; legalStatus: string; }
export interface ExperienceEntry { id: string; jobTitle: string; company: string; dates: string; description: string; }
export interface EducationEntry { id: string; degree: string; institution: string; graduationYear: string; gpa: string; achievements: string; }
export interface SkillCategory { id: string; category: string; skills_list: string; }
export interface CertificationEntry { id: string; name: string; issuer: string; date: string; }
export interface PublicationEntry { id: string; title: string; authors: string; journal: string; date: string; link: string; }
export interface ProjectEntry { id: string; title: string; date: string; description: string; }
export interface ResumeData { personal: PersonalInfo; summary:string; experience: ExperienceEntry[]; education: EducationEntry[]; skills: SkillCategory[]; certifications: CertificationEntry[]; publications: PublicationEntry[]; projects: ProjectEntry[]; }
type EnhancementContext = | { section: 'summary' } | { section: 'experience'; index: number } | { section: 'education'; index: number } | { section: 'projects'; index: number };
export interface StyleOptions { fontFamily: string; fontSize: number; accentColor: string; }
export type ResumeTemplate = 'classic' | 'modern' | 'minimal' | 'executive';

// --- useHistory Hook (Simplified - removed undo/redo functionality) ---
const useHistory = (initialState: any) => {
    const [history, setHistory] = useState([initialState]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const setState = (action: any, overwrite = false) => {
        const newState = typeof action === 'function' ? action(history[currentIndex]) : action;
        if (!overwrite && JSON.stringify(newState) === JSON.stringify(history[currentIndex])) return;
        const newHistory = history.slice(0, currentIndex + 1);
        setHistory([...newHistory, newState]);
        setCurrentIndex(newHistory.length);
    };

    // Undo/Redo functionality removed from here
    return { state: history[currentIndex], setState, undo: () => {}, redo: () => {}, canUndo: false, canRedo: false };
};

// --- UI Primitive Components ---
const Card = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (<div className="glass" {...props}>{children}</div>);
const CardHeader = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (<div className="p-6" {...props}>{children}</div>);
const CardTitle = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (<h3 className="text-xl font-semibold text-white" {...props}>{children}</h3>);
const CardContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (<div className="p-6 pt-0" {...props}>{children}</div>);
const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'destructive', size?: 'default' | 'sm', as?: React.ElementType }>(({ children, variant, size, className, as: Component = 'button', ...props }, ref) => {
    const baseStyle = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none";
    const variantStyles = { default: "bg-indigo-600 text-white hover:bg-indigo-700", outline: "border border-gray-300 text-white bg-transparent hover:bg-white/10 hover:border-white/20", destructive: "bg-red-600 text-white hover:bg-red-700" };
    const sizeStyles = { default: "h-10 py-2 px-4", sm: "h-9 px-3" };
    return <Component ref={ref} className={`${baseStyle} ${variantStyles[variant || 'default']} ${sizeStyles[size || 'default']} ${className}`} {...props}>{children}</Component>;
});
Button.displayName = 'Button';

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (<input {...props} className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-gray-400" />);
const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (<select {...props} className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">{children}</select>);
const Label = (props: React.LabelHTMLAttributes<HTMLLabelElement>) => (<label {...props} className="text-sm font-medium leading-none block mb-1 text-gray-200" />);
const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => ( <textarea {...props} className="flex min-h-[80px] w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-gray-400" />);

// --- Utility function to unescape HTML entities ---
function unescapeHtml(html: string) {
    if (typeof document === 'undefined' || !html) {
        return html;
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.documentElement.textContent || html;
}

// --- Tiptap Editor Wrapper Component ---
const TiptapEditor = ({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                blockquote: false,
                code: false,
                horizontalRule: false,
                hardBreak: false,
                gapcursor: false,
                history: false,
            } as any),
            LinkExtension.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
            }),
            Placeholder.configure({
                placeholder: placeholder || 'Write something...',
            }),
        ],
        content: value || '<p></p>',
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none text-white focus:outline-none min-h-[150px] p-3 rounded-md border border-white/20 bg-white/10',
            },
        },
        injectCSS: false,
        immediatelyRender: false,
    }, [value]);

    if (!mounted || !editor) {
        return (
            <div className="min-h-[150px] p-3 rounded-md border border-white/20 bg-white/10 text-white placeholder-gray-400">
                {placeholder || 'Loading editor...'}
            </div>
        );
    }

    return (
        <div className="tiptap-editor-wrapper">
            <div className="flex items-center gap-1 p-2 rounded-t-md border border-white/20 bg-white/10 text-white">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'is-active p-1 rounded bg-white/20' : 'p-1 rounded hover:bg-white/10'}
                    type="button"
                >
                    <Bold size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'is-active p-1 rounded bg-white/20' : 'p-1 rounded hover:bg-white/10'}
                    type="button"
                >
                    <Italic size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'is-active p-1 rounded bg-white/20' : 'p-1 rounded hover:bg-white/10'}
                    type="button"
                >
                    <List size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'is-active p-1 rounded bg-white/20' : 'p-1 rounded hover:bg-white/10'}
                    type="button"
                >
                    <ListOrdered size={16} />
                </button>
                <button
                    onClick={() => {
                        const previousUrl = editor.getAttributes('link').href;
                        const url = window.prompt('URL', previousUrl);

                        if (url === null) {
                            return;
                        }

                        if (url === '') {
                            editor.chain().focus().extendMarkRange('link').unsetLink().run();
                            return;
                        }

                        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                    }}
                    className={editor.isActive('link') ? 'is-active p-1 rounded bg-white/20' : 'p-1 rounded hover:bg-white/10'}
                    type="button"
                >
                    <LinkIcon size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().unsetLink().run()}
                    disabled={!editor.isActive('link')}
                    className="p-1 rounded hover:bg-white/10"
                    type="button"
                >
                    <Unlink size={16} />
                </button>
            </div>
            <EditorContent editor={editor} />
        </div>
    );
};


// --- Refactored Form Section Components ---
const PersonalForm = ({ data, onChange, onPicChange, onPicRemove, picPreview }: any) => (
    <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Full Name</Label><Input value={data.name || ''} onChange={e => onChange('name', e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={data.email || ''} onChange={e => onChange('email', e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={data.phone || ''} onChange={e => onChange('phone', e.target.value)} /></div>
            <div><Label>Location</Label><Input value={data.location || ''} onChange={e => onChange('location', e.target.value)} /></div>
        </div>
        <div><Label>Legal Status</Label><Select value={data.legalStatus || 'Prefer not to say'} onChange={e => onChange('legalStatus', e.target.value)}><option>Prefer not to say</option><option>U.S. Citizen</option></Select></div>
        <div>
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-4">
                <Input type="file" accept="image/png, image/jpeg" onChange={onPicChange} className="flex-1"/>
                {picPreview && (
                    <div className="relative">
                        <img src={picPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"/>
                        <Button variant="destructive" size="sm" className="absolute -top-1 -right-1 rounded-full p-1 h-auto" onClick={onPicRemove}><X size={12}/></Button>
                    </div>
                )}
            </div>
        </div>
    </div>
);

const SummaryForm = ({ value, onChange, onEnhance, loading, suggestions, newBatchFrom, onApplySuggestion, onDismissSuggestions, onGenerateMore, suggestionsLoading }: any) => {
    const hasSuggestions = suggestions && suggestions.length > 0;
    return (
        <div className="space-y-4">
            {/* ── AI Suggestion Panel ── */}
            {hasSuggestions && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-500/20">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-indigo-400" />
                            <span className="text-sm font-semibold text-indigo-300">
                                AI-generated summaries
                            </span>
                            <span className="text-[10px] font-medium bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full">
                                {suggestions.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onGenerateMore}
                                disabled={suggestionsLoading}
                                className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-400 hover:text-indigo-200 disabled:opacity-50 transition-colors border border-indigo-500/30 hover:border-indigo-400/50 rounded-md px-2 py-1"
                            >
                                {suggestionsLoading
                                    ? <><span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />Generating…</>
                                    : <><Sparkles size={11} />Generate more</>
                                }
                            </button>
                            <button type="button" onClick={onDismissSuggestions} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"><X size={13} /></button>
                        </div>
                    </div>

                    {/* Suggestion list */}
                    <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                        {suggestions.map((s: string, i: number) => {
                            const isNew = newBatchFrom > 0 && i === newBatchFrom;
                            return (
                                <React.Fragment key={i}>
                                    {isNew && (
                                        <div className="flex items-center gap-2 py-1">
                                            <div className="flex-1 h-px bg-indigo-500/20" />
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-500">New batch</span>
                                            <div className="flex-1 h-px bg-indigo-500/20" />
                                        </div>
                                    )}
                                    <div
                                        className="group flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-500/40 p-3 transition-all cursor-pointer"
                                        onClick={() => onApplySuggestion(s)}
                                    >
                                        <span className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center ${i >= newBatchFrom && newBatchFrom > 0 ? 'bg-indigo-500/30 border-indigo-400/60 text-indigo-200' : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'}`}>
                                            {i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-zinc-300 leading-relaxed line-clamp-3" dangerouslySetInnerHTML={{ __html: s }} />
                                        </div>
                                        <span className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-indigo-400 font-semibold mt-0.5 whitespace-nowrap">Use →</span>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Footer hint */}
                    <div className="px-4 py-2 border-t border-indigo-500/20 bg-indigo-500/5">
                        <p className="text-[10px] text-zinc-500">Click any option to apply it to the editor. You can then edit or enhance it further.</p>
                    </div>
                </div>
            )}

            {/* ── Editor ── */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <Label>Professional Summary</Label>
                    {!hasSuggestions && (
                        <button
                            type="button"
                            onClick={onGenerateMore}
                            disabled={suggestionsLoading}
                            className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-200 disabled:opacity-50 transition-colors"
                        >
                            {suggestionsLoading
                                ? <><span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />Generating…</>
                                : <><Sparkles size={11} />Generate with AI</>
                            }
                        </button>
                    )}
                </div>
                <TiptapEditor
                    value={value || ''}
                    onChange={onChange}
                    placeholder="A concise summary of your professional experience and goals..."
                />
                <Button size="sm" variant="outline" className="mt-2" onClick={onEnhance} disabled={loading}><Sparkles size={14} className="mr-1.5" />Enhance</Button>
            </div>
        </div>
    );
};

// ─── Skill suggestions pool ───────────────────────────────────────────────
const ALL_SKILL_SUGGESTIONS = [
  // Languages
  'Python','JavaScript','TypeScript','Java','C++','C#','Go','Rust','Swift','Kotlin','PHP','Ruby','Scala','R','MATLAB','Bash','SQL','HTML','CSS',
  // Frontend
  'React','Next.js','Vue.js','Angular','Svelte','Redux','Tailwind CSS','SASS/SCSS','Framer Motion','Three.js','Webpack','Vite',
  // Backend
  'Node.js','Express','Flask','FastAPI','Django','Spring Boot','NestJS','GraphQL','REST APIs','gRPC','WebSockets',
  // Data / ML
  'TensorFlow','PyTorch','scikit-learn','Pandas','NumPy','Keras','Hugging Face','LangChain','OpenCV','Spark','Hadoop',
  // Cloud / DevOps
  'AWS','Azure','GCP','Docker','Kubernetes','Terraform','CI/CD','Jenkins','GitHub Actions','Linux','Nginx',
  // Databases
  'PostgreSQL','MySQL','MongoDB','Redis','Firestore','DynamoDB','Elasticsearch','Supabase','SQLite','Cassandra',
  // Tools
  'Git','Figma','Postman','Jira','Notion','VS Code','Xcode','Android Studio',
  // Other
  'Machine Learning','Deep Learning','NLP','Computer Vision','Microservices','Agile','Scrum','System Design','Data Structures','Algorithms',
];

// ─── SkillTagInput ─────────────────────────────────────────────────────────
const SkillTagInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    const [input, setInput] = useState('');
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Convert comma-string ↔ array
    const tags: string[] = value
        ? value.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const updateTags = (next: string[]) => onChange(next.join(', '));

    const addTag = (tag: string) => {
        const clean = tag.trim();
        if (!clean || tags.includes(clean)) { setInput(''); return; }
        updateTags([...tags, clean]);
        setInput('');
    };

    const removeTag = (tag: string) => updateTags(tags.filter(t => t !== tag));

    const suggestions = input.trim().length > 0
        ? ALL_SKILL_SUGGESTIONS.filter(
            s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
          ).slice(0, 8)
        : [];

    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); }
        if (e.key === 'Backspace' && !input && tags.length) removeTag(tags[tags.length - 1]);
    };

    return (
        <div className="relative">
            {/* Tag container */}
            <div
                className="min-h-[52px] flex flex-wrap gap-1.5 items-center p-2.5 rounded-lg border border-white/20 bg-white/5 cursor-text focus-within:border-indigo-500/60 transition-colors"
                onClick={() => inputRef.current?.focus()}
            >
                {tags.map(tag => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeTag(tag); }}
                            className="hover:text-rose-400 transition-colors ml-0.5"
                        >
                            <X size={10} strokeWidth={3} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 150)}
                    placeholder={tags.length === 0 ? 'Type a skill and press Enter or comma…' : 'Add more…'}
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
            </div>

            {/* Suggestions dropdown */}
            {focused && suggestions.length > 0 && (
                <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 px-3 pt-2 pb-1">Suggestions</p>
                    <div className="flex flex-wrap gap-1.5 p-2.5">
                        {suggestions.map(s => (
                            <button
                                key={s}
                                type="button"
                                onMouseDown={() => addTag(s)}
                                className="text-xs bg-white/5 hover:bg-indigo-500/30 border border-white/10 hover:border-indigo-500/50 text-zinc-300 hover:text-white px-2.5 py-1 rounded-full transition-all"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── DynamicSection ────────────────────────────────────────────────────────
const DynamicSection = ({ sectionKey, data, onChange, onAdd, onRemove, onEnhance, fields, addPayload, loading }: any) => (
    <div className="space-y-4">
        {(data || []).map((item: any, index: number) => ( // Ensure data is an array
            <div key={item.id} className="p-4 border border-white/20 rounded-lg relative space-y-3">
                 <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => onRemove(sectionKey, item.id)}><Trash2 size={14} /></Button>
                 <div className="grid md:grid-cols-2 gap-4">
                    {fields.map((field: any) => {
                        const colSpanClass = field.colSpan === 2 ? 'md:col-span-2' : '';
                        
                        let InputComponent;
                        let inputProps: any = {
                            value: item[field.key] || '',
                            onChange: (e: any) => onChange(sectionKey, index, field.key, e.target.value),
                            placeholder: `Enter ${field.label.toLowerCase()}...`
                        };

                        if (field.type === 'textarea' || field.type === 'quill') {
                            InputComponent = TiptapEditor;
                            inputProps.onChange = (val: string) => onChange(sectionKey, index, field.key, val);
                            inputProps.value = item[field.key] || '';
                        } else if (field.type === 'plain_textarea') {
                            InputComponent = Textarea;
                            inputProps.onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(sectionKey, index, field.key, e.target.value);
                            inputProps.rows = 5;
                            inputProps.placeholder = `Enter ${field.label.toLowerCase()}...`;
                        } else if (field.type === 'skill_tags') {
                            return (
                                <div key={field.key} className={colSpanClass}>
                                    <Label>{field.label}</Label>
                                    <SkillTagInput
                                        value={item[field.key] || ''}
                                        onChange={(v) => onChange(sectionKey, index, field.key, v)}
                                    />
                                </div>
                            );
                        }
                        else {
                            InputComponent = Input;
                        }

                        return (
                            <div key={field.key} className={colSpanClass}>
                                <Label>{field.label}</Label>
                                <InputComponent {...inputProps} />
                                {field.enhance && (
                                    <Button size="sm" variant="outline" className="mt-2" onClick={() => onEnhance({ section: sectionKey, index })} disabled={loading}><Sparkles size={14} className="mr-1.5" />Enhance</Button>
                                )}
                            </div>
                        );
                    })}
                 </div>
            </div>
        ))}
        <Button variant="outline" onClick={() => onAdd(sectionKey, addPayload)}>+ Add {sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}</Button>
    </div>
);


// ─── 3-D Interactive Empty State ──────────────────────────────────────────
const EmptyPreview3D = () => {
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(false);
    const [floatY, setFloatY] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);

    // Smooth floating bob
    useEffect(() => {
        let start = 0;
        const tick = (t: number) => {
            if (!start) start = t;
            setFloatY(Math.sin((t - start) / 1400) * 10);
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const r = containerRef.current.getBoundingClientRect();
        const nx = (e.clientX - r.left - r.width  / 2) / (r.width  / 2); // -1 → 1
        const ny = (e.clientY - r.top  - r.height / 2) / (r.height / 2); // -1 → 1
        setTilt({ x: ny * 14, y: -nx * 14 }); // rotateX = pitch, rotateY = yaw
    };

    // Glow origin moves opposite to tilt (light-source feel)
    const glowX = 50 - tilt.y * 3;
    const glowY = 50 + tilt.x * 3;

    // Shimmer skeleton line helper
    const Line = ({ w, h = 8, delay = 0, color = '#e2e8f0' }: { w: string; h?: number; delay?: number; color?: string }) => (
        <div style={{
            height: `${h}px`, width: w, borderRadius: `${h / 2}px`,
            background: `linear-gradient(90deg, ${color} 0%, #f8fafc 50%, ${color} 100%)`,
            backgroundSize: '200% 100%',
            animation: `ep3d-shimmer 2s ${delay}s infinite linear`,
            marginBottom: '5px',
        }} />
    );

    const Tag = ({ w, delay = 0 }: { w: number; delay?: number }) => (
        <div style={{
            height: '20px', width: `${w}px`, borderRadius: '10px',
            background: 'linear-gradient(90deg, #ede9fe 0%, #f5f3ff 50%, #ede9fe 100%)',
            backgroundSize: '200% 100%',
            animation: `ep3d-shimmer 2s ${delay}s infinite linear`,
            flexShrink: 0,
        }} />
    );

    const SectionLabel = ({ delay = 0 }: { delay?: number }) => (
        <div style={{
            height: '9px', width: '80px', borderRadius: '4px',
            background: 'linear-gradient(90deg, #c7d2fe 0%, #e0e7ff 50%, #c7d2fe 100%)',
            backgroundSize: '200% 100%',
            animation: `ep3d-shimmer 2s ${delay}s infinite linear`,
            marginBottom: '10px',
        }} />
    );

    return (
        <div
            ref={containerRef}
            className="flex flex-col items-center justify-center min-h-[600px] select-none overflow-hidden"
            style={{ perspective: '1100px' }}
            onMouseMove={onMove}
            onMouseLeave={() => { setTilt({ x: 0, y: 0 }); setHovered(false); }}
            onMouseEnter={() => setHovered(true)}
        >
            {/* Ambient background orbs */}
            <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)', top: '10%', left: '10%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.08), transparent 70%)', bottom: '15%', right: '15%', pointerEvents: 'none' }} />

            {/* 3-D card */}
            <div style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${floatY}px) scale(${hovered ? 1.04 : 1})`,
                transition: hovered ? 'transform 0.08s ease-out' : 'transform 0.7s cubic-bezier(0.23,1,0.32,1)',
                transformStyle: 'preserve-3d',
                willChange: 'transform',
            }}>
                {/* Card body */}
                <div style={{
                    width: '340px',
                    background: '#ffffff',
                    borderRadius: '14px',
                    padding: '28px 26px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: hovered
                        ? `0 35px 90px rgba(99,102,241,0.22), 0 10px 30px rgba(0,0,0,0.12)`
                        : `0 20px 60px rgba(0,0,0,0.13)`,
                    transition: 'box-shadow 0.4s ease',
                }}>

                    {/* Dynamic glow */}
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
                        background: `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(99,102,241,0.13) 0%, transparent 60%)`,
                        transition: hovered ? 'background 0.08s' : 'background 0.4s',
                    }} />

                    {/* Holographic sheen */}
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
                        background: `linear-gradient(${115 + tilt.y * 2.5}deg, rgba(255,255,255,0.55) 0%, transparent 38%, rgba(255,255,255,0.1) 100%)`,
                        opacity: hovered ? 1 : 0.3,
                        transition: 'opacity 0.3s',
                    }} />

                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 3 }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                                background: 'linear-gradient(135deg, #c7d2fe, #ddd6fe)',
                                animation: 'ep3d-pulse 2.5s ease-in-out infinite',
                            }} />
                            <div style={{ flex: 1 }}>
                                <Line w="70%" h={11} delay={0} />
                                <Line w="45%" h={7}  delay={0.15} />
                            </div>
                        </div>

                        {/* Summary */}
                        <SectionLabel delay={0.05} />
                        <Line w="100%" delay={0.1} />
                        <Line w="90%"  delay={0.18} />
                        <Line w="65%"  delay={0.26} />
                        <div style={{ marginBottom: '16px' }} />

                        {/* Experience */}
                        <SectionLabel delay={0.1} />
                        <Line w="55%" h={9} delay={0.2} />
                        <Line w="35%" h={7} delay={0.25} color="#f0fdf4" />
                        <Line w="100%" delay={0.3} />
                        <Line w="85%"  delay={0.35} />
                        <div style={{ marginBottom: '16px' }} />

                        {/* Skills */}
                        <SectionLabel delay={0.15} />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                            {[52, 68, 44, 76, 56, 40].map((w, i) => <Tag key={i} w={w} delay={0.1 + i * 0.06} />)}
                        </div>

                        {/* CTA */}
                        <div style={{
                            textAlign: 'center', padding: '12px 16px',
                            background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                            borderRadius: '10px', border: '1.5px dashed #a5b4fc',
                        }}>
                            <p style={{ color: '#6d28d9', fontSize: '11px', fontWeight: 700, margin: 0, letterSpacing: '0.01em' }}>
                                ✨ Fill in your details to see your resume come to life
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reflection / shadow plane */}
                <div style={{
                    position: 'absolute', bottom: '-20px', left: '10%', right: '10%', height: '30px',
                    background: 'radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%)',
                    filter: 'blur(8px)',
                    transform: 'translateZ(-20px)',
                    transition: 'opacity 0.4s',
                    opacity: hovered ? 1 : 0.5,
                }} />
            </div>

            {/* Hint label */}
            <p style={{
                marginTop: '32px', fontSize: '11px', color: '#9ca3af',
                opacity: hovered ? 0.9 : 0.45, transition: 'opacity 0.4s',
                letterSpacing: '0.02em',
            }}>
                {hovered ? 'Hover to explore · Click a section to start' : 'Move cursor over the preview ↑'}
            </p>

            <style>{`
                @keyframes ep3d-shimmer {
                    0%   { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes ep3d-pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.55; }
                }
            `}</style>
        </div>
    );
};

const DesignForm = ({ options, onChange }: { options: StyleOptions, onChange: (field: keyof StyleOptions, value: any) => void }) => {
    const fontFamilies = ['Calibri, sans-serif', 'Georgia, serif', 'Helvetica, sans-serif', 'Verdana, sans-serif', 'Garamond, serif'];
    return (
        <div className="space-y-4">
            <div>
                <Label htmlFor="font-family">Font Family</Label>
                <Select id="font-family" value={options.fontFamily} onChange={e => onChange('fontFamily', e.target.value)}>
                    {fontFamilies.map(font => <option key={font} value={font}>{font.split(',')[0]}</option>)}
                </Select>
            </div>
             <div>
                <Label htmlFor="font-size">Font Size (pt)</Label>
                <Input id="font-size" type="number" value={options.fontSize} onChange={e => onChange('fontSize', parseInt(e.target.value, 10))} />
            </div>
             <div>
                <Label htmlFor="accent-color">Accent Color</Label>
                <div className="flex items-center gap-2">
                    <Input id="accent-color" type="color" value={options.accentColor} onChange={e => onChange('accentColor', e.target.value)} className="p-1 h-10 w-14" />
                    <Input type="text" value={options.accentColor} onChange={e => onChange('accentColor', e.target.value)} className="flex-1"/>
                </div>
            </div>
        </div>
    );
};

// ─── Template Picker ───────────────────────────────────────────────────────
const TEMPLATES: { id: ResumeTemplate; name: string; desc: string; thumb: React.ReactNode }[] = [
    {
        id: 'classic',
        name: 'Classic',
        desc: 'Traditional centered layout with section dividers',
        thumb: (
            <svg viewBox="0 0 80 100" className="w-full h-full">
                <rect width="80" height="100" fill="#fff" />
                <rect x="15" y="8" width="50" height="6" rx="1" fill="#94a3b8" />
                <rect x="25" y="17" width="30" height="3" rx="1" fill="#cbd5e1" />
                <rect x="8" y="26" width="64" height="1" fill="#e2e8f0" />
                <rect x="8" y="31" width="25" height="3" rx="1" fill="#6366f1" />
                <rect x="8" y="37" width="64" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="41" width="48" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="47" width="25" height="3" rx="1" fill="#6366f1" />
                <rect x="8" y="53" width="64" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="57" width="40" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="63" width="25" height="3" rx="1" fill="#6366f1" />
                <rect x="8" y="69" width="64" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="73" width="52" height="2" rx="1" fill="#e2e8f0" />
            </svg>
        ),
    },
    {
        id: 'modern',
        name: 'Modern',
        desc: 'Two-column layout with a colored sidebar',
        thumb: (
            <svg viewBox="0 0 80 100" className="w-full h-full">
                <rect width="80" height="100" fill="#fff" />
                <rect width="26" height="100" fill="#6366f110" />
                <rect x="2" y="10" width="22" height="5" rx="1" fill="#6366f1" />
                <rect x="2" y="18" width="22" height="2" rx="1" fill="#cbd5e1" />
                <rect x="2" y="22" width="22" height="2" rx="1" fill="#cbd5e1" />
                <rect x="2" y="30" width="14" height="2" rx="1" fill="#6366f1" />
                <rect x="2" y="34" width="22" height="2" rx="1" fill="#e2e8f0" />
                <rect x="2" y="38" width="22" height="2" rx="1" fill="#e2e8f0" />
                <rect x="2" y="44" width="14" height="2" rx="1" fill="#6366f1" />
                <rect x="2" y="48" width="22" height="2" rx="1" fill="#e2e8f0" />
                <rect x="2" y="52" width="18" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="8" width="30" height="4" rx="1" fill="#94a3b8" />
                <rect x="30" y="15" width="15" height="2" rx="1" fill="#6366f1" />
                <rect x="30" y="20" width="46" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="24" width="40" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="31" width="15" height="2" rx="1" fill="#6366f1" />
                <rect x="30" y="36" width="46" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="40" width="35" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="47" width="15" height="2" rx="1" fill="#6366f1" />
                <rect x="30" y="52" width="46" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="56" width="30" height="2" rx="1" fill="#e2e8f0" />
            </svg>
        ),
    },
    {
        id: 'minimal',
        name: 'Minimal',
        desc: 'Clean typographic layout with generous whitespace',
        thumb: (
            <svg viewBox="0 0 80 100" className="w-full h-full">
                <rect width="80" height="100" fill="#fff" />
                <rect x="8" y="10" width="40" height="5" rx="1" fill="#1e293b" />
                <rect x="8" y="18" width="58" height="2" rx="1" fill="#cbd5e1" />
                <rect x="8" y="28" width="16" height="2" rx="1" fill="#94a3b8" />
                <rect x="8" y="32" width="64" height="1.5" rx="1" fill="#f1f5f9" />
                <rect x="8" y="36" width="64" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="8" y="40" width="50" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="8" y="48" width="16" height="2" rx="1" fill="#94a3b8" />
                <rect x="8" y="52" width="64" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="8" y="56" width="48" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="8" y="64" width="16" height="2" rx="1" fill="#94a3b8" />
                <rect x="8" y="68" width="64" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="8" y="72" width="40" height="1.5" rx="1" fill="#e2e8f0" />
            </svg>
        ),
    },
    {
        id: 'executive',
        name: 'Executive',
        desc: 'Bold professional layout with strong accent lines',
        thumb: (
            <svg viewBox="0 0 80 100" className="w-full h-full">
                <rect width="80" height="100" fill="#fff" />
                <rect x="8" y="8" width="48" height="7" rx="1" fill="#1e293b" />
                <rect x="8" y="17" width="64" height="3" rx="0" fill="#6366f1" />
                <rect x="8" y="23" width="45" height="2" rx="1" fill="#cbd5e1" />
                <rect x="8" y="32" width="4" height="12" rx="0" fill="#6366f1" />
                <rect x="15" y="33" width="20" height="3" rx="1" fill="#1e293b" />
                <rect x="15" y="38" width="55" height="2" rx="1" fill="#e2e8f0" />
                <rect x="15" y="42" width="42" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="52" width="4" height="12" rx="0" fill="#6366f1" />
                <rect x="15" y="53" width="20" height="3" rx="1" fill="#1e293b" />
                <rect x="15" y="58" width="55" height="2" rx="1" fill="#e2e8f0" />
                <rect x="15" y="62" width="35" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="72" width="4" height="12" rx="0" fill="#6366f1" />
                <rect x="15" y="73" width="20" height="3" rx="1" fill="#1e293b" />
                <rect x="15" y="78" width="55" height="2" rx="1" fill="#e2e8f0" />
            </svg>
        ),
    },
];

const TemplatePickerForm = ({ selected, onSelect }: { selected: ResumeTemplate; onSelect: (t: ResumeTemplate) => void }) => (
    <div className="space-y-3">
        <p className="text-sm text-zinc-400">Choose a layout for your resume. The preview updates instantly.</p>
        <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map(t => (
                <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className={`relative rounded-xl border-2 overflow-hidden transition-all text-left ${
                        selected === t.id
                            ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                            : 'border-white/10 hover:border-white/30'
                    }`}
                >
                    <div className="h-32 bg-white">{t.thumb}</div>
                    <div className="p-2 bg-white/5">
                        <p className="text-xs font-semibold text-white">{t.name}</p>
                        <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">{t.desc}</p>
                    </div>
                    {selected === t.id && (
                        <div className="absolute top-1.5 right-1.5 bg-indigo-500 rounded-full p-0.5">
                            <CheckCircle2 size={12} className="text-white" />
                        </div>
                    )}
                </button>
            ))}
        </div>
    </div>
);

// --- Refactored Modal Components ---
const EnhancementModal = ({ isOpen, versions, selected, onSelect, onApply, onClose, originalText }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-2xl text-white">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Choose an Enhanced Version</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {versions.map((version: string, index: number) => (
                        <div key={index} className="p-4 border border-white/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors" onClick={() => onSelect(version)}>
                            <label className="flex items-start space-x-3">
                                <input type="radio" name="enhancementVersion" checked={selected === version} onChange={() => onSelect(version)} className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                                <span className="text-gray-300 text-sm" dangerouslySetInnerHTML={{ __html: version === originalText ? `<strong>(Original)</strong> ${version}` : version }} />
                            </label>
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={onApply}>Apply Selection</Button>
                </div>
            </div>
        </div>
    );
};

const PitchModal = ({ isOpen, onClose, pitchText, setPitchText, startRecording, stopRecording, isRecording, recordedVideoUrl, videoRef, onVideoFileChange, onUpload, loading, videoBlob }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-4xl text-white">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white">Your Elevator Pitch</h3><button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold mb-2">AI-Generated Script</h4>
                        <Textarea value={pitchText} onChange={e => setPitchText(e.target.value)} rows={12} className="bg-white/10 w-full" />
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => { navigator.clipboard.writeText(pitchText); toast.success("Copied to clipboard!"); }}><Copy size={14} className="mr-2" />Copy Script</Button>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">Record or Upload Video</h4>
                        <div className="bg-black rounded-lg aspect-video mb-2 flex items-center justify-center">
                            <video ref={videoRef} src={!isRecording && recordedVideoUrl ? recordedVideoUrl : undefined} controls={!!recordedVideoUrl && !isRecording} className="w-full h-full rounded-lg object-contain bg-black" autoPlay={isRecording} muted={isRecording}></video>
                        </div>
                        <div className="flex justify-center items-center gap-4">
                            {isRecording ? (<Button onClick={stopRecording} variant="destructive"><StopCircle size={16} className="mr-2" />Stop</Button>) : (<Button onClick={startRecording}><Mic size={16} className="mr-2" />Record</Button>)}
                            <Label htmlFor="video-upload" className="cursor-pointer m-0"><Button as="span" variant="outline"><UploadCloud size={16} className="mr-2" />Upload File</Button></Label>
                            <Input id="video-upload" type="file" accept="video/*" className="hidden" onChange={onVideoFileChange} />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-between">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={onUpload} disabled={!videoBlob || loading}>{loading ? "Uploading..." : <><Upload size={16} className="mr-2" /> Upload Pitch</>}</Button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
export default function ResumeBuilder() {
    const [activeSection, setActiveSection] = useState<string>('personal');
    const [resumeData, setResumeDataState] = useState<ResumeData>({
        personal: { name: '', email: '', phone: '', location: '', legalStatus: 'Prefer not to say' },
        summary: '<p></p>',
        experience: [{ id: crypto.randomUUID(), jobTitle: '', company: '', dates: '', description: '<p></p>' }],
        education: [{ id: crypto.randomUUID(), degree: '', institution: '', graduationYear: '', gpa: '', achievements: '<p></p>' }],
        skills: [{ id: crypto.randomUUID(), category: '', skills_list: '' }],
        certifications: [{ id: crypto.randomUUID(), name: '', issuer: '', date: '' }],
        publications: [{ id: crypto.randomUUID(), title: '', authors: '', journal: '', date: '', link: '' }],
        projects: [{ id: crypto.randomUUID(), title: '', date: '', description: '<p></p>' }]
    });

    const setResumeData = (action: any) => {
        setResumeDataState(prev => {
            const newState = typeof action === 'function' ? action(prev) : action;
            return newState;
        });
    };


    const [loading, setLoading] = useState<boolean>(false);
    const [profilePic, setProfilePic] = useState<{ preview: string; file: File | null }>({ preview: '', file: null });
    const [showPamtenLogo, setShowPamtenLogo] = useState<boolean>(false);
    const [showEnhancementModal, setShowEnhancementModal] = useState<boolean>(false);
    const [enhancementVersions, setEnhancementVersions] = useState<string[]>([]);
    const [selectedEnhancement, setSelectedEnhancement] = useState<string>('');
    const [originalText, setOriginalText] = useState<string>('');
    const [enhancementContext, setEnhancementContext] = useState<EnhancementContext | null>(null);
    const [showPitchModal, setShowPitchModal] = useState<boolean>(false);
    const [pitchText, setPitchText] = useState('');
    const [styleOptions, setStyleOptions] = useState<StyleOptions>({ fontFamily: 'Calibri, sans-serif', fontSize: 11, accentColor: '#34495e' });
    const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplate>('classic');
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const [summarySuggestions, setSummarySuggestions] = useState<string[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [newBatchFrom, setNewBatchFrom] = useState(0); // index where the latest generated batch starts
    const [panelWidth, setPanelWidth] = useState(50);
    const isResizing = useRef(false);
    const API_BASE_URL: string = 'http://127.0.0.1:5000/api';
    const { user } = useAuth();

    useEffect(() => {
        const loadSavedResume = async () => {
            if (user?.id) {
                try {
                    const docRef = doc(db, 'resumes', user.id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const savedData = docSnap.data().resumeData;
                        if (savedData) {
                            setResumeDataState(normalizeResumeData(savedData));
                            toast.success("Loaded your saved resume from cloud!");
                        }
                    }
                    
                    // Load profile picture from Firestore if exists
                    const userRef = doc(db, 'users', user.id);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists() && userSnap.data().profilePicture) {
                        setProfilePic({ preview: userSnap.data().profilePicture, file: null });
                    }
                } catch (error) {
                    console.error("Error loading resume from Firestore:", error);
                }
            }
        };
        loadSavedResume();
    }, [user]);

    const handleSaveResume = async () => {
        if (!user?.id) {
            toast.error("Please log in to save your resume to the cloud!");
            return;
        }
        setLoading(true);
        const toastId = "save-resume";
        toast.info("Saving resume to cloud...", { id: toastId });
        try {
            let profilePicUrl = profilePic.preview;
            if (profilePic.file) {
                const picRef = ref(storage, `users/${user.id}/profile_picture.jpg`);
                await uploadBytes(picRef, profilePic.file);
                profilePicUrl = await getDownloadURL(picRef);
                await setDoc(doc(db, 'users', user.id), { profilePicture: profilePicUrl }, { merge: true });
                setProfilePic({ preview: profilePicUrl, file: null });
            }

            await setDoc(doc(db, 'resumes', user.id), {
                userId: user.id,
                resumeData,
                updatedAt: new Date().toISOString(),
            });

            toast.success("Resume saved to Cloud Firestore successfully!", { id: toastId });
        } catch (error: any) {
            console.error("Firebase save resume error:", error);
            toast.error(`Failed to save resume: ${error.message}`, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleClearResume = () => {
        setResumeDataState({
            personal: { name: '', email: '', phone: '', location: '', legalStatus: 'Prefer not to say' },
            summary: '<p></p>',
            experience: [{ id: crypto.randomUUID(), jobTitle: '', company: '', dates: '', description: '<p></p>' }],
            education: [{ id: crypto.randomUUID(), degree: '', institution: '', graduationYear: '', gpa: '', achievements: '<p></p>' }],
            skills: [{ id: crypto.randomUUID(), category: '', skills_list: '' }],
            certifications: [{ id: crypto.randomUUID(), name: '', issuer: '', date: '' }],
            publications: [{ id: crypto.randomUUID(), title: '', authors: '', journal: '', date: '', link: '' }],
            projects: [{ id: crypto.randomUUID(), title: '', date: '', description: '<p></p>' }]
        });
        setUploadedFileName('');
        setProfilePic({ preview: '', file: null });
        toast.success("Cleared. Start building your new resume!");
    };

    const fetchSummarySuggestions = async (dataToUse?: ResumeData, append = true) => {
        const data = dataToUse ?? resumeData;
        setSuggestionsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/generate-summary-suggestions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}`,
                },
                body: JSON.stringify({ resumeData: data }),
            });
            const result = await res.json();
            const newOnes: string[] = Array.isArray(result.summaries) ? result.summaries : [];
            if (newOnes.length === 0) { toast.error("No suggestions returned. Try again."); return; }
            if (append) {
                setSummarySuggestions(prev => {
                    setNewBatchFrom(prev.length);
                    return [...prev, ...newOnes];
                });
                toast.success(`${newOnes.length} new suggestions added!`, { id: 'summary-suggest' });
            } else {
                setSummarySuggestions(newOnes);
                setNewBatchFrom(0);
                toast.success("Summary suggestions ready!", { id: 'summary-suggest' });
            }
        } catch {
            toast.error("Failed to generate suggestions. Try again.");
        } finally {
            setSuggestionsLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!user?.id) { toast.error("Please log in to save a draft!"); return; }
        setLoading(true);
        const toastId = "save-draft";
        toast.info("Saving draft...", { id: toastId });
        try {
            await setDoc(doc(db, 'resumeDrafts', user.id), {
                userId: user.id,
                resumeData,
                status: 'draft',
                savedAt: new Date().toISOString(),
            });
            toast.success("Draft saved! You can continue editing anytime.", { id: toastId });
        } catch (error: any) {
            toast.error(`Failed to save draft: ${error.message}`, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const [isRecording, setIsRecording] = useState(false);
    const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const handlePersonalChange = (field: keyof PersonalInfo, value: string) => { setResumeData((prev: ResumeData) => ({ ...prev, personal: { ...prev.personal, [field]: value } })); };
    const handleSummaryChange = (value: string) => { setResumeData((prev: ResumeData) => ({...prev, summary: value})); };
    const handleDynamicChange = <T extends ExperienceEntry | EducationEntry | SkillCategory | CertificationEntry | PublicationEntry | ProjectEntry>(section: keyof ResumeData, index: number, field: keyof T, value: any) => {
        setResumeData((prev: ResumeData) => {
            const newList = [...(prev[section] as T[])];
            newList[index] = { ...newList[index], [field]: value };
            return { ...prev, [section]: newList };
        });
    };

    const handleProfilePicChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.[0]) {
            const file = event.target.files[0];
            setProfilePic({ preview: URL.createObjectURL(file), file });
            toast.success("Profile picture selected.");
        }
    };
    
    const handleProfilePicRemove = () => {
        if(profilePic.preview) { URL.revokeObjectURL(profilePic.preview); }
        setProfilePic({ preview: '', file: null });
        toast.info("Profile picture removed.");
    };

    const handleStyleChange = (field: keyof StyleOptions, value: any) => {
        setStyleOptions(prev => ({...prev, [field]: value}));
    };

    const addDynamicEntry = (section: keyof ResumeData, newEntry: any) => setResumeData((prev: ResumeData) => ({ ...prev, [section]: [...(prev[section] as any[]), { ...newEntry, id: crypto.randomUUID() }] }));
    const removeDynamicEntry = (section: keyof ResumeData, id: string) => setResumeData((prev: ResumeData) => ({ ...prev, [section]: (prev[section] as any[]).filter(item => item.id !== id) }));
    const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); isResizing.current = true; document.body.style.cursor = 'col-resize'; };
    const handleMouseUp = useCallback(() => { isResizing.current = false; document.body.style.cursor = 'default'; }, []);
    const handleMouseMove = useCallback((e: MouseEvent) => { if (!isResizing.current) return; const newWidth = (e.clientX / window.innerWidth) * 100; if (newWidth > 25 && newWidth < 75) { setPanelWidth(newWidth); } }, []);
    useEffect(() => { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); }; }, [handleMouseMove, handleMouseUp]);

    const normalizeResumeData = (data: any): ResumeData => {
        const defaultHtmlValue = '<p></p>';
        const defaultPlainValue = '';

        const normalized = { ...data };

        normalized.experience = Array.isArray(normalized.experience) ? normalized.experience : [];
        normalized.education = Array.isArray(normalized.education) ? normalized.education : [];
        normalized.skills = Array.isArray(normalized.skills) ? normalized.skills : [];
        normalized.certifications = Array.isArray(normalized.certifications) ? normalized.certifications : [];
        normalized.publications = Array.isArray(normalized.publications) ? normalized.publications : [];
        normalized.projects = Array.isArray(normalized.projects) ? normalized.projects : [];


        normalized.personal = {
            name: typeof normalized.personal?.name === 'string' ? normalized.personal.name : '',
            email: typeof normalized.personal?.email === 'string' ? normalized.personal.email : '',
            phone: typeof normalized.personal?.phone === 'string' ? normalized.personal.phone : '',
            location: typeof normalized.personal?.location === 'string' ? normalized.personal.location : '',
            legalStatus: typeof normalized.personal?.legalStatus === 'string' ? normalized.personal.legalStatus : 'Prefer not to say',
        };

        normalized.summary = typeof normalized.summary === 'string' ? (unescapeHtml(normalized.summary) || defaultHtmlValue) : defaultHtmlValue;

        normalized.experience = normalized.experience.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            jobTitle: typeof item.jobTitle === 'string' ? item.jobTitle : '',
            company: typeof item.company === 'string' ? item.company : '',
            dates: typeof item.dates === 'string' ? item.dates : '',
            description: typeof item.description === 'string' ? (unescapeHtml(item.description) || defaultHtmlValue) : defaultHtmlValue
        }));
        normalized.education = normalized.education.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            degree: typeof item.degree === 'string' ? item.degree : '',
            institution: typeof item.institution === 'string' ? item.institution : '',
            graduationYear: typeof item.graduationYear === 'string' ? item.graduationYear : '',
            gpa: typeof item.gpa === 'string' ? item.gpa : '',
            achievements: typeof item.achievements === 'string' ? (unescapeHtml(item.achievements) || defaultHtmlValue) : defaultHtmlValue
        }));
        normalized.skills = normalized.skills.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            category: typeof item.category === 'string' ? item.category : '',
            skills_list: typeof item.skills_list === 'string' ? (item.skills_list || defaultPlainValue) : defaultPlainValue,
        }));
        normalized.projects = normalized.projects.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            title: typeof item.title === 'string' ? item.title : '',
            date: typeof item.date === 'string' ? item.date : '',
            description: typeof item.description === 'string' ? (unescapeHtml(item.description) || defaultHtmlValue) : defaultHtmlValue,
        }));
        normalized.publications = normalized.publications.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            title: typeof item.title === 'string' ? item.title : '',
            authors: typeof item.authors === 'string' ? item.authors : '',
            journal: typeof item.journal === 'string' ? item.journal : '',
            date: typeof item.date === 'string' ? item.date : '',
            link: typeof item.link === 'string' ? item.link : '',
        }));
        normalized.certifications = normalized.certifications.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            name: typeof item.name === 'string' ? item.name : '',
            issuer: typeof item.issuer === 'string' ? item.issuer : '',
            date: typeof item.date === 'string' ? item.date : '',
        }));

        return normalized;
    };


    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const toastId = "upload";
        toast.info("Parsing resume...", { id: toastId });

        const formData = new FormData();
        formData.append('file', file);

        try {
            let customKey = '';
            if (typeof window !== 'undefined' && user?.id) {
                const savedEncryptedKey = localStorage.getItem('user_gemini_api_key') || '';
                if (savedEncryptedKey) {
                    customKey = await decryptApiKey(savedEncryptedKey, user.id);
                }
            }
            const response = await fetch(`${API_BASE_URL}/parse-resume`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}`,
                    'X-Gemini-API-Key': customKey
                },
                body: formData
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                throw new Error(result.error || 'Server responded with an error');
            }

            if (!result.parsedData || Object.keys(result.parsedData).length === 0) {
                throw new Error('Resume parsing returned empty data. Check your Gemini API key in profile settings.');
            }

            const normalizedData = normalizeResumeData(result.parsedData);
            setResumeDataState(normalizedData);
            setUploadedFileName(file.name);
            toast.success("Resume parsed successfully!", { id: toastId });

            // Auto-suggest summaries if none found
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = normalizedData.summary || '';
            const summaryText = tempDiv.textContent?.trim() || '';
            if (!summaryText) {
                setSummarySuggestions([]);
                setNewBatchFrom(0);
                setActiveSection('summary');
                toast.info("No summary found — generating suggestions…", { id: 'summary-suggest', duration: 8000 });
                fetchSummarySuggestions(normalizedData, false);
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to parse resume.', { id: toastId });
            console.error("Frontend file upload error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEnhance = async (context: EnhancementContext) => {
        let textToEnhance: string = ''; let sectionNameForApi: string = '';
        if (context.section === 'summary') { textToEnhance = resumeData.summary; sectionNameForApi = 'Summary'; }
        else if (context.section === 'experience') { textToEnhance = resumeData.experience[context.index].description; sectionNameForApi = 'Experience Description';}
        else if (context.section === 'education') { textToEnhance = resumeData.education[context.index].achievements; sectionNameForApi = 'Education Achievements'; }
        else if (context.section === 'projects') { textToEnhance = resumeData.projects[context.index].description; sectionNameForApi = 'Project Description';}
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = textToEnhance;
        let contentForCheck = tempDiv.textContent || '';
        
        if (!contentForCheck.trim()) {
            toast.info("Field is empty, nothing to enhance."); return;
        }

        setEnhancementContext(context); setOriginalText(textToEnhance); setLoading(true); toast.info(`Enhancing ${sectionNameForApi}...`);
        try {
            let customKey = '';
            if (typeof window !== 'undefined' && user?.id) {
                const savedEncryptedKey = localStorage.getItem('user_gemini_api_key') || '';
                if (savedEncryptedKey) {
                    customKey = await decryptApiKey(savedEncryptedKey, user.id);
                }
            }
            const response = await fetch(`${API_BASE_URL}/enhance-section`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}`,
                    'X-Gemini-API-Key': customKey
                },
                body: JSON.stringify({ sectionName: sectionNameForApi, textToEnhance })
            });
            if (!response.ok) throw new Error('Enhancement failed');
            const result = await response.json();
            if (Array.isArray(result.enhancedVersions) && result.enhancedVersions.length > 0) {
                const processedVersions = result.enhancedVersions.map((v: string) => unescapeHtml(v));
                setEnhancementVersions([textToEnhance, ...processedVersions]);
                setSelectedEnhancement(unescapeHtml(textToEnhance));
                setShowEnhancementModal(true);
                toast.success("AI suggestions ready!");
            } else { toast.info("No new suggestions were generated."); }
        } catch (error: any) { toast.error(error.message); } finally { setLoading(false); }
    };

    const handleApplyEnhancement = () => {
        if (!enhancementContext) return;
        const { section } = enhancementContext;
        if (section === 'summary') { handleSummaryChange(selectedEnhancement); }
        else {
            const index = (enhancementContext as any).index;
            if (section === 'experience') { handleDynamicChange('experience', index, 'description' as any, selectedEnhancement); }
            else if (section === 'education') { handleDynamicChange('education', index, 'achievements' as any, selectedEnhancement); }
            else if (section === 'projects') { handleDynamicChange('projects', index, 'description' as any, selectedEnhancement); }
        }
        setShowEnhancementModal(false); toast.success("Section updated!");
    };

    const handleGeneratePitch = async () => {
        setLoading(true); toast.info("Generating Elevator Pitch...", {id: 'pitch'});
        try {
            let customKey = '';
            if (typeof window !== 'undefined' && user?.id) {
                const savedEncryptedKey = localStorage.getItem('user_gemini_api_key') || '';
                if (savedEncryptedKey) {
                    customKey = await decryptApiKey(savedEncryptedKey, user.id);
                }
            }
            const response = await fetch(`${API_BASE_URL}/generate-elevator-pitch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}`,
                    'X-Gemini-API-Key': customKey
                },
                body: JSON.stringify({ resumeData })
            });
            if (!response.ok) throw new Error('Failed to generate pitch');
            const result = await response.json();
            setPitchText(result.elevatorPitch);
            setShowPitchModal(true);
            toast.success("Elevator pitch generated!", {id: 'pitch'});
        } catch (error: any) { toast.error(error.message, {id: 'pitch'}); } finally { setLoading(false); }
    };

    // --- FULLY INTEGRATED VIDEO HANDLERS ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (videoRef.current) { videoRef.current.srcObject = stream; }
            setIsRecording(true); setRecordedVideoUrl(null); setVideoBlob(null);
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const chunks: BlobPart[] = [];
            mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) { chunks.push(event.data); } };
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                setVideoBlob(blob);
                const url = URL.createObjectURL(blob);
                setRecordedVideoUrl(url);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
        } catch (err) { toast.error("Could not access camera/microphone. Please check permissions."); console.error("Error starting recording:", err); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') { mediaRecorderRef.current.stop(); }
        setIsRecording(false);
    };

    const handleVideoFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) { setVideoBlob(file); setRecordedVideoUrl(URL.createObjectURL(file)); toast.success("Video file selected."); }
    };

    const handleUploadPitchVideo = async () => {
        if (!videoBlob) { toast.error("No video to upload!"); return; }
        if (!user?.id) { toast.error("Please sign in to upload your pitch!"); return; }
        setLoading(true); toast.info("Uploading video pitch to Firebase...", { id: 'upload-pitch' });
        try {
            const fileRef = ref(storage, `users/${user.id}/pitches/${Date.now()}.webm`);
            await uploadBytes(fileRef, videoBlob);
            const downloadUrl = await getDownloadURL(fileRef);
            
            // Save elevator pitch video URL to User collection in Firestore
            await setDoc(doc(db, 'users', user.id), { elevatorPitchUrl: downloadUrl }, { merge: true });
            
            toast.success("Video pitch uploaded to Firebase successfully!", { id: 'upload-pitch' });
        } catch (error: any) {
            console.error("Firebase video pitch upload error:", error);
            toast.error(`Upload failed: ${error.message}`, { id: 'upload-pitch' });
        } finally {
            setLoading(false);
        }
    };


    // --- FULLY INTEGRATED DOWNLOAD HANDLER ---
    const handleDownload = async (type: 'PDF' | 'DOCX') => {
        const endpoint = type === 'PDF' ? '/generate-pdf' : '/generate-docx';
        const filename = `${resumeData.personal.name.replace(/\s/g, '_')}_Resume.${type.toLowerCase()}`;
        const toastId = `${type.toLowerCase()}-download`;

        toast.info(`Generating ${type} file...`, { id: toastId, duration: 15000 });
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/${type === 'PDF' ? 'generate-pdf' : 'generate-docx'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...resumeData, styleOptions, showPamtenLogo })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server responded with an error');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            toast.success(`${type} downloaded successfully!`, { id: toastId });

        } catch (error: any) {
            toast.error(`Failed to generate ${type}: ${error.message}`, { id : toastId });
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    
    const isResumeEmpty = (): boolean => {
        const { personal, summary, experience, education } = resumeData;
        const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
        if (tempDiv) tempDiv.innerHTML = summary || '';
        const summaryText = tempDiv?.textContent?.trim() || '';
        return !personal.name.trim() &&
               !personal.email.trim() &&
               !summaryText &&
               !(experience[0]?.jobTitle || '').trim() &&
               !(education[0]?.degree  || '').trim();
    };

    const renderResumePreview = () => {
        if (isResumeEmpty()) return <EmptyPreview3D />;

        const { personal, summary, experience, education, skills, certifications, publications, projects } = resumeData;
        const ac = styleOptions.accentColor;
        const ff = styleOptions.fontFamily;
        const fs = `${styleOptions.fontSize}pt`;
        const contactDetails = [
            personal.email, personal.phone, personal.location,
            (personal.legalStatus && personal.legalStatus !== 'Prefer not to say') ? personal.legalStatus : null
        ].filter(Boolean).join(' | ');

        const hasExp = (experience || []).some(e => (e.jobTitle || '').trim() || (e.description || '').trim());
        const hasEdu = (education || []).some(e => (e.degree || '').trim());
        const hasSkills = (skills || []).some(e => (e.skills_list || '').trim());
        const hasProj = (projects || []).some((p: any) => (p.title || '').trim() || (p.description || '').trim());
        const hasPubs = (publications || []).some(e => (e.title || '').trim());
        const hasCerts = (certifications || []).some(e => (e.name || '').trim());

        const baseClass = "bg-white rounded-lg border border-gray-300 min-h-[600px] quill-content-container text-gray-900";
        const baseStyle: React.CSSProperties = { fontFamily: ff, fontSize: fs, lineHeight: 1.5, color: '#1a1a1a' };

        if (selectedTemplate === 'modern') {
            return (
                <div id="resume-preview-content" className={baseClass} style={{ ...baseStyle, display: 'flex', padding: 0, overflow: 'hidden' }}>
                    {/* Sidebar */}
                    <div style={{ width: '30%', backgroundColor: ac + '12', borderRight: `3px solid ${ac}`, padding: '24px 14px', flexShrink: 0 }}>
                        {profilePic.preview && <img src={profilePic.preview} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${ac}`, marginBottom: '12px' }} />}
                        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: ac, marginBottom: '4px' }}>{personal.name || 'Your Name'}</h2>
                        <p style={{ fontSize: '9pt', color: '#555', marginBottom: '16px', lineHeight: 1.6 }}>
                            {[personal.email, personal.phone, personal.location].filter(Boolean).map((d, i) => <span key={i} style={{ display: 'block' }}>{d}</span>)}
                        </p>
                        {hasSkills && <>
                            <p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1px solid ${ac}`, paddingBottom: '3px', marginBottom: '8px' }}>Skills</p>
                            {(skills || []).map(skill => <div key={skill.id} style={{ marginBottom: '6px' }}>
                                {skill.category && <p style={{ fontWeight: 600, fontSize: '8pt', color: '#333' }}>{skill.category}</p>}
                                <p style={{ fontSize: '8pt', color: '#555' }}>{skill.skills_list || ''}</p>
                            </div>)}
                        </>}
                        {hasCerts && <>
                            <p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1px solid ${ac}`, paddingBottom: '3px', marginTop: '12px', marginBottom: '8px' }}>Certifications</p>
                            {(certifications || []).map(cert => <div key={cert.id} style={{ fontSize: '8pt', marginBottom: '4px', color: '#444' }}><b>{cert.name}</b>{cert.date && <span> · {cert.date}</span>}</div>)}
                        </>}
                    </div>
                    {/* Main */}
                    <div style={{ flex: 1, padding: '24px 20px' }}>
                        {showPamtenLogo && <img src="https://placehold.co/120x32/white/purple?text=Pamten+Logo" alt="Pamten Logo" style={{ width: '100px', marginBottom: '8px' }} />}
                        {(summary || '').trim() && <><p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, marginBottom: '4px' }}>Summary</p><div style={{ fontSize: '9pt', marginBottom: '14px' }} dangerouslySetInnerHTML={{ __html: summary || '' }} /></>}
                        {hasExp && <><p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1.5px solid ${ac}`, paddingBottom: '2px', marginBottom: '8px' }}>Experience</p>{(experience || []).map(exp => <div key={exp.id} style={{ marginBottom: '10px' }}><b style={{ fontSize: '10pt' }}>{exp.jobTitle}</b><p style={{ color: '#555', fontSize: '9pt' }}>{exp.company}{exp.dates && ` | ${exp.dates}`}</p><div style={{ fontSize: '9pt' }} dangerouslySetInnerHTML={{ __html: exp.description || '' }} /></div>)}</>}
                        {hasEdu && <><p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1.5px solid ${ac}`, paddingBottom: '2px', marginBottom: '8px', marginTop: '14px' }}>Education</p>{(education || []).map(edu => <div key={edu.id} style={{ marginBottom: '8px' }}><b style={{ fontSize: '10pt' }}>{edu.degree}</b><p style={{ color: '#555', fontSize: '9pt' }}>{edu.institution}{edu.graduationYear && ` · ${edu.graduationYear}`}{edu.gpa && ` · GPA: ${edu.gpa}`}</p></div>)}</>}
                        {hasProj && <><p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1.5px solid ${ac}`, paddingBottom: '2px', marginBottom: '8px', marginTop: '14px' }}>Projects</p>{(projects || []).map((proj: any) => <div key={proj.id} style={{ marginBottom: '8px' }}><b style={{ fontSize: '10pt' }}>{proj.title}</b>{proj.date && <span style={{ color: '#777', fontSize: '9pt' }}> ({proj.date})</span>}<div style={{ fontSize: '9pt' }} dangerouslySetInnerHTML={{ __html: proj.description || '' }} /></div>)}</>}
                        {hasPubs && <><p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1.5px solid ${ac}`, paddingBottom: '2px', marginBottom: '8px', marginTop: '14px' }}>Publications</p>{(publications || []).map(pub => <div key={pub.id} style={{ marginBottom: '6px', fontSize: '9pt' }}><b>{pub.title}</b><p style={{ color: '#666' }}>{pub.authors} — <i>{pub.journal}</i>{pub.date && ` (${pub.date})`}</p></div>)}</>}
                    </div>
                </div>
            );
        }

        if (selectedTemplate === 'minimal') {
            return (
                <div id="resume-preview-content" className={baseClass} style={{ ...baseStyle, padding: '40px 48px' }}>
                    {showPamtenLogo && <img src="https://placehold.co/120x32/white/purple?text=Pamten+Logo" alt="Pamten Logo" style={{ width: '100px', marginBottom: '12px' }} />}
                    <h2 style={{ fontSize: '28pt', fontWeight: 300, letterSpacing: '4px', textTransform: 'uppercase', color: '#0f172a', marginBottom: '4px' }}>{personal.name || 'Your Name'}</h2>
                    <p style={{ fontSize: '9pt', color: '#94a3b8', letterSpacing: '1px', marginBottom: '32px' }}>{contactDetails}</p>
                    {(summary || '').trim() && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Profile</p><div style={{ fontSize: '9pt', color: '#374151', marginBottom: '24px', borderLeft: '2px solid #e2e8f0', paddingLeft: '12px' }} dangerouslySetInnerHTML={{ __html: summary || '' }} /></>}
                    {hasExp && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Experience</p><div style={{ marginBottom: '24px' }}>{(experience || []).map(exp => <div key={exp.id} style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid #e2e8f0' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: '10pt', color: '#0f172a' }}>{exp.jobTitle}</b><span style={{ fontSize: '8pt', color: '#94a3b8' }}>{exp.dates}</span></div><p style={{ fontSize: '9pt', color: '#64748b', marginBottom: '4px' }}>{exp.company}</p><div style={{ fontSize: '9pt', color: '#374151' }} dangerouslySetInnerHTML={{ __html: exp.description || '' }} /></div>)}</div></>}
                    {hasEdu && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Education</p><div style={{ marginBottom: '24px' }}>{(education || []).map(edu => <div key={edu.id} style={{ marginBottom: '8px', paddingLeft: '12px', borderLeft: '2px solid #e2e8f0' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: '10pt', color: '#0f172a' }}>{edu.degree}</b><span style={{ fontSize: '8pt', color: '#94a3b8' }}>{edu.graduationYear}</span></div><p style={{ fontSize: '9pt', color: '#64748b' }}>{edu.institution}{edu.gpa && ` · ${edu.gpa}`}</p></div>)}</div></>}
                    {hasSkills && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Skills</p><div style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{(skills || []).flatMap(s => (s.skills_list || '').split(',').map(sk => sk.trim()).filter(Boolean)).map((sk, i) => <span key={i} style={{ fontSize: '8pt', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 8px', color: '#475569' }}>{sk}</span>)}</div></>}
                    {hasProj && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Projects</p><div style={{ marginBottom: '24px' }}>{(projects || []).map((proj: any) => <div key={proj.id} style={{ marginBottom: '10px', paddingLeft: '12px', borderLeft: '2px solid #e2e8f0' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: '10pt', color: '#0f172a' }}>{proj.title}</b><span style={{ fontSize: '8pt', color: '#94a3b8' }}>{proj.date}</span></div><div style={{ fontSize: '9pt', color: '#374151', marginTop: '2px' }} dangerouslySetInnerHTML={{ __html: proj.description || '' }} /></div>)}</div></>}
                    {hasPubs && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Publications</p><div style={{ marginBottom: '24px' }}>{(publications || []).map(pub => <div key={pub.id} style={{ fontSize: '9pt', marginBottom: '6px', color: '#374151' }}><b>{pub.title}</b> · {pub.authors} · <i>{pub.journal}</i>{pub.date && ` · ${pub.date}`}</div>)}</div></>}
                    {hasCerts && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Certifications</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{(certifications || []).map(cert => <span key={cert.id} style={{ fontSize: '8pt', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 8px', color: '#475569' }}>{cert.name}{cert.issuer && ` · ${cert.issuer}`}</span>)}</div></>}
                </div>
            );
        }

        if (selectedTemplate === 'executive') {
            return (
                <div id="resume-preview-content" className={baseClass} style={{ ...baseStyle, padding: '36px 40px' }}>
                    {showPamtenLogo && <img src="https://placehold.co/120x32/white/purple?text=Pamten+Logo" alt="Pamten Logo" style={{ width: '100px', marginBottom: '8px' }} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                        <h2 style={{ fontSize: '30pt', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{personal.name || 'Your Name'}</h2>
                        {profilePic.preview && <img src={profilePic.preview} alt="Profile" style={{ width: '68px', height: '68px', borderRadius: '6px', objectFit: 'cover', border: `2px solid ${ac}` }} />}
                    </div>
                    <div style={{ height: '4px', background: `linear-gradient(90deg, ${ac}, ${ac}88)`, borderRadius: '2px', marginBottom: '8px' }} />
                    <p style={{ fontSize: '9pt', color: '#64748b', marginBottom: '28px' }}>{contactDetails}</p>
                    {(summary || '').trim() && <div style={{ marginBottom: '20px', padding: '12px 16px', background: ac + '08', borderRadius: '4px', borderLeft: `4px solid ${ac}` }}><div style={{ fontSize: '9pt', color: '#374151' }} dangerouslySetInnerHTML={{ __html: summary || '' }} /></div>}
                    {[
                        { show: hasExp, label: 'Professional Experience', content: (experience || []).map(exp => <div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: '11pt', color: '#0f172a' }}>{exp.jobTitle}</b><span style={{ fontSize: '9pt', color: '#64748b' }}>{exp.dates}</span></div><p style={{ color: ac, fontSize: '9pt', fontWeight: 600, marginBottom: '4px' }}>{exp.company}</p><div style={{ fontSize: '9pt', color: '#374151' }} dangerouslySetInnerHTML={{ __html: exp.description || '' }} /></div>) },
                        { show: hasEdu, label: 'Education', content: (education || []).map(edu => <div key={edu.id} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: '11pt', color: '#0f172a' }}>{edu.degree}</b><span style={{ fontSize: '9pt', color: '#64748b' }}>{edu.graduationYear}</span></div><p style={{ color: '#64748b', fontSize: '9pt' }}>{edu.institution}{edu.gpa && ` · GPA ${edu.gpa}`}</p></div>) },
                        { show: hasSkills, label: 'Core Competencies', content: <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>{(skills || []).flatMap(s => (s.skills_list || '').split(',').map(sk => sk.trim()).filter(Boolean)).map((sk, i) => <span key={i} style={{ fontSize: '8pt', background: ac + '15', border: `1px solid ${ac}55`, borderRadius: '4px', padding: '3px 10px', color: '#0f172a', fontWeight: 500 }}>{sk}</span>)}</div> },
                        { show: hasProj, label: 'Key Projects', content: (projects || []).map((proj: any) => <div key={proj.id} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: '11pt', color: '#0f172a' }}>{proj.title}</b><span style={{ fontSize: '9pt', color: '#64748b' }}>{proj.date}</span></div><div style={{ fontSize: '9pt', color: '#374151' }} dangerouslySetInnerHTML={{ __html: proj.description || '' }} /></div>) },
                        { show: hasPubs, label: 'Publications', content: (publications || []).map(pub => <div key={pub.id} style={{ fontSize: '9pt', marginBottom: '6px' }}><b>{pub.title}</b> — {pub.authors} · <i>{pub.journal}</i>{pub.date && ` (${pub.date})`}</div>) },
                        { show: hasCerts, label: 'Certifications', content: (certifications || []).map(cert => <div key={cert.id} style={{ fontSize: '9pt', marginBottom: '4px' }}><b>{cert.name}</b>{cert.issuer && ` · ${cert.issuer}`}{cert.date && ` · ${cert.date}`}</div>) },
                    ].filter(s => s.show).map(s => (
                        <div key={s.label} style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <div style={{ width: '5px', height: '20px', background: ac, borderRadius: '2px', flexShrink: 0 }} />
                                <h3 style={{ fontSize: '11pt', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</h3>
                            </div>
                            {s.content}
                        </div>
                    ))}
                </div>
            );
        }

        // Default: Classic
        return (
            <div id="resume-preview-content" className={baseClass} style={{ ...baseStyle, padding: '32px', whiteSpace: 'pre-wrap' }}>
                {showPamtenLogo && (<div className="mb-4"><img src="https://placehold.co/120x32/white/purple?text=Pamten+Logo" alt="Pamten Logo" style={{ width: '120px' }} /></div>)}
                <div className="text-center mb-6 pb-4 border-b border-gray-300 flex items-center justify-between text-gray-900">
                    <div>
                        <h2 className="text-4xl font-bold" style={{color: ac}}>{personal.name || "Your Name"}</h2>
                        <p className="text-gray-600 mt-2">{contactDetails}</p>
                    </div>
                    {profilePic.preview && (<img src={profilePic.preview} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-gray-200" />)}
                </div>
                {(summary || '').trim() && <div className="mb-4"><h3 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2" style={{color: ac}}>Summary</h3><div className="text-gray-700" dangerouslySetInnerHTML={{__html: summary || ''}} /></div>}
                {hasExp && <div className="mb-4"><h3 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2" style={{color: ac}}>Experience</h3>{(experience || []).map(exp => <div key={exp.id} className="mt-2 text-gray-700"><h4><b>{exp.jobTitle || ''}</b></h4><p className="text-gray-600">{exp.company || ''} | {exp.dates || ''}</p><div dangerouslySetInnerHTML={{__html: exp.description || ''}} /></div>)}</div>}
                {hasEdu && <div className="mb-4"><h3 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2" style={{color: ac}}>Education</h3>{(education || []).map(edu => (<div key={edu.id} className="mt-2 text-gray-700"><h4><b>{edu.degree || ''}</b>, {edu.institution || ''}</h4><p className="text-gray-600">{edu.graduationYear || ''}{edu.gpa && ` | GPA: ${edu.gpa}`}</p><div dangerouslySetInnerHTML={{__html: edu.achievements || ''}} /></div>))}</div>}
                {hasSkills && <div className="mb-4"><h3 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2" style={{color: ac}}>Skills</h3>{(skills || []).map(skill => <div key={skill.id} className="mt-1 text-gray-700"><b>{skill.category || ''}:</b> {skill.skills_list || ''}</div>)}</div>}
                {hasProj && <div className="mb-4"><h3 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2" style={{color: ac}}>Projects</h3>{(projects || []).map((proj: any) => <div key={proj.id} className="mt-2 text-gray-700"><h4><b>{proj.title || ''}</b>{proj.date && ` (${proj.date})`}</h4><div dangerouslySetInnerHTML={{__html: proj.description || ''}}/></div>)}</div>}
                {hasPubs && <div className="mb-4"><h3 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2" style={{color: ac}}>Publications</h3>{(publications || []).map(pub => <div key={pub.id} className="mt-2 text-gray-700"><h4><b>{pub.title || ''}</b> ({pub.date || ''})</h4><p className="text-sm text-gray-600">{pub.authors || ''} - <i>{pub.journal || ''}</i></p></div>)}</div>}
                {hasCerts && <div><h3 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2" style={{color: ac}}>Certifications</h3>{(certifications || []).map(cert => <div key={cert.id} className="mt-2 text-gray-700"><h4><b>{cert.name || ''}</b></h4><p className="text-gray-600">{cert.issuer || ''}{cert.date && ` | ${cert.date}`}</p></div>)}</div>}
            </div>
        );
    };
    
    const sections = [ { id: 'personal', name: 'Personal', icon: <User size={16} /> }, { id: 'summary', name: 'Summary', icon: <FileText size={16} /> }, { id: 'experience', name: 'Experience', icon: <Briefcase size={16} /> }, { id: 'education', name: 'Education', icon: <GraduationCap size={16} /> }, { id: 'skills', name: 'Skills', icon: <Award size={16} /> }, { id: 'projects', name: 'Projects', icon: <FolderGit2 size={16} />}, { id: 'publications', name: 'Publications', icon: <BookOpen size={16} />}, { id: 'certifications', name: 'Certifications', icon: <Award size={16} /> }, { id: 'templates', name: 'Templates', icon: <LayoutTemplate size={16}/> }, { id: 'design', name: 'Design', icon: <Palette size={16}/> } ];

    return (
        <CandidateLayout>
            <Toaster richColors position="top-right" />
            <EnhancementModal isOpen={showEnhancementModal} versions={enhancementVersions} selected={selectedEnhancement} onSelect={setSelectedEnhancement} onApply={handleApplyEnhancement} onClose={() => setShowEnhancementModal(false)} originalText={originalText} />
            <PitchModal isOpen={showPitchModal} onClose={() => setShowPitchModal(false)} pitchText={pitchText} setPitchText={setPitchText} startRecording={startRecording} stopRecording={stopRecording} isRecording={isRecording} recordedVideoUrl={recordedVideoUrl} videoRef={videoRef} onVideoFileChange={handleVideoFileUpload} onUpload={handleUploadPitchVideo} loading={loading} videoBlob={videoBlob} />
            
            <div className="flex flex-col h-full bg-transparent font-sans">
                <header className="flex-shrink-0 bg-white/5 dark:bg-zinc-900/40 backdrop-blur-md border-b border-white/10 p-4">
                  <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                           <img src="https://placehold.co/32x32/white/purple?text=Logo" alt="Pamten Logo" className="h-8"/>
                           <div><h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">AI Resume Builder</h1><p className="text-xs text-gray-300">Craft your professional resume with AI assistance</p></div>
                      </div>
                      <div className="flex items-center gap-4">
                           <Button onClick={handleGeneratePitch} disabled={loading} size="sm" variant="outline"><Mic size={14} className="mr-1.5" />Elevator Pitch</Button>
                      </div>
                  </div>
                </header>

                <main className="flex flex-1 min-h-0">
                    <div className="flex flex-col overflow-y-auto p-6" style={{ width: `${panelWidth}%` }}>
                        <div className="space-y-6">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Upload size={20} />Upload Resume</CardTitle></CardHeader>
                                <CardContent>
                                    {uploadedFileName ? (
                                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                                                <span className="text-sm text-zinc-200 truncate">{uploadedFileName}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <label htmlFor="reupload-file" className="cursor-pointer">
                                                    <Button as="span" size="sm" variant="outline" className="h-8 text-xs px-2"><Upload size={12} className="mr-1" />Replace</Button>
                                                </label>
                                                <Input id="reupload-file" type="file" accept=".pdf,.docx" onChange={handleFileUpload} disabled={loading} className="hidden" />
                                                <Button size="sm" variant="destructive" className="h-8 text-xs px-2" onClick={handleClearResume}><FilePlus2 size={12} className="mr-1" />New</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <Input type="file" accept=".pdf,.docx" onChange={handleFileUpload} disabled={loading} />
                                            <p className="text-xs text-zinc-500 mt-1.5">Upload an existing resume to auto-fill all sections, or fill manually below.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4"><div className="flex flex-wrap gap-2">{sections.map(section => (<Button key={section.id} variant={activeSection === section.id ? "default" : "outline"} onClick={() => setActiveSection(section.id)} size="sm" className="flex items-center gap-2">{section.icon} {section.name}</Button>))}</div></CardContent>
                                <CardContent>
                                    {activeSection === 'personal' && <PersonalForm data={resumeData.personal} onChange={handlePersonalChange} onPicChange={handleProfilePicChange} onPicRemove={handleProfilePicRemove} picPreview={profilePic.preview} />}
                                    {activeSection === 'summary' && <SummaryForm value={resumeData.summary} onChange={(v: string) => { handleSummaryChange(v); if (summarySuggestions.length > 0) setSummarySuggestions([]); }} onEnhance={() => handleEnhance({ section: 'summary'})} loading={loading} suggestions={summarySuggestions} newBatchFrom={newBatchFrom} suggestionsLoading={suggestionsLoading} onGenerateMore={() => fetchSummarySuggestions(undefined, summarySuggestions.length > 0)} onApplySuggestion={(s: string) => { handleSummaryChange(s); setSummarySuggestions([]); setNewBatchFrom(0); toast.success("Summary applied!"); }} onDismissSuggestions={() => { setSummarySuggestions([]); setNewBatchFrom(0); }} />}
                                    {activeSection === 'experience' && <DynamicSection sectionKey="experience" data={resumeData.experience} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} onEnhance={handleEnhance} loading={loading} addPayload={{ jobTitle: '', company: '', dates: '', description: '<p></p>' }} fields={[{key: 'jobTitle', label: 'Job Title'}, {key: 'company', label: 'Company'}, {key: 'dates', label: 'Dates'}, {key: 'description', label: 'Description', type: 'textarea', enhance: true, colSpan: 2}]} />}
                                    {activeSection === 'education' && <DynamicSection sectionKey="education" data={resumeData.education} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} onEnhance={handleEnhance} loading={loading} addPayload={{ degree: '', institution: '', graduationYear: '', gpa: '', achievements: '<p></p>' }} fields={[{key: 'degree', label: 'Degree'}, {key: 'institution', label: 'Institution'}, {key: 'graduationYear', label: 'Graduation Year'}, {key: 'gpa', label: 'GPA (Optional)'}, {key: 'achievements', label: 'Achievements & Coursework', type: 'textarea', enhance: true}]} />}
                                    {activeSection === 'skills' && <DynamicSection sectionKey="skills" data={resumeData.skills} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} loading={loading} addPayload={{ category: '', skills_list: '' }} fields={[{key: 'category', label: 'Category'}, {key: 'skills_list', label: 'Skills', type: 'skill_tags', colSpan: 2}]} />}
                                    {activeSection === 'projects' && <DynamicSection sectionKey="projects" data={resumeData.projects} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} onEnhance={handleEnhance} loading={loading} addPayload={{ title: '', date: '', description: '<p></p>' }} fields={[{key: 'title', label: 'Project Title'}, {key: 'date', label: 'Date'}, {key: 'description', label: 'Description', type: 'textarea', enhance: true, colSpan: 2}]} />}
                                    {activeSection === 'publications' && <DynamicSection sectionKey="publications" data={resumeData.publications} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} loading={loading} addPayload={{ title: '', authors: '', journal: '', date: '', link: '' }} fields={[{key: 'title', label: 'Publication Title'}, {key: 'authors', label: 'Authors'}, {key: 'journal', label: 'Journal or Conference'}, {key: 'date', label: 'Publication Date'}, {key: 'link', label: 'Link (Optional)'}]} />}
                                    {activeSection === 'certifications' && <DynamicSection sectionKey="certifications" data={resumeData.certifications} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} loading={loading} addPayload={{ name: '', issuer: '', date: '' }} fields={[{key: 'name', label: 'Certification Name'}, {key: 'issuer', label: 'Issuing Organization'}, {key: 'date', label: 'Date Received'}]} />}
                                    {activeSection === 'templates' && <TemplatePickerForm selected={selectedTemplate} onSelect={setSelectedTemplate} />}
                                    {activeSection === 'design' && <DesignForm options={styleOptions} onChange={handleStyleChange} />}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    
                    <div className="flex-shrink-0 w-2.5 cursor-col-resize bg-gray-200 hover:bg-indigo-200 transition-colors" onMouseDown={handleMouseDown}></div>

                    <div className="flex-1 flex flex-col overflow-y-auto p-6 min-w-0">
                       <Card className="flex-1 flex flex-col">
                           <CardHeader><CardTitle className="flex items-center gap-2"><Eye size={20} />Resume Preview</CardTitle></CardHeader>
                           <CardContent className="flex-1 overflow-y-auto">
                              {renderResumePreview()}
                           </CardContent>
                       </Card>
                       <div className="space-y-4 mt-6 flex-shrink-0">
                           <div className="flex items-center space-x-2 p-4 border border-white/20 rounded-lg bg-white/10">
                               <input type="checkbox" id="pamtenLogo" className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" checked={showPamtenLogo} onChange={(e) => setShowPamtenLogo(e.target.checked)} />
                               <label htmlFor="pamtenLogo" className="text-sm font-medium text-gray-300">Add Pamten Logo to Document</label>
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                               <Button className="w-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500" onClick={handleSaveDraft} disabled={loading}><Save size={15} className="mr-2" />Save Draft</Button>
                               <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSaveResume} disabled={loading}><Upload size={15} className="mr-2" />Save & Publish</Button>
                               <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleDownload('PDF')} disabled={loading}><Download size={15} className="mr-2" />Download PDF</Button>
                               <Button variant="outline" className="w-full" onClick={() => handleDownload('DOCX')} disabled={loading}><Download size={15} className="mr-2" />Download DOCX</Button>
                           </div>
                       </div>
                    </div>
                </main>
            </div>
        </CandidateLayout>
    );
}